"""AWS Marketplace metering batch job.

Designed for Kubernetes CronJob execution. This entrypoint avoids the user-facing
admin HTTP API and calls the service layer directly.
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text

from backend.database import get_session_local
from backend.models.marketplace import MarketplaceCustomer
from backend.services.marketplace_metering_service import MarketplaceMeteringService
from backend.services.marketplace_service import MarketplaceService

logger = logging.getLogger(__name__)

MARKETPLACE_METERING_LOCK_ID = 8675310


@dataclass
class MeteringJobSummary:
    total_customers: int = 0
    processed_customers: int = 0
    skipped_customers: int = 0
    failed_customers: int = 0


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run AWS Marketplace metering batch job.")
    parser.add_argument(
        "--organization-id",
        dest="organization_id",
        help="Run metering for a single organization only.",
    )
    parser.add_argument(
        "--usage-hour",
        dest="usage_hour",
        help="Override usage hour in ISO8601 format. Defaults to current UTC hour.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview metering without calling BatchMeterUsage.",
    )
    parser.add_argument(
        "--fail-on-error",
        action="store_true",
        help="Exit non-zero on the first customer failure.",
    )
    return parser.parse_args()


def _parse_usage_hour(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None
    normalized = raw_value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _try_acquire_lock():
    session_factory = get_session_local()
    db = session_factory()
    acquired = bool(
        db.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"),
            {"lock_id": MARKETPLACE_METERING_LOCK_ID},
        ).scalar()
    )
    return acquired, db


def _release_lock(db) -> None:
    try:
        db.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"),
            {"lock_id": MARKETPLACE_METERING_LOCK_ID},
        )
        db.commit()
    finally:
        db.close()


def _list_target_customers(organization_id: str | None) -> list[dict[str, str]]:
    session_factory = get_session_local()
    db = session_factory()
    try:
        query = db.query(MarketplaceCustomer).filter(MarketplaceCustomer.organization_id.isnot(None))
        if organization_id:
            query = query.filter(MarketplaceCustomer.organization_id == organization_id)
        customers = query.order_by(MarketplaceCustomer.created_at.asc()).all()

        service = MarketplaceService(db)
        targets: list[dict[str, str]] = []
        for customer in customers:
            if not customer.organization_id:
                continue
            if not service.has_active_access(customer):
                logger.info(
                    "Skip inactive marketplace customer: customer_id=%s org_id=%s status=%s",
                    customer.id,
                    customer.organization_id,
                    customer.subscription_status,
                )
                continue
            targets.append(
                {
                    "customer_id": str(customer.id),
                    "organization_id": str(customer.organization_id),
                }
            )
        return targets
    finally:
        db.close()


def _run_for_organization(
    organization_id: str,
    *,
    usage_hour: datetime | None,
    dry_run: bool,
) -> dict:
    session_factory = get_session_local()
    db = session_factory()
    try:
        service = MarketplaceMeteringService(db)
        result = service.submit_metering(
            organization_id,
            usage_hour=usage_hour,
            dry_run=dry_run,
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    _configure_logging()
    args = _parse_args()
    usage_hour = _parse_usage_hour(args.usage_hour)

    acquired, lock_db = _try_acquire_lock()
    if not acquired:
        logger.warning("Marketplace metering job is already running, skip this execution")
        lock_db.close()
        return 0

    summary = MeteringJobSummary()
    try:
        targets = _list_target_customers(args.organization_id)
        summary.total_customers = len(targets)

        if not targets:
            logger.info("No active marketplace customers found for metering")
            return 0

        logger.info(
            "Starting marketplace metering job: total_customers=%s dry_run=%s usage_hour=%s",
            summary.total_customers,
            args.dry_run,
            usage_hour.isoformat() if usage_hour else None,
        )

        for target in targets:
            org_id = target["organization_id"]
            customer_id = target["customer_id"]
            try:
                result = _run_for_organization(
                    org_id,
                    usage_hour=usage_hour,
                    dry_run=args.dry_run,
                )
                summary.processed_customers += 1
                record_count = len(result.get("usage_records", []))
                if record_count == 0:
                    summary.skipped_customers += 1
                logger.info(
                    "Marketplace metering completed: customer_id=%s org_id=%s dry_run=%s records=%s source=%s snapshot_at=%s",
                    customer_id,
                    org_id,
                    args.dry_run,
                    record_count,
                    result.get("snapshot_source"),
                    result.get("snapshot_at"),
                )
            except Exception as exc:
                summary.failed_customers += 1
                logger.exception(
                    "Marketplace metering failed: customer_id=%s org_id=%s error=%s",
                    customer_id,
                    org_id,
                    exc,
                )
                if args.fail_on_error:
                    return 1

        logger.info(
            "Marketplace metering job finished: total=%s processed=%s skipped=%s failed=%s",
            summary.total_customers,
            summary.processed_customers,
            summary.skipped_customers,
            summary.failed_customers,
        )
        return 1 if summary.failed_customers > 0 else 0
    finally:
        _release_lock(lock_db)


if __name__ == "__main__":
    raise SystemExit(main())
