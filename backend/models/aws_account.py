"""AWS 账号数据模型"""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AuthType(str, Enum):
    """认证类型"""

    AKSK = "aksk"
    IAM_ROLE = "iam_role"


class AWSAccount(BaseModel):
    """AWS 账号模型（完整数据）- 多租户架构"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = Field(..., description="组织ID（多租户隔离）")
    alias: str = Field(..., description="账号别名")

    # Authentication type（临时注释：云数据库没有此字段）
    auth_type: AuthType = Field(default=AuthType.AKSK, description="认证类型: aksk 或 iam_role")

    # AKSK fields (optional for IAM Role accounts)
    access_key_id: str | None = Field(None, description="Access Key ID")
    secret_access_key_encrypted: str | None = Field(None, description="加密的 Secret Access Key")

    # IAM Role fields (optional for AKSK accounts)（临时注释：云数据库没有这些字段）
    role_arn: str | None = Field(None, description="IAM Role ARN")
    session_duration: int | None = Field(default=3600, description="会话时长（秒）")

    # Common fields
    region: str = Field(default="us-east-1", description="默认区域")
    description: str | None = Field(None, description="账号描述")
    account_id: str | None = Field(None, description="AWS Account ID (12位数字)")
    arn: str | None = Field(None, description="IAM ARN")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    is_verified: bool = Field(default=False, description="凭证是否已验证")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "alias": "Production Account",
                "access_key_id": "AKIAIOSFODNN7EXAMPLE",
                "secret_access_key_encrypted": "gAAAAA...",
                "region": "us-east-1",
                "description": "生产环境主账号",
                "account_id": "123456789012",
                "is_verified": True,
            }
        }


class AWSAccountCreate(BaseModel):
    """创建 AWS 账号请求（AKSK 方式）"""

    alias: str = Field(..., min_length=1, max_length=100, description="账号别名")
    access_key_id: str = Field(..., min_length=16, max_length=128, description="Access Key ID")
    secret_access_key: str = Field(..., min_length=16, description="Secret Access Key")
    region: str = Field(default="us-east-1", description="默认区域")
    description: str | None = Field(None, max_length=500, description="账号描述")


class AWSAccountCreateIAMRole(BaseModel):
    """创建 AWS 账号请求（IAM Role 方式）"""

    alias: str = Field(..., min_length=1, max_length=100, description="账号别名")
    role_arn: str = Field(..., pattern=r"^arn:aws:iam::\d{12}:role/.+", description="IAM Role ARN")
    region: str = Field(default="us-east-1", description="默认区域")
    description: str | None = Field(None, max_length=500, description="账号描述")
    session_duration: int = Field(default=3600, ge=900, le=43200, description="会话时长（秒）")

    class Config:
        json_schema_extra = {
            "example": {
                "alias": "Production Account",
                "access_key_id": "AKIAIOSFODNN7EXAMPLE",
                "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                "region": "us-east-1",
                "description": "生产环境主账号",
            }
        }


class AWSAccountUpdate(BaseModel):
    """更新 AWS 账号请求"""

    alias: str | None = Field(None, min_length=1, max_length=100)
    region: str | None = None
    description: str | None = Field(None, max_length=500)

    class Config:
        json_schema_extra = {
            "example": {
                "alias": "Production Account - Updated",
                "region": "us-west-2",
                "description": "更新后的描述",
            }
        }


class AWSAccountResponse(BaseModel):
    """账号响应（不包含敏感信息）- 多租户架构"""

    id: str
    org_id: str = Field(..., description="组织ID")
    alias: str
    auth_type: AuthType = Field(default=AuthType.AKSK, description="认证类型")

    # AKSK fields (only for auth_type='aksk')
    access_key_id_masked: str | None = Field(None, description="脱敏的 Access Key ID")

    # IAM Role fields (only for auth_type='iam_role')
    role_arn: str | None = Field(None, description="IAM Role ARN")
    session_duration: int | None = Field(None, description="会话时长（秒）")

    # Common fields
    region: str
    description: str | None
    account_id: str | None
    arn: str | None
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "alias": "Production Account",
                "access_key_id_masked": "AKIA...MPLE",
                "region": "us-east-1",
                "description": "生产环境主账号",
                "account_id": "123456789012",
                "arn": "arn:aws:iam::123456789012:user/admin",
                "is_verified": True,
                "created_at": "2025-10-10T10:00:00",
                "updated_at": "2025-10-10T10:00:00",
            }
        }


class CredentialValidationResult(BaseModel):
    """凭证验证结果"""

    valid: bool
    account_id: str | None = None
    arn: str | None = None
    user_id: str | None = None
    error: str | None = None

    class Config:
        json_schema_extra = {
            "example": {
                "valid": True,
                "account_id": "123456789012",
                "arn": "arn:aws:iam::123456789012:user/admin",
                "user_id": "AIDAI23XXXXEXAMPLE",
            }
        }
