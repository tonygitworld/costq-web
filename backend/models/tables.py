"""SQLAlchemy 表定义"""

from sqlalchemy import Boolean, Column, DateTime, String, Text, func

from backend.models.base import Base


class AWSAccountTable(Base):
    """AWS 账号表（SQLAlchemy 模型）"""

    __tablename__ = "aws_accounts"

    id = Column(String(36), primary_key=True)
    org_id = Column(String(36), nullable=False, index=True)  # 多租户隔离
    alias = Column(String(100), nullable=False)

    # Authentication type: 'aksk' or 'iam_role'
    auth_type = Column(String(20), default="aksk", index=True)

    # AKSK fields (for auth_type='aksk')
    access_key_id = Column(String(128))
    secret_access_key_encrypted = Column(Text)

    # IAM Role fields (for auth_type='iam_role')
    role_arn = Column(String(2048))
    session_duration = Column(String(10), default="3600")  # seconds

    # Common fields
    region = Column(String(50), default="us-east-1")
    description = Column(Text)
    account_id = Column(String(12))  # AWS Account ID (12位数字)
    arn = Column(Text)  # IAM ARN
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    is_verified = Column(Boolean, default=False)


class GCPAccountTable(Base):
    """GCP 账号表（SQLAlchemy 模型）"""

    __tablename__ = "gcp_accounts"

    id = Column(String(36), primary_key=True)
    org_id = Column(String(36), nullable=False, index=True)  # 多租户隔离
    account_name = Column(String(100), nullable=False)
    description = Column(Text)
    project_id = Column(String(100), nullable=False)
    service_account_email = Column(String(255), nullable=False)
    credentials_encrypted = Column(Text, nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # GCP 特有字段
    organization_id = Column(String(100))
    billing_account_id = Column(String(100))

    # BigQuery Billing Export 配置字段
    billing_export_project_id = Column(String(100))
    billing_export_dataset = Column(String(100))
    billing_export_table = Column(String(200))
