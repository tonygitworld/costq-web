"""AWS Marketplace 集成入口"""

from __future__ import annotations

import json
from urllib.parse import parse_qs
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.marketplace_metering_service import MarketplaceMeteringService
from backend.services.marketplace_notification_service import MarketplaceNotificationService
from backend.services.marketplace_service import MarketplaceService
from backend.utils.auth import get_current_admin_user, get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


class MarketplaceClaimRequest(BaseModel):
    session_token: str = Field(..., description="Marketplace onboarding session token")


class MarketplaceMeteringRequest(BaseModel):
    cloud_spend_total: float | None = Field(
        default=None, description="可选：覆盖本次 metering 使用的月累计 spend"
    )
    usage_hour: datetime | None = Field(default=None, description="可选：指定 usage hour")
    dry_run: bool = Field(default=True, description="默认只预览，不调用 BatchMeterUsage")


@router.api_route("/fulfillment", methods=["GET", "POST"])
async def marketplace_fulfillment(
    request: Request,
    marketplace_token: str | None = Query(
        default=None,
        alias="x-amzn-marketplace-token",
        description="Marketplace registration token",
    ),
    db: Session = Depends(get_db),
):
    """处理 Marketplace 订阅落地并重定向到前端 onboarding 页面"""
    if marketplace_token is None and request.method == "POST":
        body = (await request.body()).decode("utf-8")
        marketplace_token = parse_qs(body).get("x-amzn-marketplace-token", [None])[0]
    if not marketplace_token:
        raise HTTPException(status_code=400, detail="Missing x-amzn-marketplace-token")

    service = MarketplaceService(db)
    try:
        resolved = service.resolve_customer(marketplace_token)
        customer = service.upsert_customer_from_resolve(resolved)
        service.sync_customer_entitlements(customer)
        session = service.create_onboarding_session(customer)
        redirect_url = service.build_onboarding_redirect_url(session.session_token)
        db.commit()
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    except Exception:
        db.rollback()
        logger.exception("Marketplace fulfillment failed")
        raise


@router.get("/onboarding-session/{session_token}")
async def get_onboarding_session_status(
    session_token: str,
    db: Session = Depends(get_db),
):
    service = MarketplaceService(db)
    return service.get_onboarding_session_status(session_token)


@router.post("/sns")
async def marketplace_sns_handler(request: Request, db: Session = Depends(get_db)):
    """接收 AWS Marketplace SNS 通知"""
    raw_body = await request.body()
    try:
        envelope = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid SNS payload: {exc}") from exc

    service = MarketplaceNotificationService(db)
    try:
        notification = service.handle_sns_envelope(envelope)
        db.commit()
        return {
            "status": "ok",
            "message_id": notification.message_id,
            "processing_status": notification.processing_status,
        }
    except Exception:
        db.rollback()
        raise


@router.post("/claim")
async def claim_marketplace_session(
    payload: MarketplaceClaimRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将已登录组织绑定到 Marketplace customer"""
    service = MarketplaceService(db)
    try:
        customer = service.bind_session_to_organization(
            session_token=payload.session_token,
            organization_id=current_user["org_id"],
            user_id=current_user["id"],
            activate_organization=True,
        )
        db.commit()
        return {
            "status": "claimed",
            "organization_id": customer.organization_id,
            "customer_id": customer.id,
            "subscription_status": customer.subscription_status,
            "access_active": service.has_active_access(customer),
        }
    except Exception:
        db.rollback()
        raise


@router.post("/admin/sync-entitlements")
async def sync_marketplace_entitlements(
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """为当前组织同步 Marketplace entitlements"""
    service = MarketplaceService(db)
    customer = service.get_customer_by_organization_id(current_user["org_id"])
    if customer is None:
        raise HTTPException(status_code=404, detail="Marketplace customer binding not found")

    response = service.get_entitlements(
        customer_identifier=customer.customer_identifier,
        customer_aws_account_id=customer.customer_aws_account_id,
        license_arn=customer.latest_license_arn,
    )
    entitlements = response.get("Entitlements", [])
    for entitlement in entitlements:
        service.upsert_agreement(
            customer=customer,
            agreement_id=entitlement.get("AgreementId"),
            license_arn=entitlement.get("LicenseArn"),
            status="active",
            dimensions=entitlement.get("Dimension") and [entitlement.get("Dimension")] or None,
            entitlement_payload=entitlement,
        )
    db.commit()
    return {
        "status": "synced",
        "entitlement_count": len(entitlements),
        "next_token": response.get("NextToken"),
    }


@router.post("/admin/meter-usage")
async def meter_marketplace_usage(
    payload: MarketplaceMeteringRequest,
    current_user: dict = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """为当前组织计算并上报 Marketplace metering"""
    service = MarketplaceMeteringService(db)
    try:
        result = service.submit_metering(
            current_user["org_id"],
            cloud_spend_total=payload.cloud_spend_total,
            usage_hour=payload.usage_hour,
            dry_run=payload.dry_run,
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
