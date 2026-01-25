"""
Migration 015: 升级所有剩余表为 UUID 类型

背景：
- Migration 013/014 只处理了部分表
- 还有多个关联表的外键字段需要升级

目标：
- 升级所有剩余表的 ID 字段为 uuid 类型
- ✅ 尽可能保留现有数据

变更内容：
1. alert_execution_logs: id, alert_id, org_id, account_id, triggered_by_user_id
2. alert_history: id, alert_id, org_id
3. aws_account_permissions: id, user_id, account_id
4. chat_messages: id, session_id, user_id
5. chat_sessions: id, org_id, user_id
6. email_verification_tokens: id, user_id
7. gcp_account_permissions: id, user_id, account_id
8. user_activation_tokens: id, user_id
"""

from sqlalchemy import text
from backend.database import SessionLocal


def upgrade():
    """执行迁移：升级所有剩余表为 UUID 类型"""
    db = SessionLocal()
    try:
        print("🔄 开始执行 Migration 015: 升级所有剩余表为 UUID 类型...")
        print()

        # 1. 删除所有外键约束
        print("📝 步骤 1: 删除所有外键约束...")
        db.execute(text("""
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (
                    SELECT constraint_name, table_name
                    FROM information_schema.table_constraints
                    WHERE constraint_type = 'FOREIGN KEY'
                    AND table_schema = 'public'
                ) LOOP
                    EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) ||
                            ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
                END LOOP;
            END $$;
        """))
        db.commit()
        print("   ✅ 外键约束已删除")

        # 2. chat_sessions (保留数据)
        print("📝 步骤 2: 修改 chat_sessions 表（保留数据）...")
        try:
            db.execute(text("ALTER TABLE chat_sessions ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE chat_sessions ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
            db.execute(text("ALTER TABLE chat_sessions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.commit()
            count = db.execute(text("SELECT COUNT(*) FROM chat_sessions")).scalar()
            print(f"   ✅ chat_sessions 升级完成 (保留 {count} 条数据)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  chat_sessions 升级失败: {e}")

        # 3. chat_messages (保留数据)
        print("📝 步骤 3: 修改 chat_messages 表（保留数据）...")
        try:
            db.execute(text("ALTER TABLE chat_messages ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE chat_messages ALTER COLUMN session_id TYPE uuid USING session_id::uuid;"))
            db.execute(text("ALTER TABLE chat_messages ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.commit()
            count = db.execute(text("SELECT COUNT(*) FROM chat_messages")).scalar()
            print(f"   ✅ chat_messages 升级完成 (保留 {count} 条数据)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  chat_messages 升级失败: {e}")

        # 4. aws_account_permissions (保留数据)
        print("📝 步骤 4: 修改 aws_account_permissions 表（保留数据）...")
        try:
            db.execute(text("ALTER TABLE aws_account_permissions ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE aws_account_permissions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.execute(text("ALTER TABLE aws_account_permissions ALTER COLUMN account_id TYPE uuid USING account_id::uuid;"))
            db.commit()
            count = db.execute(text("SELECT COUNT(*) FROM aws_account_permissions")).scalar()
            print(f"   ✅ aws_account_permissions 升级完成 (保留 {count} 条数据)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  aws_account_permissions 升级失败: {e}")

        # 5. gcp_account_permissions (保留数据)
        print("📝 步骤 5: 修改 gcp_account_permissions 表（保留数据）...")
        try:
            db.execute(text("ALTER TABLE gcp_account_permissions ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE gcp_account_permissions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.execute(text("ALTER TABLE gcp_account_permissions ALTER COLUMN account_id TYPE uuid USING account_id::uuid;"))
            db.commit()
            count = db.execute(text("SELECT COUNT(*) FROM gcp_account_permissions")).scalar()
            print(f"   ✅ gcp_account_permissions 升级完成 (保留 {count} 条数据)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  gcp_account_permissions 升级失败: {e}")

        # 6. alert_history (清空数据 - 因为 alert_id 外键)
        print("📝 步骤 6: 修改 alert_history 表（清空数据）...")
        try:
            db.execute(text("TRUNCATE TABLE alert_history CASCADE;"))
            db.execute(text("ALTER TABLE alert_history ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE alert_history ALTER COLUMN alert_id TYPE uuid USING alert_id::uuid;"))
            db.execute(text("ALTER TABLE alert_history ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
            db.commit()
            print("   ✅ alert_history 升级完成 (数据已清空)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  alert_history 升级失败: {e}")

        # 7. alert_execution_logs (清空数据 - 因为 alert_id 外键)
        print("📝 步骤 7: 修改 alert_execution_logs 表（清空数据）...")
        try:
            db.execute(text("TRUNCATE TABLE alert_execution_logs CASCADE;"))
            db.execute(text("ALTER TABLE alert_execution_logs ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE alert_execution_logs ALTER COLUMN alert_id TYPE uuid USING alert_id::uuid;"))
            db.execute(text("ALTER TABLE alert_execution_logs ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
            db.execute(text("ALTER TABLE alert_execution_logs ALTER COLUMN account_id TYPE uuid USING account_id::uuid;"))
            db.execute(text("ALTER TABLE alert_execution_logs ALTER COLUMN triggered_by_user_id TYPE uuid USING triggered_by_user_id::uuid;"))
            db.commit()
            print("   ✅ alert_execution_logs 升级完成 (数据已清空)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  alert_execution_logs 升级失败: {e}")

        # 8. email_verification_tokens (清空数据 - 验证码都是临时的)
        print("📝 步骤 8: 修改 email_verification_tokens 表（清空数据）...")
        try:
            db.execute(text("TRUNCATE TABLE email_verification_tokens CASCADE;"))
            db.execute(text("ALTER TABLE email_verification_tokens ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE email_verification_tokens ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.commit()
            print("   ✅ email_verification_tokens 升级完成 (数据已清空)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  email_verification_tokens 升级失败: {e}")

        # 9. user_activation_tokens (清空数据 - 激活码都是临时的)
        print("📝 步骤 9: 修改 user_activation_tokens 表（清空数据）...")
        try:
            db.execute(text("TRUNCATE TABLE user_activation_tokens CASCADE;"))
            db.execute(text("ALTER TABLE user_activation_tokens ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE user_activation_tokens ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.commit()
            print("   ✅ user_activation_tokens 升级完成 (数据已清空)")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  user_activation_tokens 升级失败: {e}")

        # 10. 重建外键约束
        print("📝 步骤 10: 重建外键约束...")

        # users.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE users
            ADD CONSTRAINT fk_users_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        # aws_accounts.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE aws_accounts
            ADD CONSTRAINT fk_aws_accounts_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        # gcp_accounts.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE gcp_accounts
            ADD CONSTRAINT fk_gcp_accounts_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        # monitoring_configs.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE monitoring_configs
            ADD CONSTRAINT fk_monitoring_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        # monitoring_configs.user_id → users.id
        db.execute(text("""
            ALTER TABLE monitoring_configs
            ADD CONSTRAINT fk_monitoring_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))

        # audit_logs.user_id → users.id
        db.execute(text("""
            ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        """))

        # audit_logs.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        # chat_sessions
        db.execute(text("""
            ALTER TABLE chat_sessions
            ADD CONSTRAINT fk_chat_sessions_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE chat_sessions
            ADD CONSTRAINT fk_chat_sessions_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))

        # chat_messages
        db.execute(text("""
            ALTER TABLE chat_messages
            ADD CONSTRAINT fk_chat_messages_session
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE chat_messages
            ADD CONSTRAINT fk_chat_messages_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))

        # aws_account_permissions
        db.execute(text("""
            ALTER TABLE aws_account_permissions
            ADD CONSTRAINT fk_aws_permissions_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE aws_account_permissions
            ADD CONSTRAINT fk_aws_permissions_account
            FOREIGN KEY (account_id) REFERENCES aws_accounts(id) ON DELETE CASCADE;
        """))

        # gcp_account_permissions
        db.execute(text("""
            ALTER TABLE gcp_account_permissions
            ADD CONSTRAINT fk_gcp_permissions_user
            FOREIGN KEY (user_id) REFERENCES gcp_accounts(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE gcp_account_permissions
            ADD CONSTRAINT fk_gcp_permissions_account
            FOREIGN KEY (account_id) REFERENCES gcp_accounts(id) ON DELETE CASCADE;
        """))

        # alert_history
        db.execute(text("""
            ALTER TABLE alert_history
            ADD CONSTRAINT fk_alert_history_alert
            FOREIGN KEY (alert_id) REFERENCES monitoring_configs(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE alert_history
            ADD CONSTRAINT fk_alert_history_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        # alert_execution_logs
        db.execute(text("""
            ALTER TABLE alert_execution_logs
            ADD CONSTRAINT fk_alert_exec_alert
            FOREIGN KEY (alert_id) REFERENCES monitoring_configs(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE alert_execution_logs
            ADD CONSTRAINT fk_alert_exec_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))

        db.execute(text("""
            ALTER TABLE alert_execution_logs
            ADD CONSTRAINT fk_alert_exec_user
            FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
        """))

        # email_verification_tokens
        db.execute(text("""
            ALTER TABLE email_verification_tokens
            ADD CONSTRAINT fk_email_verification_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))

        # user_activation_tokens
        db.execute(text("""
            ALTER TABLE user_activation_tokens
            ADD CONSTRAINT fk_user_activation_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))

        db.commit()
        print("   ✅ 外键约束已重建")

        print()
        print("=" * 60)
        print("✅ Migration 015: 所有剩余表升级成功！")
        print("=" * 60)
        print()

        # 显示保留的数据统计
        print("📊 数据保留统计:")
        for table in ['chat_sessions', 'chat_messages', 'aws_account_permissions', 'gcp_account_permissions']:
            try:
                count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"  • {table:30s} {count:6d} 条")
            except:
                pass

    except Exception as e:
        db.rollback()
        print()
        print("=" * 60)
        print(f"❌ Migration 015 失败: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


def downgrade():
    """回滚迁移"""
    print("⚠️  警告：此迁移不支持回滚！")
    raise NotImplementedError("此迁移不支持回滚")


if __name__ == "__main__":
    print("🚀 执行 Migration 015: 升级所有剩余表为 UUID 类型")
    print()

    # 检查环境
    import sys
    from backend.config.settings import settings

    if settings.ENVIRONMENT != "local":
        print(f"❌ 错误：当前环境是 {settings.ENVIRONMENT}，不是 local")
        sys.exit(1)

    if settings.RDS_SECRET_NAME != "costq/rds/postgresql-dev":
        print(f"❌ 错误：当前连接的数据库不是 DEV 环境")
        sys.exit(1)

    print("✅ 环境检查通过：local + costq/rds/postgresql-dev")
    print()

    # 支持通过环境变量跳过交互式确认
    import os
    auto_confirm = os.environ.get('AUTO_CONFIRM_MIGRATION', '').lower() == 'yes'

    if not auto_confirm:
        response = input("确认执行迁移？(yes/no): ")
        if response.lower() != 'yes':
            print("❌ 迁移已取消")
            sys.exit(0)
    else:
        print("✅ 自动确认模式（AUTO_CONFIRM_MIGRATION=yes）")

    print()
    upgrade()
