"""
Migration 012: 重命名 audit_logs.created_at 为 timestamp

解决问题：
- 数据库字段名 created_at
- 代码模型使用 timestamp
- 导致所有审计日志写入失败

修改内容：
- 重命名 audit_logs.created_at → timestamp
"""

from sqlalchemy import text
from backend.database import SessionLocal


def upgrade():
    """执行迁移：重命名字段"""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE audit_logs RENAME COLUMN created_at TO timestamp;"
        ))
        db.commit()
        print("✅ Migration 012: 字段重命名成功 (created_at → timestamp)")
    except Exception as e:
        db.rollback()
        print(f"❌ Migration 012 失败: {e}")
        raise
    finally:
        db.close()


def downgrade():
    """回滚迁移：恢复字段名"""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE audit_logs RENAME COLUMN timestamp TO created_at;"
        ))
        db.commit()
        print("✅ Migration 012 回滚成功 (timestamp → created_at)")
    except Exception as e:
        db.rollback()
        print(f"❌ Migration 012 回滚失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🔄 执行 Migration 012: 重命名 audit_logs 字段...")
    upgrade()
