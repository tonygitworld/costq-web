"""GCP 账号数据模型"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class GCPAccountBase(BaseModel):
    """GCP 账号基础模型"""

    account_name: str = Field(..., min_length=1, max_length=100, description="账号别名")
    description: str | None = Field(None, max_length=500, description="账号描述")


class GCPAccountCreate(GCPAccountBase):
    """创建 GCP 账号请求"""

    service_account_json: dict = Field(..., description="Service Account JSON Key")

    # BigQuery Billing Export 配置（可选）
    billing_export_project_id: str | None = Field(
        None, description="BigQuery billing export 所在的项目 ID"
    )
    billing_export_dataset: str | None = Field(
        None, description="BigQuery billing export 的 dataset 名称"
    )
    billing_export_table: str | None = Field(None, description="BigQuery billing export 的表名")

    @field_validator("service_account_json")
    @classmethod
    def validate_service_account_json(cls, v):
        """验证 JSON Key 格式"""
        required_fields = [
            "type",
            "project_id",
            "private_key_id",
            "private_key",
            "client_email",
            "client_id",
            "auth_uri",
            "token_uri",
        ]

        for field in required_fields:
            if field not in v:
                raise ValueError(f"缺少必需字段: {field}")

        if v.get("type") != "service_account":
            raise ValueError("必须是 service_account 类型的密钥")

        return v

    class Config:
        json_schema_extra = {
            "example": {
                "account_name": "Production GCP",
                "description": "生产环境 GCP 项目",
                "service_account_json": {
                    "type": "service_account",
                    "project_id": "my-project-123",
                    "private_key_id": "key-id",
                    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
                    "client_email": "service-account@my-project.iam.gserviceaccount.com",
                    "client_id": "123456789",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                },
            }
        }


class GCPAccount(GCPAccountBase):
    """完整 GCP 账号模型（多租户架构）"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = Field(..., description="组织ID（多租户隔离）")
    project_id: str
    service_account_email: str
    credentials_encrypted: str
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # GCP 特有字段
    organization_id: str | None = None
    billing_account_id: str | None = None

    # BigQuery Billing Export 配置字段
    billing_export_project_id: str | None = Field(
        None, description="BigQuery billing export 所在的项目 ID（如果与主项目不同）"
    )
    billing_export_dataset: str | None = Field(
        None, description="BigQuery billing export 的 dataset 名称（如 'billing_export'）"
    )
    billing_export_table: str | None = Field(
        None,
        description="BigQuery billing export 的表名（如 'gcp_billing_export_resource_v1_...'）",
    )

    @field_validator("billing_export_table")
    @classmethod
    def set_default_billing_table(cls, v, info):
        """自动生成默认表名（如果未提供且有 billing_account_id）"""
        if not v and info.data.get("billing_account_id"):
            # 生成默认表名：gcp_billing_export_resource_v1_{BILLING_ACCOUNT_ID}
            # 移除 billing_account_id 中的破折号
            billing_id = info.data["billing_account_id"].replace("-", "_")
            return f"gcp_billing_export_resource_v1_{billing_id}"
        return v


class GCPAccountResponse(GCPAccountBase):
    """GCP 账号响应（脱敏）- 多租户架构"""

    id: str
    org_id: str = Field(..., description="组织ID")
    project_id: str
    service_account_email: str
    service_account_email_masked: str = Field(..., description="脱敏的邮箱")
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    organization_id: str | None = None
    billing_account_id: str | None = None

    # BigQuery Billing Export 配置字段
    billing_export_project_id: str | None = None
    billing_export_dataset: str | None = None
    billing_export_table: str | None = None


class GCPAccountUpdate(BaseModel):
    """更新 GCP 账号请求"""

    account_name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)

    # BigQuery Billing Export 配置（可选）
    billing_export_project_id: str | None = Field(
        None, description="BigQuery billing export 所在的项目 ID"
    )
    billing_export_dataset: str | None = Field(
        None, description="BigQuery billing export 的 dataset 名称"
    )
    billing_export_table: str | None = Field(None, description="BigQuery billing export 的表名")


class GCPCredentialValidationResult(BaseModel):
    """GCP 凭证验证结果"""

    valid: bool
    project_id: str | None = None
    service_account_email: str | None = None
    organization_id: str | None = None
    billing_account_id: str | None = None
    error: str | None = None
