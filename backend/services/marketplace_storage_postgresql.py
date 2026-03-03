"""AWS Marketplace storage (PostgreSQL)

This module persists Marketplace mapping, entitlement cache, and event logs.
Tables are created by migration:
- marketplace_customers
- marketplace_entitlement_cache
- marketplace_event_log

Notes:
- Organization.id is String(36) in current models, but DB has been migrated to UUID types
  for most tables. We treat org_id/customer_identifier as strings at service boundary.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MarketplaceStoragePostgreSQL:
    def __init__(self, db: Session):
        self.db = db

    def upsert_customer_mapping(
        self,
        *,
        org_id: str,
        aws_customer_identifier: str,
        aws_product_code: str | None = None,
        status: str = "active",
    ) -> None:
        # 1:1 mapping on org_id
        self.db.execute(
            text(
                """
                INSERT INTO marketplace_customers (org_id, aws_customer_identifier, aws_product_code, status)
                VALUES (:org_id, :aws_customer_identifier, :aws_product_code, :status)
                ON CONFLICT (org_id)
                DO UPDATE SET
                    aws_customer_identifier = EXCLUDED.aws_customer_identifier,
                    aws_product_code = COALESCE(EXCLUDED.aws_product_code, marketplace_customers.aws_product_code),
                    status = EXCLUDED.status,
                    updated_at = now();
                """
            ),
            {
                "org_id": org_id,
                "aws_customer_identifier": aws_customer_identifier,
                "aws_product_code": aws_product_code,
                "status": status,
            },
        )
        self.db.commit()

    def get_customer_mapping_by_org(self, *, org_id: str) -> dict[str, str] | None:
        row = self.db.execute(
            text(
                """
                SELECT aws_customer_identifier, aws_product_code
                FROM marketplace_customers
                WHERE org_id = :org_id
                """
            ),
            {"org_id": org_id},
        ).fetchone()
        if not row:
            return None
        return {"aws_customer_identifier": row[0], "aws_product_code": row[1]}

    def upsert_entitlement_cache(
        self,
        *,
        org_id: str,
        aws_customer_identifier: str,
        dimension: str,
        value: str,
        expires_at: datetime,
        expiration_date: datetime | None = None,
        raw_entitlement: dict[str, Any] | None = None,
        last_refresh_error: str | None = None,
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO marketplace_entitlement_cache
                    (org_id, aws_customer_identifier, dimension, value, expiration_date, raw_entitlement, cached_at, expires_at, last_refresh_error)
                VALUES
                    (:org_id, :aws_customer_identifier, :dimension, :value, :expiration_date, :raw_entitlement::jsonb, now(), :expires_at, :last_refresh_error)
                ON CONFLICT (org_id, dimension)
                DO UPDATE SET
                    aws_customer_identifier = EXCLUDED.aws_customer_identifier,
                    value = EXCLUDED.value,
                    expiration_date = EXCLUDED.expiration_date,
                    raw_entitlement = EXCLUDED.raw_entitlement,
                    cached_at = now(),
                    expires_at = EXCLUDED.expires_at,
                    last_refresh_error = EXCLUDED.last_refresh_error;
                """
            ),
            {
                "org_id": org_id,
                "aws_customer_identifier": aws_customer_identifier,
                "dimension": dimension,
                "value": value,
                "expiration_date": expiration_date,
                "raw_entitlement": None if raw_entitlement is None else __import__("json").dumps(raw_entitlement),
                "expires_at": expires_at,
                "last_refresh_error": last_refresh_error,
            },
        )
        self.db.commit()

    def insert_event_log(
        self,
        *,
        aws_customer_identifier: str | None,
        sns_message_id: str | None,
        event_type: str,
        payload: dict[str, Any],
        status: str = "pending",
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO marketplace_event_log
                    (aws_customer_identifier, sns_message_id, event_type, payload, status, received_at)
                VALUES
                    (:aws_customer_identifier, :sns_message_id, :event_type, CAST(:payload AS jsonb), :status, now())
                ON CONFLICT (sns_message_id) DO NOTHING;
                """
            ),
            {
                "aws_customer_identifier": aws_customer_identifier,
                "sns_message_id": sns_message_id,
                "event_type": event_type,
                "payload": __import__("json").dumps(payload),
                "status": status,
            },
        )
        self.db.commit()
