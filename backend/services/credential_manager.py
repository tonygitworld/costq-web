"""AWS 凭证管理器 - 负责加密、解密和验证 AWS 凭证"""

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from cryptography.fernet import Fernet
import logging

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class CredentialManager:
    """AWS 凭证管理器

    功能：
    1. 加密/解密 Secret Access Key
    2. 验证 AWS 凭证有效性
    3. 创建 boto3 Session
    4. 脱敏显示 Access Key
    """

    def __init__(self):
        """初始化凭证管理器

        加密密钥来源（按优先级）：
        1. 环境变量 ENCRYPTION_KEY
        2. 自动生成（仅本地/开发环境，生产环境强制配置）
        """
        key = settings.ENCRYPTION_KEY

        if not key:
            # 生产环境：在settings验证阶段已经阻止，这里是双重保险
            if settings.is_production:
                raise RuntimeError(
                    "生产环境必须设置 ENCRYPTION_KEY！这是一个严重的配置错误。"
                )

            # 非生产环境：生成临时密钥
            key = Fernet.generate_key()
            logger.warning(
                "⚠️  未设置 ENCRYPTION_KEY 环境变量，已生成临时密钥。\n"
                "⚠️  重启后将无法解密已加密的凭证！\n"
                "生成永久密钥: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
        else:
            logger.info("✅ 已从配置加载加密密钥")

        # 确保密钥是 bytes 类型
        if isinstance(key, str):
            key = key.encode()

        self.cipher = Fernet(key)
        # logger.info("✅ 凭证管理器初始化完成")  # 已静默 - 每次查询都重复

    def encrypt_secret_key(self, secret_access_key: str) -> str:
        """加密 Secret Access Key

        Args:
            secret_access_key: 明文 Secret Access Key

        Returns:
            str: Base64 编码的加密密文

        Example:
            >>> manager = CredentialManager()
            >>> encrypted = manager.encrypt_secret_key("wJalrXUtnFEMI...")
            >>> print(encrypted)
            'gAAAAABhY3...'
        """
        try:
            encrypted = self.cipher.encrypt(secret_access_key.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(": %s", e)
            raise ValueError(f"Secret Key 加密失败: {str(e)}")

    def decrypt_secret_key(self, encrypted_secret_key: str) -> str:
        """解密 Secret Access Key

        Args:
            encrypted_secret_key: Base64 编码的加密密文

        Returns:
            str: 明文 Secret Access Key

        Raises:
            ValueError: 解密失败（密钥错误或数据损坏）
        """
        try:
            decrypted = self.cipher.decrypt(encrypted_secret_key.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(": %s", e)
            raise ValueError(f"Secret Key 解密失败，可能是加密密钥不匹配: {str(e)}")

    def validate_credentials(
        self, access_key_id: str, secret_access_key: str, region: str = "us-east-1"
    ) -> dict:
        """验证 AWS 凭证是否有效

        通过调用 STS GetCallerIdentity API 验证凭证。
        该 API 不需要特殊权限，任何有效凭证都可以调用。

        Args:
            access_key_id: Access Key ID
            secret_access_key: Secret Access Key
            region: AWS 区域（默认 us-east-1）

        Returns:
            Dict: 验证结果
                {
                    'valid': True/False,
                    'account_id': '123456789012',  # 如果验证成功
                    'arn': 'arn:aws:iam::...',     # 如果验证成功
                    'user_id': 'AIDAI...',         # 如果验证成功
                    'error': 'error message'        # 如果验证失败
                }

        Example:
            >>> manager = CredentialManager()
            >>> result = manager.validate_credentials('AKIA...', 'wJalr...')
            >>> if result['valid']:
            ...     print(f"Account: {result['account_id']}")
        """
        try:
            # 创建临时 Session
            session = boto3.Session(
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name=region,
            )

            # 调用 STS GetCallerIdentity 验证凭证
            sts = session.client("sts")
            identity = sts.get_caller_identity()

            logger.info(
                f"✅ 凭证验证成功 - Account: {identity['Account']}, ARN: {identity['Arn']}"
            )

            return {
                "valid": True,
                "account_id": identity["Account"],
                "arn": identity["Arn"],
                "user_id": identity["UserId"],
            }

        except NoCredentialsError:
            logger.error("❌ 凭证验证失败: 未提供凭证")
            return {"valid": False, "error": "未提供有效的 AWS 凭证"}

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            error_msg = e.response["Error"]["Message"]

            # 常见错误处理
            if error_code == "InvalidClientTokenId":
                logger.error("❌ 凭证验证失败: Access Key ID 无效")
                return {"valid": False, "error": "Access Key ID 无效或不存在"}
            elif error_code == "SignatureDoesNotMatch":
                logger.error("❌ 凭证验证失败: Secret Access Key 错误")
                return {"valid": False, "error": "Secret Access Key 错误"}
            else:
                logger.error(": %s - %s", error_code, error_msg)
                return {"valid": False, "error": f"{error_code}: {error_msg}"}

        except Exception as e:
            logger.error("❌ 凭证验证失败: 未知错误 - {str(e)}")
            return {"valid": False, "error": f"未知错误: {str(e)}"}

    def create_session(
        self, access_key_id: str, secret_access_key: str, region: str = "us-east-1"
    ) -> boto3.Session:
        """创建 AWS Session

        Args:
            access_key_id: Access Key ID
            secret_access_key: Secret Access Key
            region: AWS 区域

        Returns:
            boto3.Session: AWS Session 对象

        Example:
            >>> manager = CredentialManager()
            >>> session = manager.create_session('AKIA...', 'wJalr...', 'us-east-1')
            >>> ce_client = session.client('ce')
        """
        try:
            session = boto3.Session(
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name=region,
            )
            logger.debug("Session - Region: %s", region)
            return session
        except Exception as e:
            logger.error("Session : %s", e)
            raise ValueError(f"创建 AWS Session 失败: {str(e)}")

    def mask_access_key(self, access_key_id: str) -> str:
        """脱敏显示 Access Key ID

        显示格式：AKIA...MPLE (前4位 + ... + 后4位)

        Args:
            access_key_id: 完整的 Access Key ID

        Returns:
            str: 脱敏后的 Access Key ID

        Example:
            >>> manager = CredentialManager()
            >>> masked = manager.mask_access_key('AKIAIOSFODNN7EXAMPLE')
            >>> print(masked)
            'AKIA...MPLE'
        """
        if not access_key_id or len(access_key_id) < 8:
            return "****"

        return f"{access_key_id[:4]}...{access_key_id[-4:]}"

    def get_encryption_key_info(self) -> dict:
        """获取加密密钥信息（用于诊断）

        Returns:
            Dict: 密钥信息
                {
                    'key_source': 'env' | 'generated',
                    'key_length': 44,  # Fernet key 固定长度
                    'warning': '...'   # 如果是临时密钥
                }
        """
        key_source = "env" if settings.ENCRYPTION_KEY else "generated"

        info = {
            "key_source": key_source,
            "key_length": len(self.cipher._encryption_key),
        }

        if key_source == "generated":
            info["warning"] = (
                "当前使用临时生成的加密密钥，重启后将无法解密已保存的凭证。"
                "生产环境请务必设置 ENCRYPTION_KEY 环境变量！"
            )

        return info


# 全局单例
_credential_manager: CredentialManager | None = None


def get_credential_manager() -> CredentialManager:
    """获取全局凭证管理器单例

    Returns:
        CredentialManager: 凭证管理器实例
    """
    global _credential_manager

    if _credential_manager is None:
        _credential_manager = CredentialManager()

    return _credential_manager
