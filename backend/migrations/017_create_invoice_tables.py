"""Migration 017: 创建 Invoice 相关表

创建 invoices、invoice_line_items、organization_billing_profiles 三张表。

Usage:
    python -m backend.migrations.017_create_invoice_tables
"""

from sqlalchemy import text

from backend.database import get_session_local


def run_migration():
    """执行迁移"""
    db = get_session_local()()
    try:
        # 1. 创建 invoices 表
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS invoices (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL
                        REFERENCES organizations(id),
                    invoice_number VARCHAR(30) NOT NULL UNIQUE,
                    version INT NOT NULL DEFAULT 1,
                    period_year INT NOT NULL,
                    period_month INT NOT NULL,
                    cloud_cost_total NUMERIC(15,2) NOT NULL DEFAULT 0,
                    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
                    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
                    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
                    costq_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
                    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                    status VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'generated', 'failed', 'voided'
                        )),
                    error_code VARCHAR(50),
                    error_message TEXT,
                    s3_path VARCHAR(500),
                    generated_at TIMESTAMP WITH TIME ZONE,
                    generated_by UUID NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE
                        NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                        NOT NULL DEFAULT NOW(),
                    UNIQUE (
                        organization_id, period_year,
                        period_month, version
                    )
                )
                """
            )
        )
        print("  ✅ invoices 表创建成功")

        # invoices 索引
        db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_invoices_org_period_status
                ON invoices(
                    organization_id, period_year, period_month, status
                )
                """
            )
        )
        db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_invoices_status
                ON invoices(status)
                """
            )
        )
        db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_invoices_number
                ON invoices(invoice_number)
                """
            )
        )
        print("  ✅ invoices 索引创建成功")

        # 2. 创建 invoice_line_items 表
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS invoice_line_items (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    invoice_id UUID NOT NULL
                        REFERENCES invoices(id) ON DELETE CASCADE,
                    account_id UUID NOT NULL,
                    account_name VARCHAR(255),
                    provider_account_id VARCHAR(50),
                    provider VARCHAR(10) NOT NULL DEFAULT 'aws',
                    cost_amount NUMERIC(15,2) NOT NULL,
                    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                    created_at TIMESTAMP WITH TIME ZONE
                        NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_line_items_invoice
                ON invoice_line_items(invoice_id)
                """
            )
        )
        print("  ✅ invoice_line_items 表创建成功")

        # 3. 创建 organization_billing_profiles 表
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS organization_billing_profiles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL UNIQUE
                        REFERENCES organizations(id),
                    billing_address TEXT,
                    payment_terms VARCHAR(50) DEFAULT 'Net 30',
                    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                    contact_email VARCHAR(255),
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE
                        NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                        NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        print("  ✅ organization_billing_profiles 表创建成功")

        db.commit()
        print("✅ Migration 017: Invoice 相关表全部创建成功")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ Migration 017 失败: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("🔄 执行 Migration 017: 创建 Invoice 相关表...")
    success = run_migration()
    raise SystemExit(0 if success else 1)
