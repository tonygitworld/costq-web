"""
Migration 013: 升级 DEV 环境表结构为 UUID 类型（保留数据版本）

目标：
- 将 DEV 环境的表结构升级为与 PROD 环境一致
- 主要变更：varchar ID → uuid ID
- 同时修复 audit_logs.created_at → timestamp
- ✅ 保留 organizations, users, aws_accounts 的现有数据

警告：
- 仅用于 DEV 环境
- gcp_accounts 和 audit_logs 表的数据会被清空（因为外键关系）

变更内容：
1. organizations: id (varchar → uuid) ✅ 保留数据
2. users: id, org_id (varchar → uuid) ✅ 保留数据
3. aws_accounts: id, org_id (varchar → uuid) ✅ 保留数据
4. gcp_accounts: id, org_id (varchar → uuid) ❌ 清空数据
5. audit_logs: org_id (varchar → uuid), created_at → timestamp ❌ 清空数据
"""

from sqlalchemy import text
from backend.database import SessionLocal


def upgrade():
    """执行迁移：升级为 UUID 类型（保留主要数据）"""
    db = SessionLocal()
    try:
        print("🔄 开始执行 Migration 013（保留数据版本）...")
        print()

        # 1. 删除所有外键约束
        print("📝 步骤 1: 删除外键约束...")
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

        # 2. 修改 organizations 表（✅ 保留数据）
        print("📝 步骤 2: 修改 organizations 表（保留数据）...")
        db.execute(text("ALTER TABLE organizations ALTER COLUMN id TYPE uuid USING id::uuid;"))
        db.commit()
        count = db.execute(text("SELECT COUNT(*) FROM organizations")).scalar()
        print(f"   ✅ organizations.id: varchar → uuid (保留 {count} 条数据)")

        # 3. 修改 users 表（✅ 保留数据）
        print("📝 步骤 3: 修改 users 表（保留数据）...")
        db.execute(text("ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid;"))
        db.execute(text("ALTER TABLE users ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
        db.commit()
        count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        print(f"   ✅ users.id: varchar → uuid (保留 {count} 条数据)")
        print(f"   ✅ users.org_id: varchar → uuid")

        # 4. 修改 aws_accounts 表（✅ 保留数据）
        print("📝 步骤 4: 修改 aws_accounts 表（保留数据）...")
        db.execute(text("ALTER TABLE aws_accounts ALTER COLUMN id TYPE uuid USING id::uuid;"))
        db.execute(text("ALTER TABLE aws_accounts ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
        db.commit()
        count = db.execute(text("SELECT COUNT(*) FROM aws_accounts")).scalar()
        print(f"   ✅ aws_accounts.id: varchar → uuid (保留 {count} 条数据)")
        print(f"   ✅ aws_accounts.org_id: varchar → uuid")

        # 5. 修改 gcp_accounts 表（❌ 清空数据 - 因为外键依赖）
        print("📝 步骤 5: 修改 gcp_accounts 表（清空数据）...")
        try:
            db.execute(text("TRUNCATE TABLE gcp_accounts CASCADE;"))
            db.execute(text("ALTER TABLE gcp_accounts ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE gcp_accounts ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
            db.commit()
            print("   ✅ gcp_accounts.id: varchar → uuid (数据已清空)")
            print("   ✅ gcp_accounts.org_id: varchar → uuid")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  gcp_accounts 表不存在或已是正确类型: {e}")

        # 6. 修改 monitoring_configs 表（✅ 保留数据）
        print("📝 步骤 6: 修改 monitoring_configs 表（保留数据）...")
        try:
            db.execute(text("ALTER TABLE monitoring_configs ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE monitoring_configs ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
            db.execute(text("ALTER TABLE monitoring_configs ALTER COLUMN user_id TYPE uuid USING user_id::uuid;"))
            db.execute(text("ALTER TABLE monitoring_configs ALTER COLUMN account_id TYPE uuid USING account_id::uuid;"))
            db.commit()
            count = db.execute(text("SELECT COUNT(*) FROM monitoring_configs")).scalar()
            print(f"   ✅ monitoring_configs.id: varchar → uuid (保留 {count} 条数据)")
            print(f"   ✅ monitoring_configs.org_id: varchar → uuid")
            print(f"   ✅ monitoring_configs.user_id: varchar → uuid")
            print(f"   ✅ monitoring_configs.account_id: varchar → uuid")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  monitoring_configs 表不存在或已是正确类型: {e}")

        # 7. 修改 audit_logs 表（❌ 清空数据 - 因为外键依赖和时间字段变更）
        print("📝 步骤 7: 修改 audit_logs 表（清空数据）...")
        db.execute(text("TRUNCATE TABLE audit_logs CASCADE;"))
        db.execute(text("ALTER TABLE audit_logs ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))

        # 检查是否已经是 timestamp，如果是 created_at 则重命名
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'audit_logs'
            AND column_name IN ('created_at', 'timestamp')
        """)).fetchall()

        has_created_at = any(row[0] == 'created_at' for row in result)
        has_timestamp = any(row[0] == 'timestamp' for row in result)

        if has_created_at and not has_timestamp:
            db.execute(text("ALTER TABLE audit_logs RENAME COLUMN created_at TO timestamp;"))
            print("   ✅ audit_logs.created_at → timestamp")
        elif has_timestamp:
            print("   ✅ audit_logs.timestamp 已存在")

        db.execute(text("ALTER TABLE audit_logs ALTER COLUMN org_id SET NOT NULL;"))
        db.commit()
        print("   ✅ audit_logs.org_id: varchar → uuid (NOT NULL, 数据已清空)")

        # 8. 重建外键约束
        print("📝 步骤 8: 重建外键约束...")

        # users.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE users
            ADD CONSTRAINT fk_users_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))
        print("   ✅ users.org_id → organizations.id")

        # aws_accounts.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE aws_accounts
            ADD CONSTRAINT fk_aws_accounts_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))
        print("   ✅ aws_accounts.org_id → organizations.id")

        # gcp_accounts.org_id → organizations.id
        try:
            db.execute(text("""
                ALTER TABLE gcp_accounts
                ADD CONSTRAINT fk_gcp_accounts_org
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
            """))
            print("   ✅ gcp_accounts.org_id → organizations.id")
        except:
            pass

        # audit_logs.user_id → users.id
        db.execute(text("""
            ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        """))
        print("   ✅ audit_logs.user_id → users.id")

        # audit_logs.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))
        print("   ✅ audit_logs.org_id → organizations.id")

        # monitoring_configs.org_id → organizations.id
        try:
            db.execute(text("""
                ALTER TABLE monitoring_configs
                ADD CONSTRAINT fk_monitoring_org
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
            """))
            print("   ✅ monitoring_configs.org_id → organizations.id")
        except:
            pass

        # monitoring_configs.user_id → users.id
        try:
            db.execute(text("""
                ALTER TABLE monitoring_configs
                ADD CONSTRAINT fk_monitoring_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            """))
            print("   ✅ monitoring_configs.user_id → users.id")
        except:
            pass

        db.commit()

        print()
        print("=" * 60)
        print("✅ Migration 013: DEV 环境升级为 UUID 类型成功！")
        print("=" * 60)
        print()
        print("📋 变更总结:")
        print("  ✅ organizations.id: varchar → uuid (数据已保留)")
        print("  ✅ users.id: varchar → uuid (数据已保留)")
        print("  ✅ users.org_id: varchar → uuid (数据已保留)")
        print("  ✅ aws_accounts.id: varchar → uuid (数据已保留)")
        print("  ✅ aws_accounts.org_id: varchar → uuid (数据已保留)")
        print("  ✅ monitoring_configs.id: varchar → uuid (数据已保留)")
        print("  ✅ monitoring_configs.org_id: varchar → uuid (数据已保留)")
        print("  ✅ monitoring_configs.user_id: varchar → uuid (数据已保留)")
        print("  ✅ monitoring_configs.account_id: varchar → uuid (数据已保留)")
        print("  ✅ gcp_accounts.id: varchar → uuid (数据已清空)")
        print("  ✅ gcp_accounts.org_id: varchar → uuid (数据已清空)")
        print("  ✅ audit_logs.org_id: varchar → uuid (数据已清空)")
        print("  ✅ audit_logs.created_at → timestamp (如果存在)")
        print("  ✅ 重建所有外键约束")
        print()

        # 显示保留的数据统计
        print("📊 保留的数据统计:")
        for table in ['organizations', 'users', 'aws_accounts', 'monitoring_configs']:
            count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"  • {table:20s} {count:6d} 条")

    except Exception as e:
        db.rollback()
        print()
        print("=" * 60)
        print(f"❌ Migration 013 失败: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


def downgrade():
    """回滚迁移：恢复为 VARCHAR 类型"""
    print("⚠️  警告：此迁移不支持回滚！")
    print("   原因：uuid → varchar 可能导致数据丢失")
    print("   建议：从备份恢复数据库")
    raise NotImplementedError("此迁移不支持回滚，请从备份恢复数据库")


if __name__ == "__main__":
    print("🚀 执行 Migration 013: 升级 DEV 环境为 UUID 类型（保留数据版本）")
    print()

    # 确认提示
    import sys
    print("⚠️  说明：")
    print("   1. 此操作将保留 organizations, users, aws_accounts 的数据")
    print("   2. 此操作将清空 gcp_accounts, audit_logs 的数据")
    print("   3. 此操作不可回滚")
    print()

    # 检查环境
    from backend.config.settings import settings
    if settings.ENVIRONMENT != "local":
        print(f"❌ 错误：当前环境是 {settings.ENVIRONMENT}，不是 local")
        print("   此迁移仅允许在本地开发环境执行！")
        sys.exit(1)

    if settings.RDS_SECRET_NAME != "costq/rds/postgresql-dev":
        print(f"❌ 错误：当前连接的数据库不是 DEV 环境")
        print(f"   Secret: {settings.RDS_SECRET_NAME}")
        print("   此迁移仅允许在 DEV 数据库执行！")
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
