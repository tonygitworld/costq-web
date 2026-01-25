"""AWS 凭证提供服务

该服务负责：
1. 根据 account_id 从数据库获取账号信息
2. 解密 Secret Access Key
3. 创建 boto3 Session 或返回凭证字典

注意：IAM Role 认证功能已移至 costq-agents 仓库（AgentCore Runtime 内运行）
"""

import logging

import boto3

from .account_storage import get_account_storage
from .credential_manager import get_credential_manager

logger = logging.getLogger(__name__)


class AWSCredentialsProvider:
    """AWS 凭证提供服务

    提供解密后的 AWS 凭证，支持 AKSK 认证方式。

    注意：
    - IAM Role 认证功能已移至 costq-agents 仓库（AgentCore Runtime 内运行）
    - 本模块仅保留 AKSK 认证和账号信息查询功能
    """

    def __init__(self):
        self.credential_manager = get_credential_manager()
        self.account_storage = get_account_storage()

    def get_credentials(self, account_id: str) -> dict[str, str]:
        """获取指定账号的凭证（AKSK 认证）

        ⚠️ 注意：此方法已废弃，Backend 不应该获取凭证
        - 凭证获取应由 AgentCore Runtime 负责
        - 此方法仅用于向后兼容，未来版本将移除

        Args:
            account_id: 账号 ID

        Returns:
            Dict: 凭证字典（仅限 AKSK）或元数据（IAM Role）
                {
                    'access_key_id': 'AKIA...',  # AKSK
                    'secret_access_key': 'wJalr...',  # AKSK
                    'region': 'us-east-1',
                    'account_id': '123456789012',
                    'auth_type': 'aksk' | 'iam_role'
                }

        Raises:
            ValueError: 账号不存在或凭证获取失败

        Example:
            >>> provider = AWSCredentialsProvider()
            >>> creds = provider.get_credentials('account-id-123')
            >>> print(creds['region'])
            'us-east-1'
        """
        # 1. 从数据库获取账号
        account = self.account_storage.get_account(account_id)

        if not account:
            logger.error(f"❌ 账号不存在 - ID: {account_id}")
            raise ValueError(f"账号不存在: {account_id}")

        auth_type = account.get("auth_type", "aksk")
        logger.warning(
            f"⚠️ get_credentials() 已废弃 - Account: {account.get('alias')} "
            f"({account.get('account_id')}), Type: {auth_type}, "
            f"建议改用 get_account_info() 只获取元数据"
        )

        # 2. 根据认证类型处理
        if auth_type == "iam_role":
            # ✅ IAM Role: 不抛出错误，返回元数据（凭证由 Runtime 获取）
            logger.info(
                f"IAM Role 账号，返回元数据 - Account: {account.get('alias')}"
            )
            return {
                "auth_type": "iam_role",
                "region": account.get("region", "us-east-1"),
                "account_id": account.get("account_id"),
                "alias": account.get("alias"),
                # ⚠️ 不返回凭证字段
            }

        # AKSK: 解密 Secret Access Key
        try:
            secret_access_key = self.credential_manager.decrypt_secret_key(
                account["secret_access_key_encrypted"]
            )
        except Exception as e:
            logger.error(
                f"❌ AKSK 凭证解密失败 - Account: {account.get('alias')}, Error: {e}"
            )
            raise ValueError(f"凭证解密失败: {str(e)}")

        credentials = {
            "access_key_id": account["access_key_id"],
            "secret_access_key": secret_access_key,
            "region": account["region"],
            "account_id": account.get("account_id"),
            "alias": account.get("alias"),
            "auth_type": "aksk",
        }

        logger.debug(
            f"✅ AKSK 凭证获取成功 - Account: {account.get('alias')}, "
            f"Region: {account['region']}"
        )

        return credentials

    def create_session(self, account_id: str) -> boto3.Session:
        """为指定账号创建 boto3 Session（AKSK 认证）

        Args:
            account_id: 账号 ID

        Returns:
            boto3.Session: AWS Session 对象

        Raises:
            ValueError: 账号不存在或凭证无效

        Example:
            >>> provider = AWSCredentialsProvider()
            >>> session = provider.create_session('account-id-123')
            >>> ce_client = session.client('ce')
        """
        credentials = self.get_credentials(account_id)

        try:
            session = boto3.Session(
                aws_access_key_id=credentials["access_key_id"],
                aws_secret_access_key=credentials["secret_access_key"],
                region_name=credentials["region"],
            )

            logger.debug(
                f"✅ Session 创建成功（AKSK）- Account: {credentials['alias']}, "
                f"Region: {credentials['region']}"
            )

            return session

        except Exception as e:
            logger.error(
                f"❌ Session 创建失败 - Account: {credentials['alias']}, Error: {e}"
            )
            raise ValueError(f"Session 创建失败: {str(e)}")

    def create_client(
        self,
        service_name: str,
        account_id: str,
        region_name: str | None = None,
    ):
        """
        创建 AWS 服务客户端（AKSK 认证）

        Args:
            service_name: AWS 服务名称（如 's3', 'secretsmanager', 'ce'）
            account_id: 账号 ID（必需）
            region_name: AWS 区域（可选，默认使用账号配置）

        Returns:
            boto3 客户端对象

        Example:
            >>> provider = get_credentials_provider()
            >>> s3_client = provider.create_client('s3', account_id='xxx')
        """
        session = self.create_session(account_id)

        # 使用指定区域或账号默认区域
        if region_name:
            client = session.client(service_name, region_name=region_name)
        else:
            client = session.client(service_name)

        logger.debug(
            f"✅ 客户端创建成功（AKSK）- Service: {service_name}, Account: {account_id}"
        )
        return client

    def get_batch_credentials(
        self, account_ids: list[str]
    ) -> dict[str, dict[str, str]]:
        """批量获取多个账号的凭证

        Args:
            account_ids: 账号 ID 列表

        Returns:
            Dict: 账号 ID -> 凭证字典的映射
                {
                    'account-id-1': {'access_key_id': '...', ...},
                    'account-id-2': {'access_key_id': '...', ...}
                }

        Note:
            如果某个账号获取失败，会记录错误但继续处理其他账号

        Example:
            >>> provider = AWSCredentialsProvider()
            >>> creds = provider.get_batch_credentials(['id1', 'id2'])
            >>> for acc_id, cred in creds.items():
            ...     print(f"{acc_id}: {cred['region']}")
        """
        logger.info(f"📋 批量获取凭证 - 共 {len(account_ids)} 个账号")

        credentials_map = {}

        for account_id in account_ids:
            try:
                credentials = self.get_credentials(account_id)
                credentials_map[account_id] = credentials
            except Exception as e:
                logger.error(f"⚠️  账号 {account_id} 凭证获取失败，跳过: {e}")
                # 继续处理其他账号
                continue

        logger.info(
            f"✅ 批量获取完成 - 成功: {len(credentials_map)}/{len(account_ids)}"
        )

        return credentials_map

    def validate_account(self, account_id: str) -> bool:
        """验证账号凭证是否有效

        Args:
            account_id: 账号 ID

        Returns:
            bool: 凭证是否有效

        Example:
            >>> provider = AWSCredentialsProvider()
            >>> if provider.validate_account('account-id-123'):
            ...     print("凭证有效")
        """
        try:
            credentials = self.get_credentials(account_id)

            # 使用凭证管理器验证
            validation = self.credential_manager.validate_credentials(
                credentials["access_key_id"],
                credentials["secret_access_key"],
                credentials["region"],
            )

            if validation["valid"]:
                logger.info(f"✅ 账号凭证有效 - Account: {credentials['alias']}")
                return True
            else:
                logger.error(
                    f"❌ 账号凭证无效 - Account: {credentials['alias']}, "
                    f"Error: {validation['error']}"
                )
                return False

        except Exception as e:
            logger.error(f"❌ 账号验证失败 - ID: {account_id}, Error: {e}")
            return False

    def get_account_info(self, account_id: str) -> dict | None:
        """获取账号基本信息（不包含敏感凭证）

        Args:
            account_id: 账号 ID

        Returns:
            Optional[Dict]: 账号信息
                {
                    'id': 'account-id-123',
                    'alias': 'Production Account',
                    'account_id': '123456789012',
                    'region': 'us-east-1',
                    'auth_type': 'aksk' | 'iam_role'
                }

        Example:
            >>> provider = AWSCredentialsProvider()
            >>> info = provider.get_account_info('account-id-123')
            >>> print(info['alias'])
            'Production Account'
        """
        account = self.account_storage.get_account(account_id)

        if not account:
            return None

        return {
            "id": account["id"],
            "alias": account.get("alias"),
            "account_id": account.get("account_id"),
            "region": account["region"],
            "auth_type": account.get("auth_type", "aksk"),  # ✅ 添加认证类型
            "description": account.get("description"),
            "is_verified": account.get("is_verified", False),
        }


# 全局单例
_credentials_provider: AWSCredentialsProvider | None = None


def get_credentials_provider() -> AWSCredentialsProvider:
    """获取全局凭证提供服务单例

    Returns:
        AWSCredentialsProvider: 凭证提供服务实例

    Example:
        >>> provider = get_credentials_provider()
        >>> creds = provider.get_credentials('account-id-123')
    """
    global _credentials_provider

    if _credentials_provider is None:
        _credentials_provider = AWSCredentialsProvider()

    return _credentials_provider
