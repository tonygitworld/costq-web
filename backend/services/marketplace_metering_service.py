"""AWS Marketplace metering 计算与上报"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import extract
from sqlalchemy.orm import Session

from backend.models.marketplace import MarketplaceCustomer, MarketplaceMeteringRecord
from backend.services.marketplace_spend_service import (
    MarketplaceSpendService,
    MarketplaceSpendSnapshotError,
)
from backend.services.marketplace_service import MarketplaceService

import logging

logger = logging.getLogger(__name__)


METERING_DIMENSIONS = (
    "spend_25k_to_100k",
    "spend_100k_to_300k",
    "spend_over_300k",
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _truncate_to_hour(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


@dataclass
class MeteringComputationResult:
    cloud_spend_total: float
    cloud_spend_dollars: int
    usage_hour: datetime
    snapshot_at: datetime | None
    snapshot_source: str
    snapshot_breakdown: list[dict[str, Any]]
    usage_records: list[dict[str, Any]]
    db_records: list[MarketplaceMeteringRecord]


class MarketplaceMeteringService:
    """按月累计 spend 计算 Marketplace usage delta"""

    def __init__(self, db: Session):
        self.db = db
        self.marketplace_service = MarketplaceService(db)
        self.spend_service = MarketplaceSpendService(db)

    def _get_bound_customer(self, organization_id: str) -> MarketplaceCustomer:
        customer = (
            self.db.query(MarketplaceCustomer)
            .filter(MarketplaceCustomer.organization_id == organization_id)
            .first()
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Marketplace customer binding not found for organization",
            )
        return customer

    def _get_monthly_spend_snapshot(
        self, organization_id: str, when: datetime
    ) -> tuple[float, datetime | None, str, list[dict[str, Any]]]:
        snapshot = self.spend_service.get_monthly_spend_snapshot(organization_id, when=when)
        return (
            snapshot.total_usd,
            snapshot.snapshot_at,
            snapshot.snapshot_source,
            snapshot.to_dict()["components"],
        )

    def _to_whole_dollars(self, amount: float) -> int:
        decimal_amount = Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_DOWN)
        return int(decimal_amount)

    def _calculate_cumulative_units(self, spend_dollars: int) -> dict[str, int]:
        return {
            "spend_25k_to_100k": max(min(spend_dollars, 100_000) - 25_000, 0),
            "spend_100k_to_300k": max(min(spend_dollars, 300_000) - 100_000, 0),
            "spend_over_300k": max(spend_dollars - 300_000, 0),
        }

    def _get_last_cumulative_quantity(
        self, marketplace_customer_id: str, usage_dimension: str, usage_hour: datetime
    ) -> int:
        record = (
            self.db.query(MarketplaceMeteringRecord)
            .filter(
                MarketplaceMeteringRecord.marketplace_customer_id == marketplace_customer_id,
                MarketplaceMeteringRecord.usage_dimension == usage_dimension,
                extract("year", MarketplaceMeteringRecord.usage_hour) == usage_hour.year,
                extract("month", MarketplaceMeteringRecord.usage_hour) == usage_hour.month,
            )
            .order_by(
                MarketplaceMeteringRecord.usage_hour.desc(),
                MarketplaceMeteringRecord.created_at.desc(),
            )
            .first()
        )
        return int(record.cumulative_quantity or 0) if record else 0

    def prepare_metering_submission(
        self,
        organization_id: str,
        *,
        cloud_spend_total: float | None = None,
        usage_hour: datetime | None = None,
    ) -> MeteringComputationResult:
        customer = self._get_bound_customer(organization_id)
        usage_hour = _truncate_to_hour(usage_hour or _utc_now())
        snapshot_at: datetime | None = None
        snapshot_source = "override"
        snapshot_breakdown: list[dict[str, Any]] = []
        if cloud_spend_total is None:
            try:
                (
                    cloud_spend_total,
                    snapshot_at,
                    snapshot_source,
                    snapshot_breakdown,
                ) = self._get_monthly_spend_snapshot(organization_id, usage_hour)
            except MarketplaceSpendSnapshotError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=str(exc),
                ) from exc
        spend_dollars = self._to_whole_dollars(cloud_spend_total)
        cumulative_units = self._calculate_cumulative_units(spend_dollars)

        usage_records: list[dict[str, Any]] = []
        db_records: list[MarketplaceMeteringRecord] = []

        for dimension in METERING_DIMENSIONS:
            current_cumulative = cumulative_units[dimension]
            previous_cumulative = self._get_last_cumulative_quantity(customer.id, dimension, usage_hour)
            delta = max(current_cumulative - previous_cumulative, 0)
            if delta <= 0:
                continue

            idempotency_key = (
                f"{customer.id}:{dimension}:{usage_hour.strftime('%Y%m%d%H')}:{current_cumulative}"
            )
            db_record = self.marketplace_service.create_metering_record(
                marketplace_customer_id=customer.id,
                organization_id=organization_id,
                agreement_id=None,
                license_arn=customer.latest_license_arn,
                customer_aws_account_id=customer.customer_aws_account_id,
                usage_dimension=dimension,
                usage_hour=usage_hour,
                metered_quantity=delta,
                cumulative_quantity=current_cumulative,
                cloud_spend_snapshot_cents=int(Decimal(str(cloud_spend_total)) * 100),
                idempotency_key=idempotency_key,
            )
            db_records.append(db_record)

            usage_record: dict[str, Any] = {
                "Timestamp": usage_hour,
                "Dimension": dimension,
                "Quantity": int(delta),
            }
            if customer.customer_aws_account_id:
                usage_record["CustomerAWSAccountId"] = customer.customer_aws_account_id
            elif customer.customer_identifier:
                usage_record["CustomerIdentifier"] = customer.customer_identifier
            if customer.latest_license_arn:
                usage_record["LicenseArn"] = customer.latest_license_arn
            usage_records.append(usage_record)

        return MeteringComputationResult(
            cloud_spend_total=cloud_spend_total,
            cloud_spend_dollars=spend_dollars,
            usage_hour=usage_hour,
            snapshot_at=snapshot_at,
            snapshot_source=snapshot_source,
            snapshot_breakdown=snapshot_breakdown,
            usage_records=usage_records,
            db_records=db_records,
        )

    def submit_metering(
        self,
        organization_id: str,
        *,
        cloud_spend_total: float | None = None,
        usage_hour: datetime | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        prepared = self.prepare_metering_submission(
            organization_id,
            cloud_spend_total=cloud_spend_total,
            usage_hour=usage_hour,
        )

        if dry_run or not prepared.usage_records:
            logger.info(
                "Marketplace metering preview: org_id=%s dry_run=%s source=%s snapshot_at=%s spend_total=%s record_count=%s",
                organization_id,
                dry_run,
                prepared.snapshot_source,
                prepared.snapshot_at.isoformat() if prepared.snapshot_at else None,
                prepared.cloud_spend_total,
                len(prepared.usage_records),
            )
            return {
                "dry_run": dry_run,
                "cloud_spend_total": prepared.cloud_spend_total,
                "cloud_spend_dollars": prepared.cloud_spend_dollars,
                "usage_hour": prepared.usage_hour.isoformat(),
                "snapshot_at": prepared.snapshot_at.isoformat() if prepared.snapshot_at else None,
                "snapshot_source": prepared.snapshot_source,
                "snapshot_breakdown": prepared.snapshot_breakdown,
                "usage_records": prepared.usage_records,
            }

        response = self.marketplace_service.batch_meter_usage(usage_records=prepared.usage_records)
        result_records = response.get("Results", [])
        unprocessed = response.get("UnprocessedRecords", [])
        result_by_dimension = {
            item.get("UsageRecord", {}).get("Dimension"): item for item in result_records
        }

        for record in prepared.db_records:
            record.attempt_count += 1
            record.submitted_at = _utc_now()
            result = result_by_dimension.get(record.usage_dimension)
            if result:
                record.metering_status = "submitted"
                record.aws_metering_record_id = result.get("MeteringRecordId")
                record.aws_response = result
                record.last_error = None
            else:
                matching_unprocessed = next(
                    (
                        item
                        for item in unprocessed
                        if item.get("Dimension") == record.usage_dimension
                    ),
                    None,
                )
                record.metering_status = "failed"
                record.aws_response = matching_unprocessed
                record.last_error = str(matching_unprocessed or "Unprocessed record")

        logger.info(
            "Marketplace metering submitted: org_id=%s source=%s snapshot_at=%s spend_total=%s submitted_records=%s unprocessed=%s",
            organization_id,
            prepared.snapshot_source,
            prepared.snapshot_at.isoformat() if prepared.snapshot_at else None,
            prepared.cloud_spend_total,
            len(result_records),
            len(unprocessed),
        )
        return {
            "dry_run": False,
            "cloud_spend_total": prepared.cloud_spend_total,
            "cloud_spend_dollars": prepared.cloud_spend_dollars,
            "usage_hour": prepared.usage_hour.isoformat(),
            "snapshot_at": prepared.snapshot_at.isoformat() if prepared.snapshot_at else None,
            "snapshot_source": prepared.snapshot_source,
            "snapshot_breakdown": prepared.snapshot_breakdown,
            "usage_records": prepared.usage_records,
            "results": result_records,
            "unprocessed_records": unprocessed,
        }
