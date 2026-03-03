"""create marketplace tables (postgresql)

Revision ID: 016_create_marketplace_tables_postgresql
Revises: 015_upgrade_all_remaining_tables_to_uuid
Create Date: 2026-03-03

Note:
- This migration targets the dev PostgreSQL RDS.
- Uses organizations(id) as the tenant/org foreign key.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "016_create_marketplace_tables_postgresql"
down_revision = "015_upgrade_all_remaining_tables_to_uuid"
branch_labels = None
depends_on = None


def upgrade():
    # 1) marketplace_customers (1:1 org_id)
    op.create_table(
        "marketplace_customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aws_customer_identifier", sa.Text(), nullable=False),
        sa.Column("aws_product_code", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("org_id", name="uq_marketplace_customers_org_id"),
        sa.UniqueConstraint("aws_customer_identifier", name="uq_marketplace_customers_aws_customer_identifier"),
    )
    op.create_index("ix_marketplace_customers_org_id", "marketplace_customers", ["org_id"])

    # 2) marketplace_entitlement_cache
    op.create_table(
        "marketplace_entitlement_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aws_customer_identifier", sa.Text(), nullable=False),
        sa.Column("dimension", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("expiration_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_entitlement", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("cached_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_refresh_error", sa.Text(), nullable=True),
        sa.UniqueConstraint("org_id", "dimension", name="uq_marketplace_entitlement_cache_org_dimension"),
    )
    op.create_index("ix_marketplace_entitlement_cache_org_id", "marketplace_entitlement_cache", ["org_id"])
    op.create_index(
        "ix_marketplace_entitlement_cache_aws_customer_identifier",
        "marketplace_entitlement_cache",
        ["aws_customer_identifier"],
    )
    op.create_index("ix_marketplace_entitlement_cache_expires_at", "marketplace_entitlement_cache", ["expires_at"])

    # 3) marketplace_event_log
    op.create_table(
        "marketplace_event_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("aws_customer_identifier", sa.Text(), nullable=True),
        sa.Column("sns_message_id", sa.Text(), nullable=True),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("sns_message_id", name="uq_marketplace_event_log_sns_message_id"),
    )
    op.create_index("ix_marketplace_event_log_status", "marketplace_event_log", ["status"])
    op.create_index("ix_marketplace_event_log_received_at", "marketplace_event_log", ["received_at"])


def downgrade():
    op.drop_index("ix_marketplace_event_log_received_at", table_name="marketplace_event_log")
    op.drop_index("ix_marketplace_event_log_status", table_name="marketplace_event_log")
    op.drop_table("marketplace_event_log")

    op.drop_index("ix_marketplace_entitlement_cache_expires_at", table_name="marketplace_entitlement_cache")
    op.drop_index(
        "ix_marketplace_entitlement_cache_aws_customer_identifier",
        table_name="marketplace_entitlement_cache",
    )
    op.drop_index("ix_marketplace_entitlement_cache_org_id", table_name="marketplace_entitlement_cache")
    op.drop_table("marketplace_entitlement_cache")

    op.drop_index("ix_marketplace_customers_org_id", table_name="marketplace_customers")
    op.drop_table("marketplace_customers")
