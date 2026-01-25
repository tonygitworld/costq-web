#!/usr/bin/env python3
"""
数据库迁移: 为 monitoring_configs 添加账号关联字段 (PostgreSQL)

添加字段:
- account_id: 关联的账号ID（AWS或GCP账号的UUID）
- account_type: 账号类型（aws 或 gcp）

运行方式:
    python backend/migrations/009_add_account_to_monitoring.py
"""

from loguru import logger
from sqlalchemy import text


def upgrade(db):
    """升级数据库 - 添加账号关联字段"""
    logger.info("⬆️  开始迁移: 为 monitoring_configs 添加账号关联字段")

    try:
        # ============ 1. 检查字段是否已存在 ============
        logger.info("🔍 检查字段是否已存在...")
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'monitoring_configs'
            AND column_name IN ('account_id', 'account_type')
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        logger.info(f"📋 已存在的字段: {existing_columns}")

        # ============ 2. 添加 account_id 字段 ============
        if 'account_id' not in existing_columns:
            logger.info("➕ 添加 account_id 字段...")
            db.execute(text("""
                ALTER TABLE monitoring_configs
                ADD COLUMN account_id VARCHAR(36)
            """))
            db.commit()
            logger.info("✅ account_id 字段添加成功")
        else:
            logger.info("⏭️  account_id 字段已存在，跳过")

        # ============ 3. 添加 account_type 字段 ============
        if 'account_type' not in existing_columns:
            logger.info("➕ 添加 account_type 字段...")
            db.execute(text("""
                ALTER TABLE monitoring_configs
                ADD COLUMN account_type VARCHAR(10)
            """))
            db.commit()
            logger.info("✅ account_type 字段添加成功")
        else:
            logger.info("⏭️  account_type 字段已存在，跳过")

        # ============ 4. 创建索引 ============
        logger.info("📇 创建索引...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monitoring_account_id
            ON monitoring_configs(account_id)
        """))
        db.commit()
        logger.info("✅ 索引创建成功")

        # ============ 5. 验证迁移结果 ============
        logger.info("🔍 验证迁移结果...")
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'monitoring_configs'
            AND column_name IN ('account_id', 'account_type')
            ORDER BY column_name
        """))
        logger.info("📊 字段信息:")
        for row in result.fetchall():
            logger.info(f"  - {row[0]}: {row[1]} (nullable: {row[2]})")

        logger.info("✅ 迁移完成！")

    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}")
        db.rollback()
        raise


def downgrade(db):
    """降级数据库 - 删除账号关联字段"""
    logger.info("⬇️  开始回滚: 删除账号关联字段")

    try:
        # 删除索引
        logger.info("🗑️  删除索引...")
        db.execute(text("DROP INDEX IF EXISTS idx_monitoring_account_id"))
        db.commit()
        logger.info("✅ 索引删除成功")

        # 删除字段
        logger.info("🗑️  删除 account_type 字段...")
        db.execute(text("""
            ALTER TABLE monitoring_configs
            DROP COLUMN IF EXISTS account_type
        """))
        db.commit()
        logger.info("✅ account_type 字段删除成功")

        logger.info("🗑️  删除 account_id 字段...")
        db.execute(text("""
            ALTER TABLE monitoring_configs
            DROP COLUMN IF EXISTS account_id
        """))
        db.commit()
        logger.info("✅ account_id 字段删除成功")

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
    logger.info("🚀 开始执行数据库迁移: 添加账号关联字段")
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
