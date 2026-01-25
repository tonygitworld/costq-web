#!/usr/bin/env python3
"""
数据库迁移: 创建告警执行日志表 (PostgreSQL)

创建表:
- alert_execution_logs: 告警执行日志表

记录每次告警检查的详细执行过程，用于调试、审计和性能监控

运行方式:
    python backend/migrations/010_create_execution_log.py
"""

from loguru import logger
from sqlalchemy import text


def upgrade(db):
    """升级数据库 - 创建告警执行日志表"""
    logger.info("⬆️  开始迁移: 创建告警执行日志表")

    try:
        # ============ 1. 创建 alert_execution_logs 表 ============
        logger.info("📋 创建 alert_execution_logs 表...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS alert_execution_logs (
                id VARCHAR(36) PRIMARY KEY,
                alert_id VARCHAR(36) NOT NULL,
                org_id VARCHAR(36) NOT NULL,
                execution_type VARCHAR(20) NOT NULL,
                triggered_by_user_id VARCHAR(36),
                account_id VARCHAR(36),
                account_type VARCHAR(10),
                success BOOLEAN NOT NULL DEFAULT FALSE,
                triggered BOOLEAN NOT NULL DEFAULT FALSE,
                current_value DOUBLE PRECISION,
                threshold DOUBLE PRECISION,
                threshold_operator VARCHAR(10),
                email_sent BOOLEAN NOT NULL DEFAULT FALSE,
                to_emails JSONB,
                execution_steps JSONB,
                agent_response TEXT,
                error_message TEXT,
                execution_duration_ms INTEGER,
                started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,

                -- 外键约束
                CONSTRAINT fk_execution_log_alert
                    FOREIGN KEY (alert_id)
                    REFERENCES monitoring_configs(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_execution_log_org
                    FOREIGN KEY (org_id)
                    REFERENCES organizations(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_execution_log_user
                    FOREIGN KEY (triggered_by_user_id)
                    REFERENCES users(id)
                    ON DELETE SET NULL
            )
        """))
        db.commit()
        logger.info("✅ alert_execution_logs 表创建成功")

        # ============ 2. 创建索引 ============
        logger.info("📇 创建索引...")

        # 单列索引
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_alert_id
            ON alert_execution_logs(alert_id)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_org_id
            ON alert_execution_logs(org_id)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_type
            ON alert_execution_logs(execution_type)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_triggered
            ON alert_execution_logs(triggered)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_success
            ON alert_execution_logs(success)
        """))

        # 复合索引（性能优化）
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_alert_time
            ON alert_execution_logs(alert_id, started_at)
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_execution_log_org_time
            ON alert_execution_logs(org_id, started_at)
        """))

        db.commit()
        logger.info("✅ 索引创建成功")

        # ============ 3. 添加表注释 ============
        logger.info("📝 添加表注释...")
        db.execute(text("""
            COMMENT ON TABLE alert_execution_logs IS '告警执行日志表，记录每次告警检查的详细执行过程'
        """))

        db.execute(text("""
            COMMENT ON COLUMN alert_execution_logs.execution_type IS '执行类型：test（测试）/ scheduled（定时任务）'
        """))

        db.execute(text("""
            COMMENT ON COLUMN alert_execution_logs.triggered IS '是否触发告警（满足阈值条件）'
        """))

        db.execute(text("""
            COMMENT ON COLUMN alert_execution_logs.execution_duration_ms IS '执行耗时（毫秒）'
        """))

        db.commit()
        logger.info("✅ 表注释添加成功")

        # ============ 4. 验证迁移结果 ============
        logger.info("🔍 验证迁移结果...")

        # 检查表是否存在
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'alert_execution_logs'
        """))
        tables = [row[0] for row in result.fetchall()]
        logger.info(f"📊 已创建的表: {tables}")

        # 检查字段
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'alert_execution_logs'
            ORDER BY ordinal_position
        """))
        logger.info("📋 字段信息:")
        for row in result.fetchall():
            nullable_str = "NULL" if row[2] == 'YES' else "NOT NULL"
            logger.info(f"  - {row[0]}: {row[1]} ({nullable_str})")

        # 检查索引
        result = db.execute(text("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = 'alert_execution_logs'
            ORDER BY indexname
        """))
        logger.info("📇 已创建的索引:")
        for row in result.fetchall():
            logger.info(f"  - {row[0]}")

        logger.info("✅ 迁移完成！")

    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}")
        db.rollback()
        raise


def downgrade(db):
    """降级数据库 - 删除告警执行日志表"""
    logger.info("⬇️  开始回滚: 删除告警执行日志表")

    try:
        logger.info("🗑️  删除 alert_execution_logs 表...")
        db.execute(text("DROP TABLE IF EXISTS alert_execution_logs CASCADE"))
        db.commit()
        logger.info("✅ alert_execution_logs 表删除成功")

        logger.info("✅ 回滚完成")

    except Exception as e:
        logger.error(f"❌ 回滚失败: {e}")
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
    logger.info("🚀 开始执行数据库迁移: 创建告警执行日志表")
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
