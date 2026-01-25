"""
Migration 014: 修复 monitoring_configs 表的 UUID 类型

背景：
- Migration 013 遗漏了 monitoring_configs 表
- 导致外键类型不匹配错误

目标：
- 升级 monitoring_configs 表的所有 ID 字段为 uuid 类型
- ✅ 保留现有数据

变更内容：
1. monitoring_configs: id, org_id, user_id, account_id (varchar → uuid)
2. 重建外键约束
"""

from sqlalchemy import text
from backend.database import SessionLocal


def upgrade():
    """执行迁移：升级 monitoring_configs 为 UUID 类型"""
    db = SessionLocal()
    try:
        print("🔄 开始执行 Migration 014: 修复 monitoring_configs UUID 类型...")
        print()

        # 1. 删除 monitoring_configs 的外键约束
        print("📝 步骤 1: 删除 monitoring_configs 外键约束...")
        db.execute(text("""
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (
                    SELECT constraint_name
                    FROM information_schema.table_constraints
                    WHERE constraint_type = 'FOREIGN KEY'
                    AND table_schema = 'public'
                    AND table_name = 'monitoring_configs'
                ) LOOP
                    EXECUTE 'ALTER TABLE monitoring_configs DROP CONSTRAINT IF EXISTS ' ||
                            quote_ident(r.constraint_name) || ' CASCADE';
                END LOOP;
            END $$;
        """))
        db.commit()
        print("   ✅ 外键约束已删除")

        # 2. 修改 monitoring_configs 表（✅ 保留数据）
        print("📝 步骤 2: 修改 monitoring_configs 表字段类型（保留数据）...")

        # 检查当前类型
        result = db.execute(text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'monitoring_configs'
            AND column_name IN ('id', 'org_id', 'user_id', 'account_id')
        """)).fetchall()

        fields_to_convert = []
        for row in result:
            if row[1] != 'uuid':
                fields_to_convert.append(row[0])

        if fields_to_convert:
            for field in fields_to_convert:
                db.execute(text(f"ALTER TABLE monitoring_configs ALTER COLUMN {field} TYPE uuid USING {field}::uuid;"))
                print(f"   ✅ monitoring_configs.{field}: varchar → uuid")
            db.commit()

            count = db.execute(text("SELECT COUNT(*) FROM monitoring_configs")).scalar()
            print(f"   ✅ 保留 {count} 条数据")
        else:
            print("   ✅ 所有字段已经是 uuid 类型，无需转换")

        # 3. 重建外键约束
        print("📝 步骤 3: 重建外键约束...")

        # monitoring_configs.org_id → organizations.id
        db.execute(text("""
            ALTER TABLE monitoring_configs
            ADD CONSTRAINT fk_monitoring_org
            FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        """))
        print("   ✅ monitoring_configs.org_id → organizations.id")

        # monitoring_configs.user_id → users.id
        db.execute(text("""
            ALTER TABLE monitoring_configs
            ADD CONSTRAINT fk_monitoring_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """))
        print("   ✅ monitoring_configs.user_id → users.id")

        db.commit()

        print()
        print("=" * 60)
        print("✅ Migration 014: monitoring_configs UUID 修复成功！")
        print("=" * 60)
        print()

    except Exception as e:
        db.rollback()
        print()
        print("=" * 60)
        print(f"❌ Migration 014 失败: {e}")
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
    raise NotImplementedError("此迁移不支持回滚")


if __name__ == "__main__":
    print("🚀 执行 Migration 014: 修复 monitoring_configs UUID 类型")
    print()

    # 检查环境
    import sys
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
