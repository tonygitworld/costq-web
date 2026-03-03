#!/usr/bin/env python3
"""数据库迁移: 创建 AWS Marketplace 相关基础表 (PostgreSQL)

创建表:
- marketplace_customers: Marketplace customerIdentifier 与组织(org) 映射（1:1）
- marketplace_entitlement_cache: entitlement 缓存（plan 等维度）
- marketplace_event_log: 事件日志（用于幂等/审计/重放）

运行方式:
    RDS_SECRET_NAME=costq/rds/postgresql-dev python backend/migrations/016_create_marketplace_tables_postgresql.py

说明:
- 该仓库 migrations 采用“脚本直跑”的风格（参考 010_create_execution_log.py）。
- 本脚本使用 backend.database.SessionLocal 建立连接；因此需通过 RDS_SECRET_NAME 指向 dev RDS。
"""

from loguru import logger
from sqlalchemy import text


def upgrade(db):
    logger.info("⬆️  开始迁移: 创建 Marketplace 基础表")

    try:
        logger.info("📋 创建 marketplace_customers 表...")
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS marketplace_customers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    org_id UUID NOT NULL,
                    aws_customer_identifier TEXT NOT NULL,
                    aws_product_code TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

                    CONSTRAINT fk_marketplace_customers_org
                        FOREIGN KEY (org_id)
                        REFERENCES organizations(id)
                        ON DELETE CASCADE,

                    CONSTRAINT uq_marketplace_customers_org_id
                        UNIQUE (org_id),

                    CONSTRAINT uq_marketplace_customers_aws_customer_identifier
                        UNIQUE (aws_customer_identifier)
                )
                """
            )
        )
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_marketplace_customers_org_id ON marketplace_customers(org_id)"))
        db.commit()
        logger.info("✅ marketplace_customers 表创建成功")

        logger.info("📋 创建 marketplace_entitlement_cache 表...")
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS marketplace_entitlement_cache (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    org_id UUID NOT NULL,
                    aws_customer_identifier TEXT NOT NULL,
                    dimension TEXT NOT NULL,
                    value TEXT NOT NULL,
                    expiration_date TIMESTAMPTZ,
                    raw_entitlement JSONB,
                    cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    expires_at TIMESTAMPTZ NOT NULL,
                    last_refresh_error TEXT,

                    CONSTRAINT fk_marketplace_entitlement_cache_org
                        FOREIGN KEY (org_id)
                        REFERENCES organizations(id)
                        ON DELETE CASCADE,

                    CONSTRAINT uq_marketplace_entitlement_cache_org_dimension
                        UNIQUE (org_id, dimension)
                )
                """
            )
        )
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_marketplace_entitlement_cache_org_id ON marketplace_entitlement_cache(org_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_marketplace_entitlement_cache_aws_customer_identifier ON marketplace_entitlement_cache(aws_customer_identifier)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_marketplace_entitlement_cache_expires_at ON marketplace_entitlement_cache(expires_at)"))
        db.commit()
        logger.info("✅ marketplace_entitlement_cache 表创建成功")

        logger.info("📋 创建 marketplace_event_log 表...")
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS marketplace_event_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    aws_customer_identifier TEXT,
                    sns_message_id TEXT,
                    event_type TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    processed_at TIMESTAMPTZ,

                    CONSTRAINT uq_marketplace_event_log_sns_message_id
                        UNIQUE (sns_message_id)
                )
                """
            )
        )
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_marketplace_event_log_status ON marketplace_event_log(status)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_marketplace_event_log_received_at ON marketplace_event_log(received_at)"))
        db.commit()
        logger.info("✅ marketplace_event_log 表创建成功")

        logger.info("🔍 验证迁移结果...")
        result = db.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema='public'
                  AND table_name IN (
                    'marketplace_customers',
                    'marketplace_entitlement_cache',
                    'marketplace_event_log'
                  )
                ORDER BY table_name
                """
            )
        )
        tables = [row[0] for row in result.fetchall()]
        logger.info(f"📊 已创建的表: {tables}")
        logger.info("✅ 迁移完成！")

    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}")
        db.rollback()
        raise


def downgrade(db):
    logger.info("⬇️  开始回滚: 删除 Marketplace 基础表")
    try:
        db.execute(text("DROP TABLE IF EXISTS marketplace_event_log CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS marketplace_entitlement_cache CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS marketplace_customers CASCADE"))
        db.commit()
        logger.info("✅ 回滚完成")
    except Exception as e:
        logger.error(f"❌ 回滚失败: {e}")
        db.rollback()
        raise


if __name__ == "__main__":
    import sys
    import os

    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, project_root)

    from backend.database import SessionLocal

    logger.info("=" * 60)
    logger.info("🚀 开始执行数据库迁移: Marketplace 基础表")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        upgrade(db)
        logger.info("=" * 60)
        logger.info("✅ 迁移执行成功！")
        logger.info("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
