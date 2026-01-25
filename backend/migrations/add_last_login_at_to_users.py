"""
添加 last_login_at 字段到 users 表

迁移时间: 2025-10-27
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime


def upgrade():
    """添加 last_login_at 字段"""
    # 添加 last_login_at 列
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))

    print("✅ 已添加 last_login_at 字段到 users 表")


def downgrade():
    """回滚：删除 last_login_at 字段"""
    op.drop_column('users', 'last_login_at')

    print("✅ 已删除 users 表的 last_login_at 字段")
