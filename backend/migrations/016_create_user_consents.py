"""Migration 016: 创建 user_consents 表

Usage:
    python -m backend.migrations.016_create_user_consents
"""

from sqlalchemy import text

from backend.database import get_session_local


def run_migration():
    """执行迁移"""
    db = get_session_local()()
    try:
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS user_consents (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    consent_type VARCHAR(50) NOT NULL,
                    consent_version VARCHAR(20) NOT NULL,
                    agreed_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT
                )
                """
            )
        )
        db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_consent_user_type
                ON user_consents(user_id, consent_type)
                """
            )
        )
        db.commit()
        print("✅ Migration 016: user_consents 表创建成功")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ Migration 016 失败: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("🔄 执行 Migration 016: 创建 user_consents 表...")
    success = run_migration()
    raise SystemExit(0 if success else 1)
