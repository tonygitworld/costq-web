"""AWS Marketplace SNS 通知处理"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from urllib.request import urlopen
from urllib.parse import urlparse

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.marketplace import MarketplaceCustomer, MarketplaceNotification
from backend.services.marketplace_service import MarketplaceService

import logging

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MarketplaceNotificationService:
    """处理 Marketplace SNS/entitlement 事件"""

    def __init__(self, db: Session):
        self.db = db
        self.marketplace_service = MarketplaceService(db)

    def _confirm_subscription(self, subscribe_url: str) -> None:
        with urlopen(subscribe_url, timeout=10) as response:  # noqa: S310
            logger.info("Marketplace SNS subscription confirmed: status=%s", response.status)

    def _is_valid_signing_cert_url(self, cert_url: str) -> bool:
        parsed = urlparse(cert_url)
        if parsed.scheme != "https":
            return False
        if not parsed.netloc.endswith(".amazonaws.com"):
            return False
        return parsed.path.startswith("/SimpleNotificationService-")

    def _build_sns_string_to_sign(self, envelope: dict[str, Any]) -> bytes:
        notification_type = envelope.get("Type")
        if notification_type == "Notification":
            fields = ["Message", "MessageId"]
            if envelope.get("Subject"):
                fields.extend(["Subject"])
            fields.extend(["Timestamp", "TopicArn", "Type"])
        elif notification_type in {"SubscriptionConfirmation", "UnsubscribeConfirmation"}:
            fields = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"]
        else:
            raise ValueError(f"Unsupported SNS Type for signature verification: {notification_type}")

        lines: list[str] = []
        for field in fields:
            value = envelope.get(field)
            if value is None:
                continue
            lines.append(field)
            lines.append(str(value))
        return ("\n".join(lines) + "\n").encode("utf-8")

    def _verify_sns_signature(self, envelope: dict[str, Any]) -> bool:
        cert_url = envelope.get("SigningCertURL")
        signature = envelope.get("Signature")
        signature_version = str(envelope.get("SignatureVersion", "1"))
        if not cert_url or not signature:
            return False
        if not self._is_valid_signing_cert_url(cert_url):
            raise ValueError(f"Invalid SNS signing cert URL: {cert_url}")

        with urlopen(cert_url, timeout=10) as response:  # noqa: S310
            cert_data = response.read()

        certificate = x509.load_pem_x509_certificate(cert_data)
        public_key = certificate.public_key()
        string_to_sign = self._build_sns_string_to_sign(envelope)

        algorithm = hashes.SHA1() if signature_version == "1" else hashes.SHA256()
        public_key.verify(
            __import__("base64").b64decode(signature),
            string_to_sign,
            padding.PKCS1v15(),
            algorithm,
        )
        return True

    def _extract_action(self, envelope: dict[str, Any]) -> str | None:
        message = envelope.get("Message")
        if not message:
            return None
        if isinstance(message, str):
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                return None
        else:
            payload = message
        return payload.get("action") or payload.get("Action")

    def handle_sns_envelope(self, envelope: dict[str, Any]) -> MarketplaceNotification:
        notification_type = envelope.get("Type", "Notification")
        topic_arn = envelope.get("TopicArn")
        allowed = settings.get_marketplace_allowed_sns_topic_arns()
        if allowed and topic_arn and topic_arn not in allowed:
            raise ValueError(f"Unexpected Marketplace SNS topic: {topic_arn}")

        action = self._extract_action(envelope)
        signature_verified = self._verify_sns_signature(envelope)
        notification = self.marketplace_service.record_notification(
            message_id=envelope.get("MessageId") or envelope.get("MessageID") or str(_utc_now().timestamp()),
            notification_type=notification_type,
            action=action,
            topic_arn=topic_arn,
            payload=envelope,
            signature_verified=signature_verified,
        )

        if notification.processing_status == "processed":
            return notification

        try:
            if notification_type == "SubscriptionConfirmation":
                subscribe_url = envelope.get("SubscribeURL")
                if subscribe_url:
                    self._confirm_subscription(subscribe_url)
                notification.processing_status = "processed"
                notification.processed_at = _utc_now()
            elif notification_type == "Notification":
                self._process_notification_message(notification, envelope)
            else:
                notification.processing_status = "ignored"
                notification.processed_at = _utc_now()
        except Exception as exc:
            notification.processing_status = "failed"
            notification.error_message = str(exc)
            logger.exception("Marketplace notification processing failed")
            self.db.flush()
            raise

        self.db.flush()
        return notification

    def _process_notification_message(
        self, notification: MarketplaceNotification, envelope: dict[str, Any]
    ) -> None:
        message = envelope.get("Message")
        payload = json.loads(message) if isinstance(message, str) else (message or {})

        action = payload.get("action") or payload.get("Action")
        customer_identifier = payload.get("customer-identifier") or payload.get("customerIdentifier")
        customer_aws_account_id = payload.get("customer-aws-account-id") or payload.get(
            "customerAWSAccountId"
        )
        product_code = payload.get("product-code") or payload.get("productCode") or settings.MARKETPLACE_PRODUCT_CODE
        offer_id = payload.get("offer-identifier") or payload.get("offerIdentifier")
        agreement_id = payload.get("agreement-id") or payload.get("agreementId")
        license_arn = payload.get("license-arn") or payload.get("licenseArn")

        customer = None
        if customer_identifier:
            customer = (
                self.db.query(MarketplaceCustomer)
                .filter(
                    MarketplaceCustomer.product_code == product_code,
                    MarketplaceCustomer.customer_identifier == customer_identifier,
                )
                .first()
            )
        if customer is None and customer_aws_account_id:
            customer = (
                self.db.query(MarketplaceCustomer)
                .filter(
                    MarketplaceCustomer.product_code == product_code,
                    MarketplaceCustomer.customer_aws_account_id == customer_aws_account_id,
                )
                .first()
            )

        if customer is None:
            customer = MarketplaceCustomer(
                id=str(__import__("uuid").uuid4()),
                product_code=product_code,
                customer_identifier=customer_identifier,
                customer_aws_account_id=customer_aws_account_id,
                subscription_status=action or "received",
                onboarding_status="pending",
                last_synced_at=_utc_now(),
                resolve_payload=payload,
            )
            self.db.add(customer)
            self.db.flush()

        customer.subscription_status = action or customer.subscription_status
        customer.last_synced_at = _utc_now()
        customer.resolve_payload = payload
        customer.latest_license_arn = license_arn or customer.latest_license_arn

        if action in {"subscribe-success", "entitlement-updated"}:
            if license_arn or agreement_id:
                self.marketplace_service.upsert_agreement(
                    customer=customer,
                    agreement_id=agreement_id,
                    license_arn=license_arn,
                    offer_id=offer_id,
                    status="active",
                    entitlement_payload=payload,
                )
            self.marketplace_service.sync_customer_entitlements(customer)
        elif action == "unsubscribe-pending":
            self.marketplace_service.upsert_agreement(
                customer=customer,
                agreement_id=agreement_id,
                license_arn=license_arn,
                offer_id=offer_id,
                status="unsubscribe-pending",
                entitlement_payload=payload,
            )
            self.marketplace_service.update_customer_access(
                customer, reason="unsubscribe-pending"
            )
        elif action == "unsubscribe-success":
            self.marketplace_service.upsert_agreement(
                customer=customer,
                agreement_id=agreement_id,
                license_arn=license_arn,
                offer_id=offer_id,
                status="inactive",
                entitlement_payload=payload,
            )
            self.marketplace_service.update_customer_access(
                customer, reason="unsubscribe-success"
            )
        else:
            self.marketplace_service.update_customer_access(customer, reason=action or "notification")

        notification.processing_status = "processed"
        notification.processed_at = _utc_now()
