"""AWS 账号信息提供服务

该服务负责：
1. 根据 account_id 从数据库获取账号基本信息
2. 不包含凭证相关功能（凭证由 AgentCore Runtime 负责）

注意：凭证获取功能已移至 costq-agents 仓库（AgentCore Runtime 内运行）
"""

import logging

from .account_storage import get_account_storage

logger = logging.getLogger(__name__)


class AWSCredentialsProvider:
    """AWS 账号信息提供服务

    提供账号元数据查询功能（不包含凭证）

    注意：
    - 凭证获取由 AgentCore Runtime 负责
    - 本模块仅提供账号基本信息查询
    """

    def __init__(self):
        self.account_storage = get_account_storage()

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
            "auth_type": account.get("auth_type", "aksk"),
            "description": account.get("description"),
            "is_verified": account.get("is_verified", False),
        }


# 全局单例
_credentials_provider: AWSCredentialsProvider | None = None


def get_credentials_provider() -> AWSCredentialsProvider:
    """获取全局账号信息提供服务单例

    Returns:
        AWSCredentialsProvider: 账号信息提供服务实例

    Example:
        >>> provider = get_credentials_provider()
        >>> info = provider.get_account_info('account-id-123')
    """
    global _credentials_provider

    if _credentials_provider is None:
        _credentials_provider = AWSCredentialsProvider()

    return _credentials_provider
