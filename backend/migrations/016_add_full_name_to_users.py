"""
users 表新增 full_name 字段
"""

from sqlalchemy import text


def upgrade(session):
    """执行迁移"""
    print("开始执行 users 表新增 full_name 字段迁移...")

    session.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)
    """))
    session.commit()
    print("   ✅ full_name 字段添加成功")


def downgrade(session):
    """回滚迁移"""
    session.execute(text("""
        ALTER TABLE users
        DROP COLUMN IF EXISTS full_name
    """))
    session.commit()
    print("   ✅ full_name 字段已删除")
