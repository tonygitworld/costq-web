"""
统一配置管理模块
基于 Pydantic Settings，支持环境变量自动注入和类型验证
"""

import os
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    """
    应用配置类

    优先级（从高到低）：
    1. 环境变量
    2. .env 文件
    3. 代码中的默认值
    """

    # ==================== 环境标识 ====================
    ENVIRONMENT: Literal["local", "development", "staging", "production"] = Field(
        default="local", description="当前运行环境"
    )
    DEBUG: bool = Field(default=False, description="调试模式")

    # ==================== 应用配置 ====================
    APP_NAME: str = "Strands Agent Demo"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # ==================== 安全配置 ====================
    JWT_SECRET_KEY: str = Field(
        default="dev-jwt-key-change-in-production",  # 仅用于本地开发
        description="JWT签名密钥",
    )
    JWT_ALGORITHM: str = "HS256"
    FRONTEND_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=1440,  # 24小时（默认值，可通过环境变量覆盖）
        description="Access Token过期时间（分钟）",
    )

    FRONTEND_REFRESH_TOKEN_EXPIRE_MINUTES: int = Field(
        default=10080,  # 7天 = 10080分钟（默认值，可通过环境变量覆盖）
        description="Refresh Token过期时间（分钟）",
    )

    # 加密密钥（Fernet格式，44字节Base64编码）
    ENCRYPTION_KEY: str | None = Field(
        default=None, description="Fernet加密密钥，用于加密云账号凭证"
    )

    # ==================== 数据库配置 ====================
    DATABASE_URL: str | None = Field(default=None, description="数据库连接字符串 (PostgreSQL)")

    # ==================== AWS配置 ====================
    # 资源区域（RDS等）
    # 在本地开发时，这通常是目标云环境的区域
    AWS_REGION: str = Field(default="ap-northeast-1", description="AWS资源区域")

    # ==================== 云资源配置 ====================
    # AWS Secrets Manager 密钥名称
    # 本地开发时指向 Dev 密钥，生产环境指向 Prod 密钥
    RDS_SECRET_NAME: str = Field(
        default="costq/rds/postgresql", description="RDS PostgreSQL 密钥名称"
    )

    # AgentCore Runtime 配置
    AGENTCORE_RUNTIME_ARN: str = Field(
        default="arn:aws:bedrock-agentcore:ap-northeast-1:000451883532:runtime/costq_agents_production-EmkFap5Vmc",
        description="AgentCore Runtime ARN",
    )
    AGENTCORE_REGION: str = Field(
        default="ap-northeast-1", description="AgentCore Runtime 所在区域"
    )

    # ==================== Bedrock Prompt Management ====================
    DIALOG_AWS_PROMPT_ARN: str = Field(
        default="", description="AWS 对话场景的 Bedrock Prompt ARN"
    )
    DIALOG_GCP_PROMPT_ARN: str = Field(
        default="", description="GCP 对话场景的 Bedrock Prompt ARN"
    )
    ALERT_PROMPT_ARN: str = Field(
        default="", description="告警场景的 Bedrock Prompt ARN"
    )

    # ==================== 日志配置 ====================
    LOG_LEVEL: str = Field(default="INFO", description="日志级别")

    # ==================== CORS配置 ====================
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
        description="允许的跨域来源（逗号分隔）",
    )

    # ==================== 前端配置 ====================
    FRONTEND_URL: str = Field(
        default="http://localhost:5173", description="前端应用的URL（用于生成邮件激活链接等）"
    )

    # ==================== 模型配置 ====================
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # 忽略额外的环境变量
    )

    # ==================== 验证器 ====================
    @field_validator("JWT_SECRET_KEY", mode="before")
    @classmethod
    def validate_jwt_secret(cls, v: str, info) -> str:
        """验证JWT密钥在生产环境必须提供且足够长"""
        # 获取环境信息
        env = os.getenv("ENVIRONMENT", "local")

        # 禁止的弱密钥列表
        FORBIDDEN_KEYS = {
            "your-secret-key-change-in-production-2024",
            "dev-jwt-key-change-in-production",
            "secret",
            "secret-key",
            "jwt-secret",
            "change-me",
        }

        if env == "production":
            if not v:
                raise ValueError(
                    "生产环境必须设置 JWT_SECRET_KEY！\n"
                    "生成方法: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
            if v in FORBIDDEN_KEYS or v.lower() in FORBIDDEN_KEYS:
                raise ValueError(
                    "生产环境禁止使用默认或弱JWT密钥！\n"
                    "生成强密钥: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
            if len(v) < 32:
                raise ValueError("生产环境 JWT_SECRET_KEY 必须至少32个字符")
        else:
            # 非生产环境警告使用默认密钥
            if v in FORBIDDEN_KEYS:
                import warnings

                warnings.warn(f"使用默认JWT密钥（仅{env}环境）。生产环境必须更换！", UserWarning)

        return v

    @field_validator("ENCRYPTION_KEY", mode="before")
    @classmethod
    def validate_encryption_key(cls, v: str | None, info) -> str | None:
        """验证加密密钥在生产环境必须配置且格式正确"""
        # 在before模式下，需要从环境变量直接读取ENVIRONMENT
        env = os.getenv("ENVIRONMENT", "local")

        if env == "production":
            if not v:
                raise ValueError(
                    "生产环境必须设置 ENCRYPTION_KEY！\n"
                    "生成方法: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
                )

            # 验证Fernet密钥格式
            try:
                from cryptography.fernet import Fernet

                Fernet(v.encode() if isinstance(v, str) else v)
            except Exception as e:
                raise ValueError(f"ENCRYPTION_KEY 格式错误，必须是有效的Fernet密钥: {e}")

        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str | None, info) -> str | None:
        """验证数据库配置"""
        return v


    # ==================== 辅助方法 ====================
    @property
    def is_production(self) -> bool:
        """是否是生产环境"""
        return self.ENVIRONMENT == "production"

    @property
    def is_local(self) -> bool:
        """是否是本地开发环境"""
        return self.ENVIRONMENT == "local"

    @property
    def is_cloud_environment(self) -> bool:
        """
        是否运行在云环境（EC2/容器）

        检测逻辑:
        - 检查 DOCKER_CONTAINER 环境变量（Runtime 容器）
        - 检查是否存在 EC2 实例元数据服务
        - 生产环境默认认为是云环境
        """
        if self.is_production:
            return True

        # 检查是否在 Docker 容器中（AgentCore Runtime）
        import os

        if os.getenv("DOCKER_CONTAINER") == "1":
            return True

        # 检查 EC2 元数据服务
        try:
            import requests

            # EC2 元数据服务地址（IMDSv2）
            response = requests.get(
                "http://169.254.169.254/latest/meta-data/instance-id", timeout=0.1
            )
            return response.status_code == 200
        except:
            return False

    @property
    def use_iam_role(self) -> bool:
        """
        是否使用 IAM Role（而非 profile/AKSK）

        Returns:
            True: 云环境，使用 IAM Role
            False: 本地环境，使用 profile/AKSK
        """
        return self.is_cloud_environment

    @property
    def aws_region(self) -> str:
        """
        获取当前应使用的 AWS 区域 (资源区域)
        """
        return self.AWS_REGION

    def get_cors_origins_list(self) -> list[str]:
        """获取CORS允许的来源列表"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    def get_database_url(self) -> str:
        """
        动态获取数据库连接字符串

        逻辑：
        1. 确定目标区域 (AWS_REGION)
        2. 确定认证方式 (IAM Role vs Profile)
        3. 读取 Secrets Manager (RDS_SECRET_NAME)

        ✅ AgentCore Runtime 支持：
        - Runtime 在 invoke() 中会通过 payload 接收 rds_secret_name
        - 并设置到环境变量 os.environ["RDS_SECRET_NAME"]
        - 这里优先从环境变量读取，支持动态切换 dev/prod 数据库
        """
        try:
            import os

            from backend.config.aws_secrets import get_secrets_manager

            # ✅ 优先从环境变量读取 RDS_SECRET_NAME（支持 Runtime 动态传递）
            # AgentCore Runtime: payload → os.environ → 这里读取
            # FastAPI 本地/生产: .env/ConfigMap → self.RDS_SECRET_NAME
            rds_secret_name = os.getenv("RDS_SECRET_NAME") or self.RDS_SECRET_NAME

            # 使用默认凭证链（本地可通过 AWS_PROFILE 环境变量配置）
            profile_name = os.getenv("AWS_PROFILE")

            secrets_manager = get_secrets_manager(
                region_name=self.AWS_REGION, profile_name=profile_name
            )

            # ✅ 使用动态读取的密钥名称
            database_url = secrets_manager.build_database_url(rds_secret_name)

            # 日志记录（仅本地）
            if self.is_local:
                import logging

                logger = logging.getLogger(__name__)
                logger.info(": %s", rds_secret_name)

            return database_url
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(": %s", e)
            raise RuntimeError(f"无法连接到数据库: {e}")


# ==================== 全局配置实例 ====================
_settings: Settings | None = None


def get_settings() -> Settings:
    """
    获取配置实例（单例模式）
    """
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


# 导出默认实例
settings = get_settings()
