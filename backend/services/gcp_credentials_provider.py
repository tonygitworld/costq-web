"""
GCP Credentials Provider

Provides decrypted GCP Service Account credentials for MCP tools.
Mirrors the pattern used in aws_credentials_provider.py for consistency.
"""

import logging

from google.oauth2 import service_account

from .gcp_account_storage_postgresql import get_gcp_account_storage_postgresql
from .gcp_credential_manager import get_gcp_credential_manager

logger = logging.getLogger(__name__)


class GCPCredentialsProvider:
    """GCP Credentials Provider for MCP tools

    Provides Service Account credentials to MCP servers in a secure way.
    Credentials are decrypted from encrypted storage only when needed.
    """

    def __init__(self):
        self.credential_manager = get_gcp_credential_manager()
        self.account_storage = get_gcp_account_storage_postgresql()
        # logger.info("✅ GCP Credentials Provider initialized")  # 已静默 - 每次查询都重复

    def get_credentials_json(self, account_id: str) -> dict:
        """Get decrypted Service Account JSON

        Args:
            account_id: GCP account ID from storage

        Returns:
            Service Account JSON dict with keys:
            - type: "service_account"
            - project_id: str
            - private_key_id: str
            - private_key: str
            - client_email: str
            - client_id: str
            - auth_uri: str
            - token_uri: str

        Raises:
            ValueError: If account not found
            Exception: If decryption fails
        """
        # logger.info(f"🔍 Retrieving credentials for account: {account_id}")  # 已静默

        account = self.account_storage.get_account(account_id)
        if not account:
            error_msg = f"❌ GCP account not found: {account_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        try:
            credentials_json = self.credential_manager.decrypt_credentials(
                account.credentials_encrypted
            )
            # logger.info(f"✅ Credentials decrypted - Project: {credentials_json.get('project_id')}")  # 已静默
            return credentials_json
        except Exception as e:
            logger.error(
                f"❌ Failed to decrypt credentials for account {account_id}: {e}"
            )
            raise

    def create_credentials(
        self, account_id: str, scopes: list[str] | None = None
    ) -> service_account.Credentials:
        """Create google.oauth2.service_account.Credentials object

        Args:
            account_id: GCP account ID
            scopes: OAuth2 scopes (default: billing + BigQuery)

        Returns:
            Credentials object ready for GCP API clients

        Example:
            >>> provider = get_gcp_credentials_provider()
            >>> creds = provider.create_credentials('account-123')
            >>> bigquery_client = bigquery.Client(credentials=creds)
        """
        if scopes is None:
            scopes = [
                "https://www.googleapis.com/auth/cloud-billing.readonly",  # 查看计费信息
                "https://www.googleapis.com/auth/bigquery",  # BigQuery 完整访问（执行查询）
                "https://www.googleapis.com/auth/cloud-platform.read-only",  # 其他 GCP 服务只读
            ]

        # logger.info(f"🔑 Creating GCP credentials - Account: {account_id}, Scopes: {len(scopes)}")  # 已静默

        creds_json = self.get_credentials_json(account_id)

        try:
            credentials = service_account.Credentials.from_service_account_info(
                creds_json, scopes=scopes
            )

            # logger.info(
            #     f"✅ GCP credentials created - "
            #     f"Project: {creds_json['project_id']}, "
            #     f"Service Account: {creds_json['client_email']}"
            # )  # 已静默

            return credentials
        except Exception as e:
            logger.error(f"❌ Failed to create credentials object: {e}")
            raise

    def get_account_info(self, account_id: str) -> dict | None:
        """Get account metadata (non-sensitive)

        Args:
            account_id: GCP account ID

        Returns:
            Dictionary with:
            - id: str
            - account_name: str
            - project_id: str
            - billing_account_id: Optional[str]  # ✅ Added
            - service_account_email: str (masked)
            - is_verified: bool
            - billing_export_project_id: Optional[str]
            - billing_export_dataset: Optional[str]
            - billing_export_table: Optional[str]
        """
        account = self.account_storage.get_account(account_id)
        if not account:
            logger.warning(f"⚠️ Account not found: {account_id}")
            return None

        return {
            "id": account.id,
            "account_name": account.account_name,
            "project_id": account.project_id,
            "billing_account_id": getattr(
                account, "billing_account_id", None
            ),  # ✅ Added
            "service_account_email": account.service_account_email,
            "is_verified": account.is_verified,
            "billing_export_project_id": getattr(
                account, "billing_export_project_id", None
            ),
            "billing_export_dataset": getattr(account, "billing_export_dataset", None),
            "billing_export_table": getattr(account, "billing_export_table", None),
        }

    def get_bigquery_table_name(self, account_id: str) -> str | None:
        """Get fully qualified BigQuery billing export table name

        Args:
            account_id: GCP account ID

        Returns:
            Fully qualified table name like:
            'project_id.dataset.gcp_billing_export_resource_v1_BILLING_ACCOUNT_ID'
            or None if not configured
        """
        account = self.account_storage.get_account(account_id)
        if not account:
            return None

        # Get configuration from account
        export_project = (
            getattr(account, "billing_export_project_id", None) or account.project_id
        )
        export_dataset = getattr(account, "billing_export_dataset", None)
        export_table = getattr(account, "billing_export_table", None)

        if not export_dataset or not export_table:
            logger.warning(
                f"⚠️ BigQuery billing export not configured for account: {account_id}"
            )
            return None

        full_table = f"{export_project}.{export_dataset}.{export_table}"
        # logger.info(f"📊 BigQuery table: {full_table}")  # 已静默 - 每次工具调用都重复
        return full_table

    def verify_bigquery_export_configured(self, account_id: str) -> bool:
        """Check if BigQuery billing export is configured

        Args:
            account_id: GCP account ID

        Returns:
            True if configured, False otherwise
        """
        table_name = self.get_bigquery_table_name(account_id)
        return table_name is not None

    def extract_billing_account_id(self, account_id: str) -> str | None:
        """Extract billing_account_id from BigQuery billing export data

        Queries the billing export table to get the actual billing_account_id.
        This is the most accurate way to get the billing account ID.

        Args:
            account_id: GCP account ID

        Returns:
            Billing account ID (format: 012345-ABCDEF-123456) or None if not found
        """
        table_name = self.get_bigquery_table_name(account_id)
        if not table_name:
            logger.warning(
                f"⚠️ Cannot extract billing_account_id - BigQuery not configured for {account_id}"
            )
            return None

        try:
            from google.cloud import bigquery

            # Create BigQuery client
            credentials = self.create_credentials(account_id)
            bq_client = bigquery.Client(credentials=credentials)

            # Query to get billing_account_id
            query = f"""
            SELECT DISTINCT billing_account_id
            FROM `{table_name}`
            WHERE billing_account_id IS NOT NULL
            LIMIT 1
            """

            logger.info(
                f"🔍 Extracting billing_account_id from BigQuery table: {table_name}"
            )
            query_job = bq_client.query(query)
            results = query_job.result()

            for row in results:
                billing_account_id = row.billing_account_id
                logger.info(f"✅ Extracted billing_account_id: {billing_account_id}")
                return billing_account_id

            logger.warning(f"⚠️ No billing_account_id found in table {table_name}")
            return None

        except Exception as e:
            logger.error(f"❌ Failed to extract billing_account_id: {e}")
            return None


# Singleton instance
_gcp_credentials_provider: GCPCredentialsProvider | None = None


def get_gcp_credentials_provider() -> GCPCredentialsProvider:
    """Get or create singleton GCP credentials provider instance"""
    global _gcp_credentials_provider
    if _gcp_credentials_provider is None:
        _gcp_credentials_provider = GCPCredentialsProvider()
    return _gcp_credentials_provider
