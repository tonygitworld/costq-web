"""AWS 凭证自动刷新器"""

import os
import threading
from datetime import UTC, datetime, timedelta
from typing import Optional

import boto3

import logging

logger = logging.getLogger(__name__)


class AWSCredentialsRefresher:
    """AWS 跨账号凭证自动刷新器

    自动检测临时凭证过期并刷新，避免 ExpiredTokenException
    """

    _instance: Optional["AWSCredentialsRefresher"] = None
    _lock = threading.Lock()

    def __init__(self, role_arn: str, region: str = "us-west-2", duration_seconds: int = 3600):
        """
        Args:
            role_arn: IAM Role ARN
            region: AWS 区域
            duration_seconds: 临时凭证有效期（秒），默认 3600（1小时，role chaining 限制）
        """
        self.role_arn = role_arn
        self.region = region
        self.duration_seconds = duration_seconds
        self.expiration: datetime | None = None
        self.refresh_threshold = timedelta(minutes=10)  # ✅ 提前 10 分钟刷新

    @classmethod
    def get_instance(
        cls, role_arn: str, region: str = "us-west-2", duration_seconds: int = 3600
    ) -> "AWSCredentialsRefresher":
        """获取单例实例

        Args:
            role_arn: IAM Role ARN
            region: AWS 区域
            duration_seconds: 临时凭证有效期（秒），默认 3600（1小时，role chaining 限制）
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(role_arn, region, duration_seconds)
        return cls._instance

    def is_expired_or_expiring_soon(self) -> bool:
        """检查凭证是否已过期或即将过期"""
        if self.expiration is None:
            return True

        now = datetime.now(UTC)
        # 如果凭证在 refresh_threshold（默认 30 分钟）内过期，就认为需要刷新
        time_until_expiry = self.expiration - now

        if time_until_expiry < self.refresh_threshold:
            logger.info(
                f"⏰ 凭证将在 {time_until_expiry.total_seconds() / 60:.1f} 分钟后过期，需要刷新"
            )
            return True

        return False

    def assume_role(self) -> dict:
        """执行 AssumeRole 并返回凭证

        Returns:
            凭证字典，包含 AccessKeyId, SecretAccessKey, SessionToken, Expiration
        """
        try:
            logger.info(f"🔐 开始 AssumeRole: {self.role_arn}")

            # 使用当前 EKS Pod 的 IAM Role 去 AssumeRole
            sts_client = boto3.client("sts", region_name=self.region)
            response = sts_client.assume_role(
                RoleArn=self.role_arn,
                RoleSessionName="bedrock-cross-account-session",
                DurationSeconds=self.duration_seconds,  # ✅ 使用配置的时长（默认 12 小时）
            )

            credentials = response["Credentials"]
            self.expiration = credentials["Expiration"]

            logger.info(f"✅ AssumeRole 成功，凭证有效期至: {self.expiration}")

            return credentials

        except Exception as e:
            logger.error(f"❌ AssumeRole 失败: {e}")
            raise

    def refresh_if_needed(self) -> bool:
        """如果需要，刷新凭证

        Returns:
            bool: 是否执行了刷新
        """
        if self.is_expired_or_expiring_soon():
            with self._lock:
                # 双重检查
                if self.is_expired_or_expiring_soon():
                    logger.info("🔄 凭证即将过期，开始刷新...")
                    credentials = self.assume_role()

                    # 更新环境变量
                    os.environ["AWS_ACCESS_KEY_ID"] = credentials["AccessKeyId"]
                    os.environ["AWS_SECRET_ACCESS_KEY"] = credentials["SecretAccessKey"]
                    os.environ["AWS_SESSION_TOKEN"] = credentials["SessionToken"]

                    logger.info("✅ 凭证已刷新并更新到环境变量")
                    return True

        return False

    def get_credentials_and_refresh(self) -> dict:
        """获取凭证，如果过期则自动刷新

        Returns:
            凭证字典
        """
        self.refresh_if_needed()

        return {
            "aws_access_key_id": os.environ.get("AWS_ACCESS_KEY_ID"),
            "aws_secret_access_key": os.environ.get("AWS_SECRET_ACCESS_KEY"),
            "aws_session_token": os.environ.get("AWS_SESSION_TOKEN"),
        }
