"""添加 GCP 账号表到 PostgreSQL

Revision ID: 006
Create Date: 2025-10-22 06:30:00
"""

from sqlalchemy import text
from loguru import logger


def upgrade(db):
    """升级数据库"""
    logger.info("⬆️  开始迁移: 创建 GCP 账号表")

    # 创建 GCP 账号表
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS gcp_accounts (
            id VARCHAR(255) PRIMARY KEY,
            org_id VARCHAR(255) NOT NULL,
            account_name VARCHAR(255) NOT NULL,
            project_id VARCHAR(255) NOT NULL,
            service_account_email VARCHAR(512) NOT NULL,
            credentials_encrypted TEXT NOT NULL,
            description TEXT,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            organization_id VARCHAR(255),
            billing_account_id VARCHAR(255),
            billing_export_project_id VARCHAR(255),
            billing_export_dataset VARCHAR(255),
            billing_export_table VARCHAR(255),
            CONSTRAINT uq_gcp_org_account_name UNIQUE (org_id, account_name)
        )
    """))

    # 创建索引
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_gcp_org_id
        ON gcp_accounts(org_id)
    """))

    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_gcp_project_id
        ON gcp_accounts(project_id)
    """))

    db.commit()
    logger.info("✅ GCP 账号表创建成功")


def downgrade(db):
    """降级数据库"""
    logger.info("⬇️  开始回滚: 删除 GCP 账号表")

    db.execute(text("DROP TABLE IF EXISTS gcp_accounts"))
    db.commit()

    logger.info("✅ GCP 账号表删除成功")


if __name__ == "__main__":
    """手动运行迁移"""
    from backend.database import SessionLocal

    db = SessionLocal()
    try:
        upgrade(db)
        logger.info("✅ 迁移执行成功")
    except Exception as e:
        logger.error(f"❌ 迁移执行失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()
