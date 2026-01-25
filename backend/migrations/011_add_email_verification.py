"""
邮箱验证功能迁移

功能：
1. users表新增 email_verified_at 字段
2. 创建 email_verification_codes 表（注册验证码）
3. 创建 user_activation_tokens 表（激活Token）
4. 现有用户自动标记为已验证
"""

from sqlalchemy import text
from datetime import datetime


def upgrade(session):
    """执行迁移"""
    print("开始执行邮箱验证功能迁移...")

    # ============ 1. users表新增字段 ============
    print("1. 在 users 表新增 email_verified_at 字段...")
    session.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE
    """))
    session.commit()
    print("   ✅ email_verified_at 字段添加成功")

    # ============ 2. 现有用户自动设置为已验证 ============
    print("2. 将现有用户标记为已验证...")
    result = session.execute(text("""
        UPDATE users
        SET email_verified_at = created_at
        WHERE email_verified_at IS NULL
    """))
    session.commit()
    updated_count = result.rowcount
    print(f"   ✅ 已更新 {updated_count} 个现有用户为已验证状态")

    # ============ 3. 创建验证码表 ============
    print("3. 创建 email_verification_codes 表...")
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS email_verification_codes (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            code VARCHAR(6) NOT NULL,
            purpose VARCHAR(20) NOT NULL DEFAULT 'register',
            attempts INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            verified_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);
        CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_codes(expires_at);
        CREATE INDEX IF NOT EXISTS idx_email_verification_created ON email_verification_codes(created_at);
    """))
    session.commit()
    print("   ✅ email_verification_codes 表创建成功")

    # ============ 4. 创建激活Token表 ============
    print("4. 创建 user_activation_tokens 表...")
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS user_activation_tokens (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            token VARCHAR(128) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            used_at TIMESTAMP WITH TIME ZONE,

            CONSTRAINT fk_activation_token_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_activation_token ON user_activation_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_activation_user_id ON user_activation_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_activation_expires ON user_activation_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_activation_created ON user_activation_tokens(created_at);
    """))
    session.commit()
    print("   ✅ user_activation_tokens 表创建成功")

    print("\n✅ 邮箱验证功能迁移完成！")
    print("\n数据库变更总结:")
    print("  - users 表: 新增 email_verified_at 字段")
    print(f"  - 现有用户: {updated_count} 个用户已自动标记为已验证")
    print("  - 新增表: email_verification_codes (验证码)")
    print("  - 新增表: user_activation_tokens (激活Token)")


def downgrade(session):
    """回滚迁移"""
    print("开始回滚邮箱验证功能迁移...")

    # 删除激活Token表
    print("1. 删除 user_activation_tokens 表...")
    session.execute(text("DROP TABLE IF EXISTS user_activation_tokens"))
    session.commit()
    print("   ✅ user_activation_tokens 表已删除")

    # 删除验证码表
    print("2. 删除 email_verification_codes 表...")
    session.execute(text("DROP TABLE IF EXISTS email_verification_codes"))
    session.commit()
    print("   ✅ email_verification_codes 表已删除")

    # 删除 email_verified_at 字段
    print("3. 删除 users.email_verified_at 字段...")
    session.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at"))
    session.commit()
    print("   ✅ email_verified_at 字段已删除")

    print("\n✅ 邮箱验证功能迁移已回滚！")


if __name__ == '__main__':
    """
    独立运行此脚本进行迁移

    使用方法:
        cd /path/to/project
        python -m backend.migrations.011_add_email_verification
    """
    import sys
    import os

    # 添加项目根目录到Python路径
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, project_root)

    from backend.database import get_db

    print("=" * 60)
    print("邮箱验证功能 - 数据库迁移脚本")
    print("=" * 60)

    session = next(get_db())

    try:
        upgrade(session)
        print("\n✅ 迁移成功！")
    except Exception as e:
        print(f"\n❌ 迁移失败: {str(e)}")
        import traceback
        traceback.print_exc()
        session.rollback()
        raise
    finally:
        session.close()
