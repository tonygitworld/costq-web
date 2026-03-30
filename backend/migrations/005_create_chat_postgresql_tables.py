"""
数据库迁移：在PostgreSQL中创建聊天会话和消息表

此脚本：
1. ✅ 在PostgreSQL中创建 chat_sessions 表（空表）
2. ✅ 在PostgreSQL中创建 chat_messages 表（空表）
3. ✅ 创建索引以优化查询性能
4. ✅ 创建触发器以自动更新统计信息

此脚本不做：
1. ❌ 不从SQLite读取数据
2. ❌ 不从LocalStorage读取数据
3. ❌ 不迁移任何现有数据

适用环境：Dev和Production的PostgreSQL数据库
"""

import os
import sys
import logging

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from sqlalchemy import text

logger = logging.getLogger(__name__)


def upgrade(db):
    """在PostgreSQL中创建聊天相关表（空表）"""

    # ========================================
    # 1. 检查表是否已存在
    # ========================================
    logger.info("🔍 检查 chat_sessions 表是否存在...")
    result = db.execute(text("""
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'chat_sessions'
    """))

    exists = result.scalar() > 0

    if exists:
        logger.info("✅ chat_sessions 表已存在，跳过创建")
        return

    logger.info("📝 开始创建 PostgreSQL 聊天表...")

    # ========================================
    # 2. 创建 chat_sessions 表
    # ========================================
    logger.info("📝 正在创建 chat_sessions 表...")

    db.execute(text("""
        CREATE TABLE chat_sessions (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            org_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

            -- 基本信息
            title VARCHAR(255) NOT NULL DEFAULT '新对话',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_message_at TIMESTAMP,

            -- 统计信息
            message_count INTEGER DEFAULT 0 NOT NULL,
            total_tokens INTEGER DEFAULT 0 NOT NULL,

            -- 配置信息
            model_config JSONB DEFAULT '{}'::jsonb
        )
    """))

    logger.info("✅ chat_sessions 表创建完成（空表，0条记录）")

    # ========================================
    # 3. 创建 chat_messages 表
    # ========================================
    logger.info("📝 正在创建 chat_messages 表...")

    db.execute(text("""
        CREATE TABLE chat_messages (
            id VARCHAR(36) PRIMARY KEY,
            session_id VARCHAR(36) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

            -- 消息内容
            role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

            -- Token统计
            token_count INTEGER,

            -- 工具调用（JSONB格式）
            tool_calls JSONB,
            tool_results JSONB,

            -- 元数据（使用message_metadata避免与保留字冲突）
            message_metadata JSONB DEFAULT '{}'::jsonb
        )
    """))

    logger.info("✅ chat_messages 表创建完成（空表，0条记录）")

    # ========================================
    # 4. 创建索引（性能优化）
    # ========================================
    logger.info("📝 正在创建索引...")

    # chat_sessions 索引
    db.execute(text("""
        CREATE INDEX idx_sessions_user_updated
        ON chat_sessions(user_id, updated_at DESC)
    """))
    logger.info("✅ 创建索引: idx_sessions_user_updated")

    db.execute(text("""
        CREATE INDEX idx_sessions_org
        ON chat_sessions(org_id)
    """))
    logger.info("✅ 创建索引: idx_sessions_org")

    db.execute(text("""
        CREATE INDEX idx_sessions_last_message
        ON chat_sessions(last_message_at DESC NULLS LAST)
    """))
    logger.info("✅ 创建索引: idx_sessions_last_message")

    # chat_messages 索引
    db.execute(text("""
        CREATE INDEX idx_messages_session_time
        ON chat_messages(session_id, created_at ASC)
    """))
    logger.info("✅ 创建索引: idx_messages_session_time")

    db.execute(text("""
        CREATE INDEX idx_messages_user
        ON chat_messages(user_id)
    """))
    logger.info("✅ 创建索引: idx_messages_user")

    db.execute(text("""
        CREATE INDEX idx_messages_created
        ON chat_messages(created_at DESC)
    """))
    logger.info("✅ 创建索引: idx_messages_created")

    # ========================================
    # 5. 创建触发器（自动更新统计）
    # ========================================
    logger.info("📝 正在创建触发器...")

    # 创建触发器函数
    db.execute(text("""
        CREATE OR REPLACE FUNCTION update_session_stats()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE chat_sessions
            SET
                message_count = message_count + 1,
                last_message_at = NEW.created_at,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.session_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))
    logger.info("✅ 创建触发器函数: update_session_stats()")

    # 删除可能存在的旧触发器
    db.execute(text("""
        DROP TRIGGER IF EXISTS trg_update_session_stats ON chat_messages
    """))

    # 创建触发器
    db.execute(text("""
        CREATE TRIGGER trg_update_session_stats
        AFTER INSERT ON chat_messages
        FOR EACH ROW
        EXECUTE FUNCTION update_session_stats()
    """))
    logger.info("✅ 创建触发器: trg_update_session_stats")

    # ========================================
    # 6. 提交更改
    # ========================================
    db.commit()

    logger.info("🎉 PostgreSQL 聊天表创建完成！")
    logger.info("📊 当前状态：")
    logger.info("   - chat_sessions: 0 条记录（准备接收新数据）")
    logger.info("   - chat_messages: 0 条记录（准备接收新数据）")
    logger.info("   ✅ 系统已就绪，可以开始保存聊天历史")


def downgrade(db):
    """删除聊天相关表（回滚）"""

    logger.warning("⚠️  正在删除聊天相关表...")

    # 删除触发器
    db.execute(text("DROP TRIGGER IF EXISTS trg_update_session_stats ON chat_messages"))
    logger.info("🗑️  删除触发器: trg_update_session_stats")

    # 删除函数
    db.execute(text("DROP FUNCTION IF EXISTS update_session_stats()"))
    logger.info("🗑️  删除函数: update_session_stats()")

    # 删除表（级联）
    db.execute(text("DROP TABLE IF EXISTS chat_messages CASCADE"))
    logger.info("🗑️  删除表: chat_messages")

    db.execute(text("DROP TABLE IF EXISTS chat_sessions CASCADE"))
    logger.info("🗑️  删除表: chat_sessions")

    db.commit()
    logger.info("✅ 回滚完成")


if __name__ == "__main__":
    """
    直接执行此脚本以运行迁移

    用法:
        # Dev环境（本地连接云上dev数据库）
        python backend/migrations/005_create_chat_postgresql_tables.py

        # 生产环境（在Pod中执行）
        kubectl exec -n costq <pod-name> -c app -- \
            python backend/migrations/005_create_chat_postgresql_tables.py
    """

    from backend.database import get_db

    logger.info("=" * 60)
    logger.info("PostgreSQL 聊天表迁移脚本")
    logger.info("=" * 60)

    db = next(get_db())

    try:
        upgrade(db)
        logger.info("✅ 迁移成功完成")
        sys.exit(0)

    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()

        # 尝试回滚
        try:
            db.rollback()
            logger.info("✅ 事务已回滚")
        except Exception as rollback_error:
            logger.error(f"❌ 回滚失败: {rollback_error}")

        sys.exit(1)

    finally:
        db.close()
