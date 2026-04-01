"""AWS Marketplace authoritative monthly spend aggregation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import boto3
from botocore.exceptions import ClientError
from google.cloud import bigquery

from sqlalchemy.orm import Session

from backend.models.gcp_account import GCPAccount
from backend.models.user import Organization
from backend.services.account_storage import get_account_storage
from backend.services.credential_manager import get_credential_manager
from backend.services.gcp_account_storage_postgresql import get_gcp_account_storage_postgresql
from backend.services.gcp_credentials_provider import get_gcp_credentials_provider

import logging

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MarketplaceSpendSnapshotError(Exception):
    """Raised when authoritative spend snapshot cannot be produced."""


@dataclass
class SpendSnapshotComponent:
    provider: str
    account_id: str
    account_name: str
    amount_usd: float
    source: str
    snapshot_at: str


@dataclass
class MarketplaceSpendSnapshot:
    total_usd: float
    snapshot_at: datetime
    snapshot_source: str
    components: list[SpendSnapshotComponent]

    def to_dict(self) -> dict:
        return {
            "total_usd": self.total_usd,
            "snapshot_at": self.snapshot_at.isoformat(),
            "snapshot_source": self.snapshot_source,
            "components": [asdict(component) for component in self.components],
        }


class MarketplaceSpendService:
    """Queries current-month authoritative spend across AWS/GCP accounts."""

    def __init__(self, db: Session):
        self.db = db
        self.account_storage = get_account_storage()
        self.gcp_account_storage = get_gcp_account_storage_postgresql()
        self.credential_manager = get_credential_manager()
        self.gcp_credentials_provider = get_gcp_credentials_provider()

    def get_monthly_spend_snapshot(
        self,
        organization_id: str,
        *,
        when: datetime,
    ) -> MarketplaceSpendSnapshot:
        year = when.year
        month = when.month
        components: list[SpendSnapshotComponent] = []
        total = Decimal("0.00")

        aws_accounts = [
            account
            for account in self.account_storage.list_accounts(org_id=organization_id)
            if account.get("is_verified") is True
        ]
        has_iam_role_account = any(
            (account.get("auth_type") or "aksk") == "iam_role" and account.get("role_arn")
            for account in aws_accounts
        )
        organization_external_id = (
            self._get_organization_external_id(organization_id) if has_iam_role_account else None
        )

        for account in aws_accounts:
            amount = self._get_aws_monthly_cost(
                account=account,
                organization_external_id=organization_external_id,
                year=year,
                month=month,
            )
            queried_at = _utc_now()
            total += amount
            components.append(
                SpendSnapshotComponent(
                    provider="aws",
                    account_id=str(account.get("id")),
                    account_name=account.get("alias") or account.get("account_id") or "AWS account",
                    amount_usd=float(amount),
                    source="aws-cost-explorer",
                    snapshot_at=queried_at.isoformat(),
                )
            )

        gcp_accounts = [
            account
            for account in self.gcp_account_storage.list_accounts(org_id=organization_id)
            if account.is_verified
        ]
        for account in gcp_accounts:
            amount = self._get_gcp_monthly_cost(account=account, year=year, month=month)
            queried_at = _utc_now()
            total += amount
            components.append(
                SpendSnapshotComponent(
                    provider="gcp",
                    account_id=account.id,
                    account_name=account.account_name,
                    amount_usd=float(amount),
                    source="gcp-billing-export",
                    snapshot_at=queried_at.isoformat(),
                )
            )

        snapshot_at = _utc_now()
        sources = sorted({component.source for component in components})
        snapshot_source = "+".join(sources) if sources else "authoritative-query:no-accounts"
        snapshot = MarketplaceSpendSnapshot(
            total_usd=float(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            snapshot_at=snapshot_at,
            snapshot_source=snapshot_source,
            components=components,
        )
        logger.info(
            "Marketplace spend snapshot resolved: org_id=%s source=%s snapshot_at=%s total_usd=%s component_count=%s",
            organization_id,
            snapshot.snapshot_source,
            snapshot.snapshot_at.isoformat(),
            snapshot.total_usd,
            len(snapshot.components),
        )
        return snapshot

    def _get_organization_external_id(self, organization_id: str) -> str:
        organization = (
            self.db.query(Organization).filter(Organization.id == organization_id).first()
        )
        if organization is None:
            raise MarketplaceSpendSnapshotError(f"Organization not found: {organization_id}")
        if not organization.external_id:
            raise MarketplaceSpendSnapshotError(
                f"Organization external_id is not configured: {organization_id}"
            )
        return organization.external_id

    def _get_aws_monthly_cost(
        self,
        *,
        account: dict,
        organization_external_id: str | None,
        year: int,
        month: int,
    ) -> Decimal:
        auth_type = (account.get("auth_type") or "aksk").lower()
        try:
            if auth_type == "iam_role":
                role_arn = account.get("role_arn")
                if not role_arn:
                    raise MarketplaceSpendSnapshotError(
                        f"AWS account {account.get('id')} is missing role_arn"
                    )
                if not organization_external_id:
                    raise MarketplaceSpendSnapshotError(
                        "Organization external_id is required for IAM role based cost metering"
                    )
                session = self._assume_role_session(role_arn, organization_external_id)
            else:
                access_key_id = account.get("access_key_id")
                secret_access_key_encrypted = account.get("secret_access_key_encrypted")
                if not access_key_id or not secret_access_key_encrypted:
                    raise MarketplaceSpendSnapshotError(
                        f"AWS account {account.get('id')} is missing AKSK credentials"
                    )
                secret_access_key = self.credential_manager.decrypt_secret_key(
                    secret_access_key_encrypted
                )
                session = self.credential_manager.create_session(
                    access_key_id=access_key_id,
                    secret_access_key=secret_access_key,
                    region=account.get("region") or "us-east-1",
                )
            return self._query_cost_explorer_monthly_total(session, year=year, month=month)
        except MarketplaceSpendSnapshotError:
            raise
        except Exception as exc:
            raise MarketplaceSpendSnapshotError(
                f"Failed to query AWS monthly spend for account {account.get('id')}: {exc}"
            ) from exc

    def _assume_role_session(self, role_arn: str, external_id: str) -> boto3.Session:
        sts = boto3.client("sts")
        response = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName="costq-marketplace-metering",
            ExternalId=external_id,
            DurationSeconds=900,
        )
        credentials = response["Credentials"]
        return boto3.Session(
            aws_access_key_id=credentials["AccessKeyId"],
            aws_secret_access_key=credentials["SecretAccessKey"],
            aws_session_token=credentials["SessionToken"],
        )

    def _query_cost_explorer_monthly_total(
        self,
        session: boto3.Session,
        *,
        year: int,
        month: int,
    ) -> Decimal:
        start = f"{year}-{month:02d}-01"
        end = f"{year + 1}-01-01" if month == 12 else f"{year}-{month + 1:02d}-01"
        client = session.client("ce", region_name="us-east-1")
        try:
            response = client.get_cost_and_usage(
                TimePeriod={"Start": start, "End": end},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
            )
        except ClientError as exc:
            raise MarketplaceSpendSnapshotError(
                f"Cost Explorer query failed: {exc.response['Error']['Code']}"
            ) from exc
        results = response.get("ResultsByTime", [])
        if not results:
            return Decimal("0.00")
        amount_str = results[0]["Total"]["UnblendedCost"]["Amount"]
        return Decimal(amount_str).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _get_gcp_monthly_cost(
        self,
        *,
        account: GCPAccount,
        year: int,
        month: int,
    ) -> Decimal:
        export_project = account.billing_export_project_id or account.project_id
        export_dataset = account.billing_export_dataset
        export_table = account.billing_export_table
        if not export_project or not export_dataset or not export_table:
            raise MarketplaceSpendSnapshotError(
                f"GCP account {account.id} is missing Billing Export configuration"
            )

        try:
            credentials = self.gcp_credentials_provider.create_credentials(account.id)
            client = bigquery.Client(credentials=credentials, project=export_project)
            invoice_month = f"{year}{month:02d}"
            table_ref = f"`{export_project}.{export_dataset}.{export_table}`"
            query = f"""
                SELECT COALESCE(SUM(cost), 0) AS total_cost
                FROM {table_ref}
                WHERE invoice.month = @invoice_month
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("invoice_month", "STRING", invoice_month)
                ]
            )
            result = client.query(query, job_config=job_config).result()
            row = next(iter(result), None)
            if row is None or row.total_cost is None:
                return Decimal("0.00")
            return Decimal(str(row.total_cost)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        except MarketplaceSpendSnapshotError:
            raise
        except Exception as exc:
            raise MarketplaceSpendSnapshotError(
                f"Failed to query GCP monthly spend for account {account.id}: {exc}"
            ) from exc
