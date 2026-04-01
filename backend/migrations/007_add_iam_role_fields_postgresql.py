#!/usr/bin/env python3
"""
数据库迁移: 添加 IAM Role 支持字段到 aws_accounts 表 (PostgreSQL)

添加字段:
- auth_type: 认证类型 ('aksk' 或 'iam_role')
- role_arn: IAM Role ARN
- session_duration: 会话持续时间（秒）

运行方式:
    python backend/migrations/007_add_iam_role_fields_postgresql.py
"""

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

def upgrade(db):
    """升级数据库 - 添加 IAM Role 字段"""
    logger.info("⬆️  开始迁移: 添加 IAM Role 支持字段到 aws_accounts 表")

    try:
        # 1. 检查字段是否已存在
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'aws_accounts'
        """))
        existing_columns = {row[0] for row in result.fetchall()}

        logger.info(f"📋 当前 aws_accounts 表字段: {existing_columns}")

        # 2. 添加 auth_type 字段
        if 'auth_type' not in existing_columns:
            logger.info("➕ 添加 auth_type 字段...")
            db.execute(text("""
                ALTER TABLE aws_accounts
                ADD COLUMN auth_type VARCHAR(20) DEFAULT 'aksk'
            """))
            db.commit()
            logger.info("✅ auth_type 字段添加成功")
        else:
            logger.info("ℹ️  auth_type 字段已存在，跳过")

        # 3. 添加 role_arn 字段
        if 'role_arn' not in existing_columns:
            logger.info("➕ 添加 role_arn 字段...")
            db.execute(text("""
                ALTER TABLE aws_accounts
                ADD COLUMN role_arn VARCHAR(2048)
            """))
            db.commit()
            logger.info("✅ role_arn 字段添加成功")
        else:
            logger.info("ℹ️  role_arn 字段已存在，跳过")

        # 4. 添加 session_duration 字段
        if 'session_duration' not in existing_columns:
            logger.info("➕ 添加 session_duration 字段...")
            db.execute(text("""
                ALTER TABLE aws_accounts
                ADD COLUMN session_duration INTEGER DEFAULT 3600
            """))
            db.commit()
            logger.info("✅ session_duration 字段添加成功")
        else:
            logger.info("ℹ️  session_duration 字段已存在，跳过")

        # 5. 更新现有记录的 auth_type
        logger.info("🔄 更新现有记录的 auth_type...")
        result = db.execute(text("""
            UPDATE aws_accounts
            SET auth_type = 'aksk'
            WHERE auth_type IS NULL OR auth_type = ''
        """))
        db.commit()
        updated_count = result.rowcount
        logger.info(f"✅ 更新了 {updated_count} 条记录的 auth_type")

        # 6. 创建索引
        logger.info("📇 创建 auth_type 索引...")
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aws_accounts_auth_type
                ON aws_accounts(auth_type)
            """))
            db.commit()
            logger.info("✅ auth_type 索引创建成功")
        except Exception as e:
            logger.warning("⚠️  索引可能已存在: %s", e)

        # 7. 验证迁移结果
        logger.info("🔍 验证迁移结果...")
        result = db.execute(text("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'aws_accounts'
            AND column_name IN ('auth_type', 'role_arn', 'session_duration')
            ORDER BY column_name
        """))

        logger.info("📊 新增字段信息:")
        for row in result.fetchall():
            logger.info("  - %s: %s (默认值: %s)", row[0], row[1], row[2])

        logger.info("✅ 迁移完成！")

    except Exception as e:
        logger.error("❌ 迁移失败: %s", e)
        db.rollback()
        raise


def downgrade(db):
    """降级数据库 - 删除 IAM Role 字段"""
    logger.info("⬇️  开始回滚: 删除 IAM Role 支持字段")

    try:
        # 删除索引
        logger.info("🗑️  删除索引...")
        db.execute(text("DROP INDEX IF EXISTS idx_aws_accounts_auth_type"))
        db.commit()

        # 删除字段
        logger.info("🗑️  删除字段...")
        db.execute(text("ALTER TABLE aws_accounts DROP COLUMN IF EXISTS auth_type"))
        db.execute(text("ALTER TABLE aws_accounts DROP COLUMN IF EXISTS role_arn"))
        db.execute(text("ALTER TABLE aws_accounts DROP COLUMN IF EXISTS session_duration"))
        db.commit()

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
    logger.info("🚀 开始执行数据库迁移")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        upgrade(db)
        logger.info("\n" + "=" * 60)
        logger.info("✅ 迁移执行成功！")
        logger.info("=" * 60)
    except Exception as e:
        logger.error("\n❌ 迁移执行失败: %s", e)
        db.rollback()
        raise
    finally:
        db.close()
