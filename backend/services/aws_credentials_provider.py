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


# ========== IAM Role 验证（独立函数） ==========


def validate_iam_role(
    role_arn: str, external_id: str, region: str = "us-east-1"
) -> dict[str, any]:
    """验证 IAM Role（通过尝试 AssumeRole）

    注意：此函数仅用于验证 IAM Role 是否可访问，不属于凭证管理范畴。
    验证是一次性操作，用于创建账号时检查配置是否正确。

    Args:
        role_arn: IAM Role ARN (例如: arn:aws:iam::123456789012:role/CostQRole)
        external_id: External ID（用于防止混淆代理人攻击）
        region: AWS 区域

    Returns:
        Dict: 验证结果
            {
                'valid': bool,
                'account_id': str,  # 如果成功
                'arn': str,         # 如果成功
                'error': str        # 如果失败
            }

    Example:
        >>> result = validate_iam_role(
        ...     role_arn='arn:aws:iam::123456789012:role/CostQRole',
        ...     external_id='unique-external-id',
        ...     region='us-east-1'
        ... )
        >>> if result['valid']:
        ...     print(f"Account ID: {result['account_id']}")
    """
    import boto3

    try:
        # 创建 STS 客户端（使用平台自己的凭证）
        sts = boto3.client("sts", region_name=region)

        # 尝试 AssumeRole
        response = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName="costq-validation",
            ExternalId=external_id,
            DurationSeconds=900,  # 15 分钟，仅用于验证
        )

        # 从 AssumedRole ARN 提取 Account ID
        # 格式: arn:aws:sts::123456789012:assumed-role/RoleName/SessionName
        assumed_role_arn = response["AssumedRoleUser"]["Arn"]
        account_id = assumed_role_arn.split(":")[4]

        logger.info(f"✅ IAM Role 验证成功 - ARN: {role_arn}, Account: {account_id}")

        return {"valid": True, "account_id": account_id, "arn": role_arn}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ IAM Role 验证失败 - ARN: {role_arn}, Error: {error_msg}")

        return {"valid": False, "error": error_msg}
