"""GCP 账号存储服务 - PostgreSQL 实现（生产环境）"""

from datetime import datetime

import logging
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from backend.database import get_db
from backend.models.gcp_account import GCPAccount

logger = logging.getLogger(__name__)


class GCPAccountStoragePostgreSQL:
    """GCP 账号存储服务 - PostgreSQL 实现

    用于生产环境，使用 SQLAlchemy 连接 RDS PostgreSQL
    """

    def __init__(self):
        """初始化存储服务"""
        logger.info("✅ GCP 账号存储初始化完成 - PostgreSQL (生产环境)")

    def _get_db(self):
        """获取数据库会话"""
        return next(get_db())

    def create_account(self, account: GCPAccount) -> GCPAccount:
        """创建新的 GCP 账号（多租户架构）

        Args:
            account: GCPAccount 对象（必须包含 org_id）

        Returns:
            GCPAccount: 创建成功的账号对象

        Raises:
            ValueError: 如果账号名称在同一组织内已存在
        """
        db = self._get_db()
        try:
            # 检查账号名是否在同一组织内已存在
            existing = db.execute(
                text(
                    "SELECT id FROM gcp_accounts WHERE org_id = :org_id AND account_name = :account_name"
                ),
                {"org_id": account.org_id, "account_name": account.account_name},
            ).fetchone()

            if existing:
                raise ValueError(
                    f"账号名称 '{account.account_name}' 在当前组织内已存在"
                )

            # 插入新账号
            db.execute(
                text(
                    """
                INSERT INTO gcp_accounts (
                    id, org_id, account_name, project_id, service_account_email,
                    credentials_encrypted, description, is_verified,
                    created_at, updated_at, organization_id, billing_account_id,
                    billing_export_project_id, billing_export_dataset, billing_export_table
                ) VALUES (
                    :id, :org_id, :account_name, :project_id, :service_account_email,
                    :credentials_encrypted, :description, :is_verified,
                    :created_at, :updated_at, :organization_id, :billing_account_id,
                    :billing_export_project_id, :billing_export_dataset, :billing_export_table
                )
            """
                ),
                {
                    "id": account.id,
                    "org_id": account.org_id,
                    "account_name": account.account_name,
                    "project_id": account.project_id,
                    "service_account_email": account.service_account_email,
                    "credentials_encrypted": account.credentials_encrypted,
                    "description": account.description,
                    "is_verified": account.is_verified,
                    "created_at": account.created_at,
                    "updated_at": account.updated_at,
                    "organization_id": account.organization_id,
                    "billing_account_id": account.billing_account_id,
                    "billing_export_project_id": getattr(
                        account, "billing_export_project_id", None
                    ),
                    "billing_export_dataset": getattr(
                        account, "billing_export_dataset", None
                    ),
                    "billing_export_table": getattr(
                        account, "billing_export_table", None
                    ),
                },
            )

            db.commit()
            logger.info(
                f"✅ GCP 账号创建成功 - Org: {account.org_id}, Name: {account.account_name}, ID: {account.id}"
            )
            return account

        except IntegrityError as e:
            db.rollback()
            logger.error("GCP - : %s", e)
            raise ValueError(f"账号创建失败: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error("GCP : %s", e)
            raise
        finally:
            db.close()

    def list_accounts(self, org_id: str) -> list[GCPAccount]:
        """获取指定组织的 GCP 账号列表（多租户架构）

        Args:
            org_id: 组织ID

        Returns:
            List[GCPAccount]: 该组织的账号列表
        """
        db = self._get_db()
        try:
            # 只获取指定组织的账号（多租户隔离）
            rows = db.execute(
                text(
                    """
                    SELECT
                        id, org_id, account_name, project_id, service_account_email,
                        credentials_encrypted, description, is_verified,
                        created_at, updated_at, organization_id, billing_account_id,
                        billing_export_project_id, billing_export_dataset, billing_export_table
                    FROM gcp_accounts
                    WHERE org_id = :org_id
                    ORDER BY created_at DESC
                """
                ),
                {"org_id": org_id},
            ).fetchall()

            accounts = [self._row_to_account(row) for row in rows]
            logger.debug("{len(accounts)} GCP - Org: %s", org_id)
            return accounts

        finally:
            db.close()

    def get_account(self, account_id: str) -> GCPAccount | None:
        """根据 ID 获取账号

        Args:
            account_id: 账号 ID

        Returns:
            Optional[GCPAccount]: 账号对象，不存在则返回 None
        """
        db = self._get_db()
        try:
            row = db.execute(
                text(
                    """
                    SELECT
                        id, org_id, account_name, project_id, service_account_email,
                        credentials_encrypted, description, is_verified,
                        created_at, updated_at, organization_id, billing_account_id,
                        billing_export_project_id, billing_export_dataset, billing_export_table
                    FROM gcp_accounts
                    WHERE id = :account_id
                """
                ),
                {"account_id": account_id},
            ).fetchone()

            if row:
                return self._row_to_account(row)
            return None

        finally:
            db.close()

    def get_account_by_name(self, org_id: str, account_name: str) -> GCPAccount | None:
        """根据账号名称获取账号（多租户架构）

        Args:
            org_id: 组织ID
            account_name: 账号名称

        Returns:
            Optional[GCPAccount]: 账号对象，不存在则返回 None
        """
        db = self._get_db()
        try:
            row = db.execute(
                text(
                    """
                    SELECT
                        id, org_id, account_name, project_id, service_account_email,
                        credentials_encrypted, description, is_verified,
                        created_at, updated_at, organization_id, billing_account_id,
                        billing_export_project_id, billing_export_dataset, billing_export_table
                    FROM gcp_accounts
                    WHERE org_id = :org_id AND account_name = :account_name
                """
                ),
                {"org_id": org_id, "account_name": account_name},
            ).fetchone()

            if row:
                return self._row_to_account(row)
            return None

        finally:
            db.close()

    def update_account(
        self,
        account_id: str,
        org_id: str,
        account_name: str | None = None,
        description: str | None = None,
        billing_export_project_id: str | None = None,
        billing_export_dataset: str | None = None,
        billing_export_table: str | None = None,
    ) -> GCPAccount | None:
        """更新账号信息（多租户架构）

        Args:
            account_id: 账号 ID
            org_id: 组织ID（用于验证所有权）
            account_name: 新的账号名称
            description: 新的描述
            billing_export_project_id: BigQuery 项目 ID
            billing_export_dataset: BigQuery dataset
            billing_export_table: BigQuery 表名

        Returns:
            Optional[GCPAccount]: 更新后的账号对象，不存在则返回 None

        Raises:
            ValueError: 如果新的账号名称在当前组织内已被其他账号使用
        """
        db = self._get_db()
        try:
            # 检查账号是否存在且属于指定组织
            account = self.get_account(account_id)
            if not account:
                return None

            # 验证账号属于指定组织
            if account.org_id != org_id:
                logger.warning(
                    f"⚠️ 尝试修改其他组织的GCP账号 - Account: {account_id}, Expected Org: {org_id}, Actual Org: {account.org_id}"
                )
                return None

            # 如果要更新账号名，检查新名称是否在同组织内已被使用
            if account_name and account_name != account.account_name:
                existing = self.get_account_by_name(org_id, account_name)
                if existing:
                    raise ValueError(f"账号名称 '{account_name}' 在当前组织内已被使用")

            # 构建更新语句
            update_fields = []
            params = {"account_id": account_id}

            if account_name:
                update_fields.append("account_name = :account_name")
                params["account_name"] = account_name

            if description is not None:
                update_fields.append("description = :description")
                params["description"] = description

            if billing_export_project_id is not None:
                update_fields.append(
                    "billing_export_project_id = :billing_export_project_id"
                )
                params["billing_export_project_id"] = billing_export_project_id

            if billing_export_dataset is not None:
                update_fields.append("billing_export_dataset = :billing_export_dataset")
                params["billing_export_dataset"] = billing_export_dataset

            if billing_export_table is not None:
                update_fields.append("billing_export_table = :billing_export_table")
                params["billing_export_table"] = billing_export_table

            if not update_fields:
                # 没有要更新的字段
                return account

            # 添加 updated_at
            update_fields.append("updated_at = :updated_at")
            params["updated_at"] = datetime.now()

            # 执行更新
            db.execute(
                text(
                    f"""
                    UPDATE gcp_accounts
                    SET {", ".join(update_fields)}
                    WHERE id = :account_id
                """
                ),
                params,
            )

            db.commit()
            logger.info("GCP - ID: %s", account_id)

            # 返回更新后的账号
            return self.get_account(account_id)

        except Exception as e:
            db.rollback()
            logger.error("GCP : %s", e)
            raise
        finally:
            db.close()

    def delete_account(self, account_id: str, org_id: str) -> bool:
        """删除账号（多租户架构）

        Args:
            account_id: 账号 ID
            org_id: 组织ID（用于验证所有权）

        Returns:
            bool: 是否删除成功
        """
        db = self._get_db()
        try:
            # 只删除属于指定组织的账号
            result = db.execute(
                text(
                    "DELETE FROM gcp_accounts WHERE id = :account_id AND org_id = :org_id"
                ),
                {"account_id": account_id, "org_id": org_id},
            )

            deleted = result.rowcount > 0
            db.commit()

            if deleted:
                logger.info("GCP - Org: %s, ID: %s", org_id, account_id)
            else:
                logger.warning(
                    f"⚠️  GCP 账号不存在或不属于该组织 - Org: {org_id}, ID: {account_id}"
                )

            return deleted

        finally:
            db.close()

    def get_statistics(self) -> dict:
        """获取账号统计信息

        Returns:
            dict: 统计信息
        """
        db = self._get_db()
        try:
            total = db.execute(text("SELECT COUNT(*) FROM gcp_accounts")).scalar()
            verified = db.execute(
                text("SELECT COUNT(*) FROM gcp_accounts WHERE is_verified = TRUE")
            ).scalar()

            return {
                "total": total,
                "verified": verified,
                "unverified": total - verified,
            }

        finally:
            db.close()

    def _row_to_account(self, row) -> GCPAccount:
        """将数据库行转换为 GCPAccount 对象（多租户架构）

        Args:
            row: 数据库查询结果行

        Returns:
            GCPAccount: 账号对象
        """
        return GCPAccount(
            id=row[0],
            org_id=row[1],
            account_name=row[2],
            project_id=row[3],
            service_account_email=row[4],
            credentials_encrypted=row[5],
            description=row[6],
            is_verified=bool(row[7]),
            created_at=(
                row[8]
                if isinstance(row[8], datetime)
                else datetime.fromisoformat(str(row[8]))
            ),
            updated_at=(
                row[9]
                if isinstance(row[9], datetime)
                else datetime.fromisoformat(str(row[9]))
            ),
            organization_id=row[10],
            billing_account_id=row[11],
            billing_export_project_id=row[12] if len(row) > 12 else None,
            billing_export_dataset=row[13] if len(row) > 13 else None,
            billing_export_table=row[14] if len(row) > 14 else None,
        )


# 全局单例
_gcp_account_storage_postgresql: GCPAccountStoragePostgreSQL | None = None


def get_gcp_account_storage_postgresql() -> GCPAccountStoragePostgreSQL:
    """获取 GCP 账号存储单例（PostgreSQL）

    Returns:
        GCPAccountStoragePostgreSQL: GCP 账号存储实例
    """
    global _gcp_account_storage_postgresql

    if _gcp_account_storage_postgresql is None:
        _gcp_account_storage_postgresql = GCPAccountStoragePostgreSQL()

    return _gcp_account_storage_postgresql
