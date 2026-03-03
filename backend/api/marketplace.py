"""AWS Marketplace integration endpoints (Subscription SaaS).

MVP endpoints:
- POST /api/marketplace/aws/fulfill
- POST /api/marketplace/aws/entitlement/refresh

Behavior follows the Marketplace Final doc.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models.user import Organization
from backend.services.marketplace_service import MarketplaceService
from backend.services.marketplace_storage_postgresql import MarketplaceStoragePostgreSQL

router = APIRouter(prefix="/api/marketplace/aws", tags=["marketplace"])


class FulfillRequest(BaseModel):
    token: str = Field(..., description="AWS Marketplace redirect token")
    org_id: str = Field(..., description="Target organization id to bind")


class FulfillResponse(BaseModel):
    aws_customer_identifier: str
    product_code: str | None
    plan: str | None
    organization_is_active: bool


class RefreshRequest(BaseModel):
    org_id: str


class RefreshResponse(BaseModel):
    org_id: str
    aws_customer_identifier: str | None
    plan: str | None
    organization_is_active: bool


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/fulfill", response_model=FulfillResponse)
def fulfill(req: FulfillRequest, db=Depends(get_db)):
    # 1) resolve customer
    svc = MarketplaceService()
    resolved = svc.resolve_customer(token=req.token)
    if not resolved.customer_identifier:
        raise HTTPException(status_code=400, detail="ResolveCustomer failed: missing customer_identifier")

    # 2) bind mapping
    storage = MarketplaceStoragePostgreSQL(db)
    storage.upsert_customer_mapping(
        org_id=req.org_id,
        aws_customer_identifier=resolved.customer_identifier,
        aws_product_code=resolved.product_code,
        status="active",
    )

    # 3) fetch entitlement (if product_code present)
    plan = None
    if resolved.product_code:
        ents = svc.get_entitlements(product_code=resolved.product_code, customer_identifier=resolved.customer_identifier)
        # MVP: pick first entitlement dimension/value if any
        if ents:
            plan = (ents[0].get("Dimension") or "").lower() or None

    # 4) activate org (on successful fulfill)
    org: Organization | None = db.query(Organization).filter(Organization.id == req.org_id).one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # enable org; subscription invalidation handled by refresh/worker
    org.is_active = True
    db.commit()

    return FulfillResponse(
        aws_customer_identifier=resolved.customer_identifier,
        product_code=resolved.product_code,
        plan=plan,
        organization_is_active=org.is_active,
    )


@router.post("/entitlement/refresh", response_model=RefreshResponse)
def refresh_entitlement(req: RefreshRequest, db=Depends(get_db)):
    org: Organization | None = db.query(Organization).filter(Organization.id == req.org_id).one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    storage = MarketplaceStoragePostgreSQL(db)
    mapping = storage.get_customer_mapping_by_org(org_id=req.org_id)

    # If no mapping, disable org
    if not mapping or not mapping.get("aws_customer_identifier"):
        org.is_active = False
        db.commit()
        return RefreshResponse(
            org_id=req.org_id,
            aws_customer_identifier=None,
            plan=None,
            organization_is_active=org.is_active,
        )

    customer_identifier = mapping["aws_customer_identifier"]
    product_code = mapping.get("aws_product_code")

    if not product_code:
        # Can't verify entitlement without product code: conservative choice is disable.
        org.is_active = False
        db.commit()
        return RefreshResponse(
            org_id=req.org_id,
            aws_customer_identifier=customer_identifier,
            plan=None,
            organization_is_active=org.is_active,
        )

    svc = MarketplaceService()
    entitlements = svc.get_entitlements(product_code=product_code, customer_identifier=customer_identifier)

    # If no entitlements returned -> disable
    if not entitlements:
        org.is_active = False
        db.commit()
        return RefreshResponse(
            org_id=req.org_id,
            aws_customer_identifier=customer_identifier,
            plan=None,
            organization_is_active=org.is_active,
        )

    # MVP: determine plan from first entitlement Dimension
    plan = (entitlements[0].get("Dimension") or "").lower() or None

    # Cache entitlement for audit/diagnostics
    try:
        storage.upsert_entitlement_cache(
            org_id=req.org_id,
            aws_customer_identifier=customer_identifier,
            dimension="plan",
            value=plan or "unknown",
            expires_at=_utc_now() + timedelta(hours=6),
            raw_entitlement={"entitlements": entitlements},
            last_refresh_error=None,
        )
    except Exception:
        # Cache failure shouldn't block entitlement decision
        pass

    # Enable org if entitlement exists
    org.is_active = True
    db.commit()

    return RefreshResponse(
        org_id=req.org_id,
        aws_customer_identifier=customer_identifier,
        plan=plan,
        organization_is_active=org.is_active,
    )
