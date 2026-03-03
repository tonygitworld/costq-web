"""AWS Marketplace subscription SQS worker (dev/MVP).

Purpose
- Consume messages from an SQS queue subscribed to AWS Marketplace SNS topic.
- Persist message to marketplace_event_log with sns_message_id idempotency.
- Trigger entitlement refresh for affected organization.

Notes
- AWS Marketplace SNS message body format is documented in:
  https://docs.aws.amazon.com/marketplace/latest/userguide/saas-notification.html
- For subscription-notification, payload contains fields like action, customer-identifier, product-code.
- This worker supports two payload shapes:
  A) SQS message body is SNS envelope JSON with field "Message" (string JSON)
  B) SQS message body is already the marketplace JSON (action/customer-identifier/product-code)

Runtime
- Intended to run as a separate process/container.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import boto3
from loguru import logger
from sqlalchemy.orm import Session

from backend.database import get_session_local
from backend.models.user import Organization
from backend.services.marketplace_storage_postgresql import MarketplaceStoragePostgreSQL
from backend.services.marketplace_service import MarketplaceService


@dataclass
class MarketplaceNotification:
    action: str
    customer_identifier: str
    product_code: str | None


def _parse_marketplace_notification(body: str) -> MarketplaceNotification | None:
    data: dict[str, Any] = json.loads(body)

    # If it's an SNS envelope delivered to SQS
    if isinstance(data, dict) and "Message" in data:
        try:
            msg = json.loads(data["Message"])
        except Exception:
            return None
        data = msg

    action = data.get("action")
    customer_identifier = data.get("customer-identifier")
    product_code = data.get("product-code")
    if not action or not customer_identifier:
        return None
    return MarketplaceNotification(action=action, customer_identifier=customer_identifier, product_code=product_code)


def _find_org_id_by_customer_identifier(db: Session, customer_identifier: str) -> str | None:
    row = db.execute(
        __import__("sqlalchemy").text(
            """
            SELECT org_id
            FROM marketplace_customers
            WHERE aws_customer_identifier = :cid
            """
        ),
        {"cid": customer_identifier},
    ).fetchone()
    return row[0] if row else None


def process_one_message(db: Session, *, message: dict[str, Any]) -> bool:
    receipt_handle = message.get("ReceiptHandle")
    body = message.get("Body")
    if not body:
        return True

    # SQS message id (not SNS message id)
    sqs_message_id = message.get("MessageId")

    notif = _parse_marketplace_notification(body)
    storage = MarketplaceStoragePostgreSQL(db)

    if not notif:
        storage.insert_event_log(
            aws_customer_identifier=None,
            sns_message_id=sqs_message_id,
            event_type="unparsed",
            payload={"raw": body},
            status="failed",
        )
        return True

    # log event with idempotency key = sqs message id (MVP)
    storage.insert_event_log(
        aws_customer_identifier=notif.customer_identifier,
        sns_message_id=sqs_message_id,
        event_type=notif.action,
        payload={"customer_identifier": notif.customer_identifier, "product_code": notif.product_code, "raw": body},
        status="pending",
    )

    org_id = _find_org_id_by_customer_identifier(db, notif.customer_identifier)
    if not org_id:
        logger.warning("No org mapping for customer_identifier=%s", notif.customer_identifier)
        return True

    # persist product_code if provided
    if notif.product_code:
        storage.upsert_customer_mapping(
            org_id=org_id,
            aws_customer_identifier=notif.customer_identifier,
            aws_product_code=notif.product_code,
            status="active",
        )

    # trigger entitlement refresh by directly calling MarketplaceService
    mapping = storage.get_customer_mapping_by_org(org_id=org_id)
    if not mapping or not mapping.get("aws_product_code"):
        # cannot verify => disable
        org: Organization | None = db.query(Organization).filter(Organization.id == org_id).one_or_none()
        if org:
            org.is_active = False
            db.commit()
        return True

    svc = MarketplaceService()
    ents = svc.get_entitlements(product_code=mapping["aws_product_code"], customer_identifier=notif.customer_identifier)

    org: Organization | None = db.query(Organization).filter(Organization.id == org_id).one_or_none()
    if not org:
        return True

    if not ents:
        org.is_active = False
        db.commit()
        return True

    org.is_active = True
    db.commit()
    return True


def main():
    queue_url = os.getenv("MARKETPLACE_SQS_QUEUE_URL")
    if not queue_url:
        raise SystemExit("MARKETPLACE_SQS_QUEUE_URL is required")

    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
    sqs = boto3.client("sqs", region_name=region)

    SessionLocal = get_session_local()

    logger.info("Starting marketplace SQS worker, queue=%s", queue_url)

    while True:
        resp = sqs.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=20,
            VisibilityTimeout=60,
        )
        msgs = resp.get("Messages", [])
        if not msgs:
            continue

        for m in msgs:
            db = SessionLocal()
            try:
                ok = process_one_message(db, message=m)
                if ok:
                    sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=m["ReceiptHandle"])
            except Exception as e:
                logger.exception("Error processing message: %s", e)
                # Let it retry; visibility timeout will expire.
            finally:
                db.close()


if __name__ == "__main__":
    main()
