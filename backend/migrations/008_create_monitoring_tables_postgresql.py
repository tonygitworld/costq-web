#!/usr/bin/env python3
"""
数据库迁移: 创建告警监控表 (PostgreSQL)

创建表:
- monitoring_configs: 告警配置表（纯自然语言架构）
- alert_history: 告警历史表

运行方式:
    python backend/migrations/008_create_monitoring_tables_postgresql.py
"""

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def upgrade(db):
    """升级数据库 - 创建告警监控表"""
    logger.info("⬆️  开始迁移: 创建告警监控表")

    try:
        # ============ 1. 创建 monitoring_configs 表 ============
        logger.info("📋 创建 monitoring_configs 表...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS monitoring_configs (
                id VARCHAR(36) PRIMARY KEY,
                org_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                query_description TEXT NOT NULL,
                display_name VARCHAR(200) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                check_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_checked_at TIMESTAMP WITH TIME ZONE,

                -- 外键约束
                CONSTRAINT fk_monitoring_org
                    FOREIGN KEY (org_id)
                    REFERENCES organizations(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_monitoring_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
            )
        """))
        db.commit()
        logger.info("✅ monitoring_configs 表创建成功")

        # ============ 2. 创建 monitoring_configs 索引 ============
        logger.info("📇 创建 monitoring_configs 索引...")

        # 单列索引
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_org_id
            ON monitoring_configs(org_id)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_user_id
            ON monitoring_configs(user_id)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_is_active
            ON monitoring_configs(is_active)
        """))

        # 复合索引（性能优化）
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_org_active
            ON monitoring_configs(org_id, is_active)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_user_active
            ON monitoring_configs(user_id, is_active)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_frequency_active
            ON monitoring_configs(check_frequency, is_active)
        """))

        db.commit()
        logger.info("✅ monitoring_configs 索引创建成功")

        # ============ 3. 创建 alert_history 表 ============
        logger.info("📋 创建 alert_history 表...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS alert_history (
                id VARCHAR(36) PRIMARY KEY,
                alert_id VARCHAR(36) NOT NULL,
                org_id VARCHAR(36) NOT NULL,
                triggered BOOLEAN NOT NULL DEFAULT FALSE,
                current_value DOUBLE PRECISION,
                email_sent BOOLEAN NOT NULL DEFAULT FALSE,
                email_error TEXT,
                execution_result JSONB,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

                -- 外键约束
                CONSTRAINT fk_alert_history_alert
                    FOREIGN KEY (alert_id)
                    REFERENCES monitoring_configs(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_alert_history_org
                    FOREIGN KEY (org_id)
                    REFERENCES organizations(id)
                    ON DELETE CASCADE
            )
        """))
        db.commit()
        logger.info("✅ alert_history 表创建成功")

        # ============ 4. 创建 alert_history 索引 ============
        logger.info("📇 创建 alert_history 索引...")

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id
            ON alert_history(alert_id)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_org_id
            ON alert_history(org_id)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_created_at
            ON alert_history(created_at)
        """))

        # 复合索引
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_alert_triggered
            ON alert_history(alert_id, triggered)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_org_created
            ON alert_history(org_id, created_at)
        """))

        db.commit()
        logger.info("✅ alert_history 索引创建成功")

        # ============ 5. 验证迁移结果 ============
        logger.info("🔍 验证迁移结果...")

        # 检查表是否存在
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('monitoring_configs', 'alert_history')
            ORDER BY table_name
        """))
        tables = [row[0] for row in result.fetchall()]
        logger.info("📊 已创建的表: %s", tables)

        # 检查索引
        result = db.execute(text("""
            SELECT tablename, indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename IN ('monitoring_configs', 'alert_history')
            ORDER BY tablename, indexname
        """))
        logger.info("📇 已创建的索引:")
        for row in result.fetchall():
            logger.info("  - %s.%s", row[0], row[1])

        logger.info("✅ 迁移完成！")

    except Exception as e:
        logger.error("❌ 迁移失败: %s", e)
        db.rollback()
        raise


def downgrade(db):
    """降级数据库 - 删除告警监控表"""
    logger.info("⬇️  开始回滚: 删除告警监控表")

    try:
        # 删除表（外键约束会自动处理）
        logger.info("🗑️  删除 alert_history 表...")
        db.execute(text("DROP TABLE IF EXISTS alert_history CASCADE"))
        db.commit()
        logger.info("✅ alert_history 表删除成功")

        logger.info("🗑️  删除 monitoring_configs 表...")
        db.execute(text("DROP TABLE IF EXISTS monitoring_configs CASCADE"))
        db.commit()
        logger.info("✅ monitoring_configs 表删除成功")

        logger.info("✅ 回滚完成")

    except Exception as e:
        logger.error("❌ 回滚失败: %s", e)
        db.rollback()
        raise


if __name__ == "__main__":
    """手动运行迁移"""
    import sys
    import os

    # 添加项目根目录到 Python 路径
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, project_root)

    from backend.database import SessionLocal

    logger.info("=" * 60)
    logger.info("🚀 开始执行数据库迁移: 创建告警监控表")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        upgrade(db)
        logger.info("\n" + "=" * 60)
        logger.info("✅ 迁移执行成功！")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"\n❌ 迁移执行失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()
