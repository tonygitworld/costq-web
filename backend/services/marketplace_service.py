"""AWS Marketplace service 封装"""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import boto3
from botocore.config import Config
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.marketplace import (
    MarketplaceAgreement,
    MarketplaceCustomer,
    MarketplaceMeteringRecord,
    MarketplaceNotification,
    MarketplaceOnboardingSession,
)
from backend.models.user import Organization

import logging

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


@dataclass
class ResolvedMarketplaceCustomer:
    customer_identifier: str | None
    customer_aws_account_id: str | None
    license_arn: str | None
    product_code: str
    raw_response: dict[str, Any]


class MarketplaceService:
    """封装 AWS Marketplace API 和本地落库逻辑"""

    def __init__(self, db: Session):
        self.db = db
        self._metering_client = None
        self._entitlement_client = None

    @property
    def metering_client(self):
        if self._metering_client is None:
            self._metering_client = boto3.client(
                "meteringmarketplace",
                region_name=settings.MARKETPLACE_REGION,
                config=Config(retries={"max_attempts": 5, "mode": "standard"}),
            )
        return self._metering_client

    @property
    def entitlement_client(self):
        if self._entitlement_client is None:
            self._entitlement_client = boto3.client(
                "marketplace-entitlement",
                region_name=settings.MARKETPLACE_REGION,
                config=Config(retries={"max_attempts": 5, "mode": "standard"}),
            )
        return self._entitlement_client

    def resolve_customer(self, registration_token: str) -> ResolvedMarketplaceCustomer:
        response = self.metering_client.resolve_customer(RegistrationToken=registration_token)
        resolved = ResolvedMarketplaceCustomer(
            customer_identifier=response.get("CustomerIdentifier"),
            customer_aws_account_id=response.get("CustomerAWSAccountId"),
            license_arn=response.get("LicenseArn"),
            product_code=response.get("ProductCode") or settings.MARKETPLACE_PRODUCT_CODE,
            raw_response=response,
        )
        if not resolved.product_code:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Marketplace product code is not configured.",
            )
        return resolved

    def get_entitlements(
        self,
        *,
        customer_identifier: str | None = None,
        customer_aws_account_id: str | None = None,
        license_arn: str | None = None,
        dimensions: list[str] | None = None,
        max_results: int = 25,
        next_token: str | None = None,
    ) -> dict[str, Any]:
        filters: dict[str, list[str]] = {}
        if customer_identifier:
            filters["CUSTOMER_IDENTIFIER"] = [customer_identifier]
        if customer_aws_account_id:
            filters["CUSTOMER_AWS_ACCOUNT_ID"] = [customer_aws_account_id]
        if license_arn:
            filters["LICENSE_ARN"] = [license_arn]
        if dimensions:
            filters["DIMENSION"] = dimensions

        request: dict[str, Any] = {
            "ProductCode": settings.MARKETPLACE_PRODUCT_CODE,
            "MaxResults": max_results,
        }
        if filters:
            request["Filter"] = filters
        if next_token:
            request["NextToken"] = next_token
        return self.entitlement_client.get_entitlements(**request)

    def batch_meter_usage(self, *, usage_records: list[dict[str, Any]]) -> dict[str, Any]:
        if not settings.MARKETPLACE_PRODUCT_CODE:
            raise ValueError("MARKETPLACE_PRODUCT_CODE is required for metering")

        request: dict[str, Any] = {
            "ProductCode": settings.MARKETPLACE_PRODUCT_CODE,
            "UsageRecords": usage_records,
        }
        return self.metering_client.batch_meter_usage(**request)

    def upsert_customer_from_resolve(
        self, resolved_customer: ResolvedMarketplaceCustomer
    ) -> MarketplaceCustomer:
        customer = None
        if resolved_customer.customer_identifier:
            customer = (
                self.db.query(MarketplaceCustomer)
                .filter(
                    MarketplaceCustomer.product_code == resolved_customer.product_code,
                    MarketplaceCustomer.customer_identifier
                    == resolved_customer.customer_identifier,
                )
                .first()
            )
        if customer is None and resolved_customer.customer_aws_account_id:
            customer = (
                self.db.query(MarketplaceCustomer)
                .filter(
                    MarketplaceCustomer.product_code == resolved_customer.product_code,
                    MarketplaceCustomer.customer_aws_account_id
                    == resolved_customer.customer_aws_account_id,
                )
                .first()
            )

        if customer is None:
            customer = MarketplaceCustomer(
                id=str(uuid.uuid4()),
                product_code=resolved_customer.product_code,
                customer_identifier=resolved_customer.customer_identifier,
                customer_aws_account_id=resolved_customer.customer_aws_account_id,
                subscription_status="subscribe-success",
                onboarding_status="pending",
                latest_license_arn=resolved_customer.license_arn,
                resolve_payload=resolved_customer.raw_response,
                last_synced_at=_utc_now(),
            )
            self.db.add(customer)
        else:
            customer.customer_identifier = (
                resolved_customer.customer_identifier or customer.customer_identifier
            )
            customer.customer_aws_account_id = (
                resolved_customer.customer_aws_account_id or customer.customer_aws_account_id
            )
            customer.latest_license_arn = (
                resolved_customer.license_arn or customer.latest_license_arn
            )
            customer.resolve_payload = resolved_customer.raw_response
            customer.last_synced_at = _utc_now()
            if customer.subscription_status == "pending":
                customer.subscription_status = "subscribe-success"
        self.db.flush()
        return customer

    def create_onboarding_session(
        self, marketplace_customer: MarketplaceCustomer
    ) -> MarketplaceOnboardingSession:
        session = MarketplaceOnboardingSession(
            id=str(uuid.uuid4()),
            marketplace_customer_id=marketplace_customer.id,
            session_token=secrets.token_urlsafe(32),
            status="pending",
            expires_at=_utc_now()
            + timedelta(minutes=settings.MARKETPLACE_ONBOARDING_TOKEN_EXPIRE_MINUTES),
            metadata={
                "customer_identifier": marketplace_customer.customer_identifier,
                "customer_aws_account_id": marketplace_customer.customer_aws_account_id,
                "license_arn": marketplace_customer.latest_license_arn,
            },
        )
        self.db.add(session)
        self.db.flush()
        return session

    def build_onboarding_redirect_url(self, session_token: str) -> str:
        query = urlencode({"session": session_token})
        base = settings.MARKETPLACE_FULFILLMENT_RETURN_URL
        separator = "&" if "?" in base else "?"
        return f"{base}{separator}{query}"

    def get_onboarding_session(self, session_token: str) -> MarketplaceOnboardingSession | None:
        return (
            self.db.query(MarketplaceOnboardingSession)
            .filter(MarketplaceOnboardingSession.session_token == session_token)
            .first()
        )

    def get_customer_by_organization_id(self, organization_id: str) -> MarketplaceCustomer | None:
        return (
            self.db.query(MarketplaceCustomer)
            .filter(MarketplaceCustomer.organization_id == organization_id)
            .first()
        )

    def has_active_access(self, customer: MarketplaceCustomer) -> bool:
        now = _utc_now()
        agreements = customer.agreements or []
        if not agreements:
            return customer.subscription_status in {"subscribe-success", "entitlement-updated"}

        for agreement in agreements:
            if agreement.status not in {"active", "subscribe-success", "entitlement-updated"}:
                continue
            if agreement.end_time and agreement.end_time < now:
                continue
            return True
        return False

    def update_customer_access(self, customer: MarketplaceCustomer, *, reason: str) -> bool:
        has_access = self.has_active_access(customer)
        customer.last_synced_at = _utc_now()

        if customer.organization_id:
            organization = (
                self.db.query(Organization).filter(Organization.id == customer.organization_id).first()
            )
            if organization is not None:
                organization.is_active = has_access
                organization.updated_at = _utc_now()

        if has_access:
            customer.onboarding_status = "active" if customer.organization_id else customer.onboarding_status
        elif customer.organization_id:
            customer.onboarding_status = "access_revoked"

        logger.info(
            "Marketplace access state updated: customer_id=%s org_id=%s active=%s reason=%s",
            customer.id,
            customer.organization_id,
            has_access,
            reason,
        )
        self.db.flush()
        return has_access

    def sync_customer_entitlements(
        self,
        customer: MarketplaceCustomer,
        *,
        dimensions: list[str] | None = None,
    ) -> list[MarketplaceAgreement]:
        next_token: str | None = None
        agreements: list[MarketplaceAgreement] = []

        while True:
            response = self.get_entitlements(
                customer_identifier=customer.customer_identifier,
                customer_aws_account_id=customer.customer_aws_account_id,
                license_arn=customer.latest_license_arn,
                dimensions=dimensions,
                next_token=next_token,
            )

            entitlements = response.get("Entitlements", [])
            for entitlement in entitlements:
                value = entitlement.get("Value")
                value_payload = value if isinstance(value, dict) else {"raw": value} if value is not None else None
                agreement = self.upsert_agreement(
                    customer=customer,
                    agreement_id=entitlement.get("AgreementId"),
                    license_arn=entitlement.get("LicenseArn"),
                    status="active",
                    start_time=_parse_datetime(entitlement.get("StartDate")),
                    end_time=_parse_datetime(entitlement.get("ExpirationDate")),
                    dimensions=[{
                        "dimension": entitlement.get("Dimension"),
                        "value": value_payload,
                    }],
                    entitlement_payload=entitlement,
                )
                agreements.append(agreement)

            next_token = response.get("NextToken")
            if not next_token:
                break

        self.update_customer_access(customer, reason="sync-entitlements")
        return agreements

    def get_onboarding_session_status(self, session_token: str) -> dict[str, Any]:
        session = self.get_onboarding_session(session_token)
        if not session:
            raise HTTPException(status_code=404, detail="Marketplace onboarding session not found")

        expired = session.expires_at < _utc_now()
        customer = session.marketplace_customer
        return {
            "session_token": session.session_token,
            "status": session.status,
            "expired": expired,
            "expires_at": session.expires_at.isoformat() if session.expires_at else None,
            "organization_id": customer.organization_id,
            "subscription_status": customer.subscription_status,
            "access_active": self.has_active_access(customer),
            "customer": {
                "id": customer.id,
                "customer_identifier": customer.customer_identifier,
                "customer_aws_account_id": customer.customer_aws_account_id,
                "product_code": customer.product_code,
            },
        }

    def bind_session_to_organization(
        self,
        *,
        session_token: str,
        organization_id: str,
        user_id: str,
        activate_organization: bool = True,
    ) -> MarketplaceCustomer:
        session = self.get_onboarding_session(session_token)
        if not session:
            raise HTTPException(status_code=404, detail="Marketplace onboarding session not found")
        if session.status == "claimed":
            return session.marketplace_customer
        if session.expires_at < _utc_now():
            session.status = "expired"
            self.db.flush()
            raise HTTPException(status_code=410, detail="Marketplace onboarding session expired")

        customer = session.marketplace_customer
        if customer.organization_id and customer.organization_id != organization_id:
            raise HTTPException(
                status_code=409,
                detail="Marketplace customer is already bound to another organization",
            )

        customer.organization_id = organization_id
        customer.primary_user_id = user_id
        customer.onboarding_status = "claimed"
        customer.activated_at = customer.activated_at or _utc_now()
        session.status = "claimed"
        session.claimed_by_user_id = user_id
        session.claimed_at = _utc_now()

        if customer.customer_identifier or customer.customer_aws_account_id or customer.latest_license_arn:
            self.sync_customer_entitlements(customer)

        if activate_organization:
            self.update_customer_access(customer, reason="bind-session")

        self.db.flush()
        return customer

    def record_notification(
        self,
        *,
        message_id: str,
        notification_type: str,
        action: str | None,
        topic_arn: str | None,
        payload: dict[str, Any],
        signature_verified: bool = False,
    ) -> MarketplaceNotification:
        existing = (
            self.db.query(MarketplaceNotification)
            .filter(MarketplaceNotification.message_id == message_id)
            .first()
        )
        if existing:
            return existing

        notification = MarketplaceNotification(
            id=str(uuid.uuid4()),
            message_id=message_id,
            notification_type=notification_type,
            action=action,
            topic_arn=topic_arn,
            payload=payload,
            signature_verified=signature_verified,
        )
        self.db.add(notification)
        self.db.flush()
        return notification

    def upsert_agreement(
        self,
        *,
        customer: MarketplaceCustomer,
        agreement_id: str | None = None,
        license_arn: str | None = None,
        offer_id: str | None = None,
        status: str = "active",
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        dimensions: list[dict[str, Any]] | None = None,
        entitlement_payload: dict[str, Any] | None = None,
    ) -> MarketplaceAgreement:
        agreement = None
        if license_arn:
            agreement = (
                self.db.query(MarketplaceAgreement)
                .filter(MarketplaceAgreement.license_arn == license_arn)
                .first()
            )
        if agreement is None and agreement_id:
            agreement = (
                self.db.query(MarketplaceAgreement)
                .filter(MarketplaceAgreement.agreement_id == agreement_id)
                .first()
            )

        if agreement is None:
            agreement = MarketplaceAgreement(
                id=str(uuid.uuid4()),
                marketplace_customer_id=customer.id,
                agreement_id=agreement_id,
                license_arn=license_arn,
                offer_id=offer_id,
                status=status,
                start_time=start_time,
                end_time=end_time,
                dimensions=dimensions,
                entitlement_payload=entitlement_payload,
            )
            self.db.add(agreement)
        else:
            agreement.status = status
            agreement.offer_id = offer_id or agreement.offer_id
            agreement.license_arn = license_arn or agreement.license_arn
            agreement.start_time = start_time or agreement.start_time
            agreement.end_time = end_time or agreement.end_time
            agreement.dimensions = dimensions or agreement.dimensions
            agreement.entitlement_payload = entitlement_payload or agreement.entitlement_payload

        customer.latest_license_arn = license_arn or customer.latest_license_arn
        customer.last_synced_at = _utc_now()
        self.db.flush()
        return agreement

    def create_metering_record(
        self,
        *,
        marketplace_customer_id: str,
        organization_id: str | None,
        usage_dimension: str,
        usage_hour: datetime,
        metered_quantity: int,
        cumulative_quantity: int,
        cloud_spend_snapshot_cents: int | None,
        agreement_id: str | None = None,
        license_arn: str | None = None,
        customer_aws_account_id: str | None = None,
        idempotency_key: str,
    ) -> MarketplaceMeteringRecord:
        existing = (
            self.db.query(MarketplaceMeteringRecord)
            .filter(MarketplaceMeteringRecord.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            return existing

        record = MarketplaceMeteringRecord(
            id=str(uuid.uuid4()),
            marketplace_customer_id=marketplace_customer_id,
            organization_id=organization_id,
            agreement_id=agreement_id,
            license_arn=license_arn,
            customer_aws_account_id=customer_aws_account_id,
            usage_dimension=usage_dimension,
            usage_hour=usage_hour,
            metered_quantity=metered_quantity,
            cumulative_quantity=cumulative_quantity,
            cloud_spend_snapshot_cents=cloud_spend_snapshot_cents,
            idempotency_key=idempotency_key,
        )
        self.db.add(record)
        self.db.flush()
        return record
