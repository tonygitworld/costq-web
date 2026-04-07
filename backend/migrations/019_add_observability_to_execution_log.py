#!/usr/bin/env python3
"""
数据库迁移: 为 alert_execution_logs 表新增可观测性字段

新增字段:
- runtime_session_id VARCHAR(128): AgentCore Runtime 会话 ID
- token_usage JSONB: Token 用量统计（input_tokens, output_tokens 等）
- model_id VARCHAR(200): 本次执行使用的 Bedrock 模型 ID
"""

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def upgrade(db):
    """升级数据库"""
    logger.info("⬆️ 开始迁移: 为 alert_execution_logs 新增可观测性字段")

    try:
        db.execute(text("""
            ALTER TABLE alert_execution_logs
            ADD COLUMN IF NOT EXISTS runtime_session_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS token_usage JSONB,
            ADD COLUMN IF NOT EXISTS model_id VARCHAR(200)
        """))

        db.commit()

        # 验证三个字段均已存在
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'alert_execution_logs'
              AND column_name IN ('runtime_session_id', 'token_usage', 'model_id')
            ORDER BY column_name
        """))
        found = {row[0] for row in result}
        expected = {"runtime_session_id", "token_usage", "model_id"}
        missing = expected - found
        if missing:
            raise RuntimeError(f"迁移验证失败，以下字段未创建成功: {missing}")

        logger.info("✅ alert_execution_logs 可观测性字段新增成功: %s", sorted(found))

    except Exception as e:
        logger.error("❌ 迁移失败: %s", e)
        db.rollback()
        raise


def downgrade(db):
    """回滚数据库"""
    logger.info("⬇️ 回滚: 删除 alert_execution_logs 可观测性字段")
    try:
        db.execute(text("""
            ALTER TABLE alert_execution_logs
            DROP COLUMN IF EXISTS runtime_session_id,
            DROP COLUMN IF EXISTS token_usage,
            DROP COLUMN IF EXISTS model_id
        """))
        db.commit()
        logger.info("✅ 可观测性字段回滚完成")
    except Exception as e:
        logger.error("❌ 回滚失败: %s", e)
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
