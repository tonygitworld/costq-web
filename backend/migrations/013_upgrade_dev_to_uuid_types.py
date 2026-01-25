"""
Migration 013: 升级 DEV 环境表结构为 UUID 类型

目标：
- 将 DEV 环境的表结构升级为与 PROD 环境一致
- 主要变更：varchar ID → uuid ID
- 同时修复 audit_logs.created_at → timestamp

警告：
- 此迁移会删除所有数据
- 仅用于 DEV 环境
- 执行前请确认可以删除数据

变更内容：
1. organizations: id (varchar → uuid)
2. users: id, org_id (varchar → uuid)
3. aws_accounts: id, org_id (varchar → uuid)
4. gcp_accounts: id, org_id (varchar → uuid)
5. audit_logs: org_id 外键约束调整, created_at → timestamp
"""

from sqlalchemy import text
from backend.database import SessionLocal


def upgrade():
    """执行迁移：升级为 UUID 类型"""
    db = SessionLocal()
    try:
        print("⚠️  警告：此迁移将删除 DEV 环境所有数据！")
        print("🔄 开始执行 Migration 013...")
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

        # 2. 修改 organizations 表
        print("📝 步骤 2: 修改 organizations 表...")
        db.execute(text("TRUNCATE TABLE organizations CASCADE;"))
        db.execute(text("ALTER TABLE organizations ALTER COLUMN id TYPE uuid USING id::uuid;"))
        db.commit()
        print("   ✅ organizations.id: varchar → uuid")

        # 3. 修改 users 表
        print("📝 步骤 3: 修改 users 表...")
        db.execute(text("TRUNCATE TABLE users CASCADE;"))
        db.execute(text("ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid;"))
        db.execute(text("ALTER TABLE users ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
        db.commit()
        print("   ✅ users.id: varchar → uuid")
        print("   ✅ users.org_id: varchar → uuid")

        # 4. 修改 aws_accounts 表
        print("📝 步骤 4: 修改 aws_accounts 表...")
        db.execute(text("TRUNCATE TABLE aws_accounts CASCADE;"))
        db.execute(text("ALTER TABLE aws_accounts ALTER COLUMN id TYPE uuid USING id::uuid;"))
        db.execute(text("ALTER TABLE aws_accounts ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
        db.commit()
        print("   ✅ aws_accounts.id: varchar → uuid")
        print("   ✅ aws_accounts.org_id: varchar → uuid")

        # 5. 修改 gcp_accounts 表（如果存在）
        print("📝 步骤 5: 修改 gcp_accounts 表...")
        try:
            db.execute(text("TRUNCATE TABLE gcp_accounts CASCADE;"))
            db.execute(text("ALTER TABLE gcp_accounts ALTER COLUMN id TYPE uuid USING id::uuid;"))
            db.execute(text("ALTER TABLE gcp_accounts ALTER COLUMN org_id TYPE uuid USING org_id::uuid;"))
            db.commit()
            print("   ✅ gcp_accounts.id: varchar → uuid")
            print("   ✅ gcp_accounts.org_id: varchar → uuid")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  gcp_accounts 表不存在或已是正确类型: {e}")

        # 6. 修改 audit_logs 表的 org_id 和 timestamp
        print("📝 步骤 6: 修改 audit_logs 表...")
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
        print("   ✅ audit_logs.org_id: varchar → uuid (NOT NULL)")

        # 7. 重建外键约束
        print("📝 步骤 7: 重建外键约束...")

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

        db.commit()

        print()
        print("=" * 60)
        print("✅ Migration 013: DEV 环境升级为 UUID 类型成功！")
        print("=" * 60)
        print()
        print("📋 变更总结:")
        print("  • organizations.id: varchar → uuid")
        print("  • users.id: varchar → uuid")
        print("  • users.org_id: varchar → uuid")
        print("  • aws_accounts.id: varchar → uuid")
        print("  • aws_accounts.org_id: varchar → uuid")
        print("  • gcp_accounts.id: varchar → uuid")
        print("  • gcp_accounts.org_id: varchar → uuid")
        print("  • audit_logs.org_id: varchar → uuid")
        print("  • audit_logs.created_at → timestamp (如果存在)")
        print("  • 重建所有外键约束")
        print()
        print("⚠️  注意：所有表数据已清空！")

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
    print("   原因：数据已删除，无法恢复")
    print("   建议：重新初始化数据库")
    raise NotImplementedError("此迁移不支持回滚，请重新初始化数据库")


if __name__ == "__main__":
    print("🚀 执行 Migration 013: 升级 DEV 环境为 UUID 类型")
    print()

    # 确认提示
    import sys
    print("⚠️  警告：")
    print("   1. 此操作将删除 DEV 环境所有数据")
    print("   2. 此操作不可回滚")
    print("   3. 请确保已备份重要数据")
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

    response = input("确认执行迁移？(yes/no): ")
    if response.lower() != 'yes':
        print("❌ 迁移已取消")
        sys.exit(0)

    print()
    upgrade()
