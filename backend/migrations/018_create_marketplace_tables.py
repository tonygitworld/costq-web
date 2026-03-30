#!/usr/bin/env python3
"""
数据库迁移: 创建 AWS Marketplace 集成所需表

创建表:
- marketplace_customers
- marketplace_agreements
- marketplace_onboarding_sessions
- marketplace_notifications
- marketplace_metering_records
"""

import logging

from sqlalchemy import text


logger = logging.getLogger(__name__)


def upgrade(db):
    """升级数据库"""
    logger.info("⬆️ 开始迁移: 创建 Marketplace 相关表")

    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS marketplace_customers (
                id UUID PRIMARY KEY,
                product_code VARCHAR(64) NOT NULL,
                customer_identifier VARCHAR(255),
                customer_aws_account_id VARCHAR(12),
                organization_id UUID,
                primary_user_id UUID,
                subscription_status VARCHAR(32) NOT NULL DEFAULT 'pending',
                onboarding_status VARCHAR(32) NOT NULL DEFAULT 'pending',
                latest_license_arn VARCHAR(255),
                resolve_payload JSONB,
                activated_at TIMESTAMPTZ,
                last_synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_mp_customer_identifier UNIQUE (product_code, customer_identifier),
                CONSTRAINT uq_mp_customer_account_id UNIQUE (product_code, customer_aws_account_id),
                CONSTRAINT fk_mp_customer_org FOREIGN KEY (organization_id)
                    REFERENCES organizations(id) ON DELETE SET NULL,
                CONSTRAINT fk_mp_customer_user FOREIGN KEY (primary_user_id)
                    REFERENCES users(id) ON DELETE SET NULL
            )
        """))

        db.execute(text("""
            CREATE TABLE IF NOT EXISTS marketplace_agreements (
                id UUID PRIMARY KEY,
                marketplace_customer_id UUID NOT NULL,
                agreement_id VARCHAR(255),
                license_arn VARCHAR(255),
                offer_id VARCHAR(255),
                status VARCHAR(32) NOT NULL DEFAULT 'active',
                start_time TIMESTAMPTZ,
                end_time TIMESTAMPTZ,
                dimensions JSONB,
                entitlement_payload JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_mp_agreement_id UNIQUE (agreement_id),
                CONSTRAINT uq_mp_license_arn UNIQUE (license_arn),
                CONSTRAINT fk_mp_agreement_customer FOREIGN KEY (marketplace_customer_id)
                    REFERENCES marketplace_customers(id) ON DELETE CASCADE
            )
        """))

        db.execute(text("""
            CREATE TABLE IF NOT EXISTS marketplace_onboarding_sessions (
                id UUID PRIMARY KEY,
                marketplace_customer_id UUID NOT NULL,
                session_token VARCHAR(255) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                claimed_by_user_id UUID,
                expires_at TIMESTAMPTZ NOT NULL,
                claimed_at TIMESTAMPTZ,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_mp_onboarding_session_token UNIQUE (session_token),
                CONSTRAINT fk_mp_onboarding_customer FOREIGN KEY (marketplace_customer_id)
                    REFERENCES marketplace_customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_mp_onboarding_user FOREIGN KEY (claimed_by_user_id)
                    REFERENCES users(id) ON DELETE SET NULL
            )
        """))

        db.execute(text("""
            CREATE TABLE IF NOT EXISTS marketplace_notifications (
                id UUID PRIMARY KEY,
                message_id VARCHAR(255) NOT NULL,
                notification_type VARCHAR(64) NOT NULL,
                action VARCHAR(64),
                topic_arn VARCHAR(255),
                processing_status VARCHAR(32) NOT NULL DEFAULT 'received',
                signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
                payload JSONB NOT NULL,
                error_message TEXT,
                processed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_mp_notification_message_id UNIQUE (message_id)
            )
        """))

        db.execute(text("""
            CREATE TABLE IF NOT EXISTS marketplace_metering_records (
                id UUID PRIMARY KEY,
                marketplace_customer_id UUID NOT NULL,
                organization_id UUID,
                agreement_id VARCHAR(255),
                license_arn VARCHAR(255),
                customer_aws_account_id VARCHAR(12),
                usage_dimension VARCHAR(64) NOT NULL,
                usage_hour TIMESTAMPTZ NOT NULL,
                metered_quantity BIGINT NOT NULL DEFAULT 0,
                cumulative_quantity BIGINT NOT NULL DEFAULT 0,
                cloud_spend_snapshot_cents BIGINT,
                metering_status VARCHAR(32) NOT NULL DEFAULT 'pending',
                attempt_count INTEGER NOT NULL DEFAULT 0,
                idempotency_key VARCHAR(255) NOT NULL,
                aws_metering_record_id VARCHAR(255),
                aws_response JSONB,
                last_error TEXT,
                submitted_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_mp_metering_idempotency_key UNIQUE (idempotency_key),
                CONSTRAINT fk_mp_metering_customer FOREIGN KEY (marketplace_customer_id)
                    REFERENCES marketplace_customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_mp_metering_org FOREIGN KEY (organization_id)
                    REFERENCES organizations(id) ON DELETE SET NULL
            )
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_customers_org_id
            ON marketplace_customers(organization_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_customers_status
            ON marketplace_customers(subscription_status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_agreements_customer_id
            ON marketplace_agreements(marketplace_customer_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_agreements_status
            ON marketplace_agreements(status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_onboarding_customer_id
            ON marketplace_onboarding_sessions(marketplace_customer_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_onboarding_status
            ON marketplace_onboarding_sessions(status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_notifications_type
            ON marketplace_notifications(notification_type)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_notifications_status
            ON marketplace_notifications(processing_status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_metering_customer_id
            ON marketplace_metering_records(marketplace_customer_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_metering_dimension_hour
            ON marketplace_metering_records(usage_dimension, usage_hour)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mp_metering_status
            ON marketplace_metering_records(metering_status)
        """))

        db.commit()
        logger.info("✅ Marketplace 表创建成功")
    except Exception as e:
        logger.error("❌ Marketplace 迁移失败: %s", e)
        db.rollback()
        raise


def downgrade(db):
    """回滚数据库"""
    logger.info("⬇️ 回滚 Marketplace 相关表")
    try:
        db.execute(text("DROP TABLE IF EXISTS marketplace_metering_records CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS marketplace_notifications CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS marketplace_onboarding_sessions CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS marketplace_agreements CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS marketplace_customers CASCADE"))
        db.commit()
        logger.info("✅ Marketplace 表回滚完成")
    except Exception as e:
        logger.error("❌ Marketplace 表回滚失败: %s", e)
        db.rollback()
        raise


if __name__ == "__main__":
    import os
    import sys

    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, project_root)

    from backend.database import get_session_local

    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        upgrade(db)
    finally:
        db.close()
