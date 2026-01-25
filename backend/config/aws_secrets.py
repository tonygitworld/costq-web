"""
AWS Secrets Manager 集成模块
用于从 AWS Secrets Manager 获取生产环境的敏感配置信息
"""

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSSecretsManager:
    """AWS Secrets Manager 客户端封装"""

    def __init__(self, region_name: str = "ap-northeast-1", profile_name: str | None = None):
        """
        初始化 Secrets Manager 客户端

        Args:
            region_name: AWS 区域名称
            profile_name: AWS CLI profile 名称（可选）
                - None: 使用默认凭证（生产环境使用 IAM Role）
                - "3532": 使用指定 profile（本地开发环境）

        Note:
            - 生产环境（EC2）: 自动使用 IAM Role，不需要配置凭证
            - 本地环境: 使用 AWS CLI profile
        """
        self.region_name = region_name
        self.profile_name = profile_name
        self._client = None

    @property
    def client(self):
        """延迟初始化客户端（支持 IAM Role 和 Profile）"""
        if self._client is None:
            try:
                # 如果指定了 profile，使用 Session
                if self.profile_name:
                    session = boto3.Session(profile_name=self.profile_name)
                    self._client = session.client("secretsmanager", region_name=self.region_name)
                    logger.info(
                        f"✅ Secrets Manager 客户端初始化成功 - Region: {self.region_name}, Profile: {self.profile_name}"
                    )
                else:
                    # EC2 上会自动使用 IAM Role
                    self._client = boto3.client("secretsmanager", region_name=self.region_name)
                    logger.info(
                        f"✅ Secrets Manager 客户端初始化成功 - Region: {self.region_name} (使用默认凭证/IAM Role)"
                    )
            except Exception as e:
                logger.error("Secrets Manager : %s", e)
                raise
        return self._client

    def get_secret(self, secret_name: str) -> dict[str, Any]:
        """
        从 Secrets Manager 获取密钥

        Args:
            secret_name: 密钥名称

        Returns:
            解析后的密钥字典

        Raises:
            ClientError: 获取密钥失败
        """
        try:
            logger.info(": %s", secret_name)
            response = self.client.get_secret_value(SecretId=secret_name)

            # 解析 JSON 字符串
            secret_string = response["SecretString"]
            secret_data = json.loads(secret_string)

            logger.info(": %s", secret_name)
            return secret_data

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "ResourceNotFoundException":
                logger.error(": %s", secret_name)
            elif error_code == "InvalidRequestException":
                logger.error(": %s", secret_name)
            elif error_code == "InvalidParameterException":
                logger.error(": %s", secret_name)
            elif error_code == "DecryptionFailure":
                logger.error(": %s", secret_name)
            elif error_code == "InternalServiceError":
                logger.error(": %s", secret_name)
            else:
                logger.error(": %s", error_code)
            raise

    def get_rds_config(self, secret_name: str = "costq/rds/postgresql") -> dict[str, Any]:
        """
        获取 RDS PostgreSQL 连接配置

        Args:
            secret_name: RDS 密钥名称

        Returns:
            包含 host, port, database, username, password 的字典
        """
        return self.get_secret(secret_name)

    def build_database_url(self, secret_name: str = "costq/rds/postgresql") -> str:
        """
        构建 PostgreSQL 数据库连接字符串

        Args:
            secret_name: RDS 密钥名称

        Returns:
            PostgreSQL 连接字符串
            格式: postgresql://username:password@host:port/database
        """
        try:
            config = self.get_rds_config(secret_name)

            # 获取数据库名称（支持 'database', 'dbname' 字段，或使用默认值 'postgres'）
            database_name = config.get("database") or config.get("dbname", "postgres")

            # 构建连接字符串
            database_url = (
                f"postgresql://{config['username']}:{config['password']}"
                f"@{config['host']}:{config['port']}/{database_name}"
            )

            logger.info(
                f"✅ 数据库连接字符串构建成功 - Host: {config['host']}, Database: {database_name}"
            )
            return database_url

        except Exception as e:
            logger.error(": %s", e)
            raise


# 全局单例（注意：不再使用全局单例，因为 profile 可能不同）
_secrets_manager: AWSSecretsManager | None = None


def get_secrets_manager(
    region_name: str = "ap-northeast-1", profile_name: str | None = None
) -> AWSSecretsManager:
    """
    获取 Secrets Manager 实例

    Args:
        region_name: AWS 区域名称
        profile_name: AWS CLI profile 名称（可选）

    Returns:
        AWSSecretsManager 实例

    Note:
        由于不同环境可能使用不同的 profile，这里不再使用全局单例
    """
    # 每次都创建新实例，以支持不同的 profile
    return AWSSecretsManager(region_name, profile_name)
