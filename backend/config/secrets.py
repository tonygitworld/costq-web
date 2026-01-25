"""
AWS Secrets Manager 集成

生产环境数据库密码管理的最佳实践实现
"""

import json
import logging
from functools import lru_cache

import boto3

# 初始化标准 logger
logger = logging.getLogger(__name__)


class SecretsManager:
    """
    AWS Secrets Manager 客户端

    用于安全地获取和管理生产环境的敏感信息（如数据库密码）

    Features:
    - 自动缓存（减少 API 调用）
    - IAM 权限控制
    - KMS 加密
    - 审计日志

    Example:
        >>> secrets = SecretsManager(region_name="us-east-1")
        >>> db_creds = secrets.get_database_credentials(environment="prod")
        >>> print(db_creds['host'])
    """

    def __init__(self, region_name: str = "us-east-1"):
        """
        初始化 Secrets Manager 客户端

        Args:
            region_name: AWS 区域名称
        """
        try:
            self.client = boto3.client("secretsmanager", region_name=region_name)
            self.region = region_name
            logger.info("Secrets Manager - Region: %s", region_name)
        except Exception as e:
            logger.error("Secrets Manager : %s", e)
            raise

    @lru_cache(maxsize=10)
    def get_secret(self, secret_name: str, version_stage: str = "AWSCURRENT") -> dict:
        """
        获取密钥（带缓存）

        Args:
            secret_name: Secret 名称（如 "prod/strands-agent/db"）
            version_stage: 版本阶段（AWSCURRENT/AWSPENDING/AWSPREVIOUS）

        Returns:
            密钥内容字典

        Raises:
            Exception: 获取失败时抛出异常

        Example:
            >>> secret = secrets.get_secret("prod/myapp/db")
            >>> print(secret['password'])
        """
        try:
            logger.debug(": %s (Stage: %s)", secret_name, version_stage)

            response = self.client.get_secret_value(
                SecretId=secret_name, VersionStage=version_stage
            )

            # 解析密钥值
            if "SecretString" in response:
                secret = json.loads(response["SecretString"])
            else:
                # Binary secret (base64 encoded)
                import base64

                secret = json.loads(base64.b64decode(response["SecretBinary"]))

            logger.info(": %s", secret_name)
            return secret

        except self.client.exceptions.ResourceNotFoundException:
            logger.error(": %s", secret_name)
            raise ValueError(f"Secret '{secret_name}' not found in region '{self.region}'")
        except self.client.exceptions.InvalidRequestException as e:
            logger.error(": %s", e)
            raise
        except self.client.exceptions.InvalidParameterException as e:
            logger.error(": %s", e)
            raise
        except Exception as e:
            logger.error(": %s, Error: %s", secret_name, e)
            raise

    def get_database_credentials(
        self, environment: str = "prod", app_name: str = "strands-agent"
    ) -> dict:
        """
        获取数据库凭证

        Args:
            environment: 环境名称（prod/staging/dev）
            app_name: 应用名称

        Returns:
            数据库凭证字典:
            {
                "username": "dbadmin",
                "password": "...",
                "host": "mydb.cluster-xxx.rds.amazonaws.com",
                "port": 5432,
                "dbname": "myapp",
                "engine": "postgres"
            }

        Example:
            >>> creds = secrets.get_database_credentials(environment="prod")
            >>> connection_string = f"postgresql://{creds['username']}:{creds['password']}@{creds['host']}:{creds['port']}/{creds['dbname']}"
        """
        secret_name = f"{environment}/{app_name}/db"

        logger.info("- Environment: %s, App: %s", environment, app_name)
        credentials = self.get_secret(secret_name)

        # 验证必需字段
        required_fields = ["username", "password", "host", "port", "dbname"]
        missing_fields = [field for field in required_fields if field not in credentials]

        if missing_fields:
            raise ValueError(f"密钥缺少必需字段: {missing_fields}")

        return credentials

    def refresh_secret(self, secret_name: str):
        """
        刷新缓存的密钥

        在密钥轮换后调用，确保获取最新版本

        Args:
            secret_name: Secret 名称
        """
        logger.info(": %s", secret_name)
        self.get_secret.cache_clear()

    def list_secrets(self, filters: dict | None = None) -> list:
        """
        列出所有密钥

        Args:
            filters: 过滤条件（如 {"Key": "tag-key", "Values": ["Environment"]}）

        Returns:
            密钥列表
        """
        try:
            params = {}
            if filters:
                params["Filters"] = [filters]

            response = self.client.list_secrets(**params)
            secrets = response.get("SecretList", [])

            logger.info("📋 找到 {len(secrets)} 个密钥")
            return secrets

        except Exception as e:
            logger.error(": %s", e)
            raise


# 单例实例（仅在需要时创建）
_secrets_manager_instance: SecretsManager | None = None


def get_secrets_manager(region_name: str = "us-east-1") -> SecretsManager:
    """
    获取 Secrets Manager 单例实例

    Args:
        region_name: AWS 区域

    Returns:
        SecretsManager 实例
    """
    global _secrets_manager_instance

    if _secrets_manager_instance is None:
        _secrets_manager_instance = SecretsManager(region_name=region_name)

    return _secrets_manager_instance


# 便捷函数
def get_database_password(environment: str = "prod") -> str:
    """
    快速获取数据库密码

    Args:
        environment: 环境名称

    Returns:
        数据库密码字符串

    Example:
        >>> password = get_database_password("prod")
    """
    secrets = get_secrets_manager()
    creds = secrets.get_database_credentials(environment=environment)
    return creds["password"]
