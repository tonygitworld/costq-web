"""GCP 凭证管理器 - 负责加密、解密和验证 GCP Service Account 凭证"""

import json
import logging

# 复用 AWS 凭证管理器的加密组件
from .credential_manager import get_credential_manager

logger = logging.getLogger(__name__)


class GCPCredentialManager:
    """GCP 凭证管理器

    功能：
    1. 加密/解密 Service Account JSON Key
    2. 验证 GCP 凭证有效性
    3. 脱敏显示 Service Account Email
    """

    def __init__(self):
        """初始化 GCP 凭证管理器

        复用 AWS 凭证管理器的加密密钥，确保加密一致性
        """
        # 获取 AWS 凭证管理器实例（复用其加密组件）
        self.aws_manager = get_credential_manager()
        self.cipher = self.aws_manager.cipher
        # logger.info("✅ GCP 凭证管理器初始化完成（复用 AWS 加密密钥）")  # 已静默 - 每次查询都重复

    def validate_credentials(self, service_account_json: dict) -> dict:
        """验证 GCP Service Account 凭证

        Args:
            service_account_json: Service Account JSON Key

        Returns:
            {
                'valid': bool,
                'project_id': str,
                'service_account_email': str,
                'organization_id': Optional[str],
                'billing_account_id': Optional[str],
                'error': Optional[str]
            }
        """
        try:
            # 导入 GCP 依赖（延迟导入，避免启动时必须安装）
            try:
                from google.cloud import resourcemanager_v3
                from google.oauth2 import service_account
            except ImportError as e:
                logger.error("GCP SDK : %s", e)
                return {
                    "valid": False,
                    "project_id": None,
                    "service_account_email": None,
                    "organization_id": None,
                    "billing_account_id": None,
                    "error": "缺少 GCP SDK 依赖，请安装: pip install google-cloud-billing google-cloud-resource-manager",
                }

            # 1. 提取基本信息
            project_id = service_account_json.get("project_id")
            service_account_email = service_account_json.get("client_email")

            if not project_id or not service_account_email:
                return {
                    "valid": False,
                    "project_id": None,
                    "service_account_email": None,
                    "organization_id": None,
                    "billing_account_id": None,
                    "error": "Service Account JSON 缺少 project_id 或 client_email",
                }

            logger.info(
                f"验证 GCP 凭证 - Project: {project_id}, SA: {service_account_email}"
            )

            # 2. 创建凭据对象
            try:
                credentials = service_account.Credentials.from_service_account_info(
                    service_account_json,
                    scopes=["https://www.googleapis.com/auth/cloud-platform.read-only"],
                )
            except Exception as e:
                logger.error(": %s", e)
                return {
                    "valid": False,
                    "project_id": project_id,
                    "service_account_email": service_account_email,
                    "organization_id": None,
                    "billing_account_id": None,
                    "error": f"Service Account JSON 格式错误: {str(e)}",
                }

            # 3. 尝试调用 API 验证（获取项目信息）
            organization_id = None
            try:
                projects_client = resourcemanager_v3.ProjectsClient(
                    credentials=credentials
                )
                project = projects_client.get_project(name=f"projects/{project_id}")

                # 提取组织ID（如果有）
                if project.parent:
                    parent = project.parent
                    if parent.startswith("organizations/"):
                        organization_id = parent.replace("organizations/", "")

                logger.info("✅ GCP API 调用成功 - 项目已验证")
            except Exception as e:
                logger.warning(": %s", e)
                # 不将此视为验证失败，因为凭据本身可能是有效的

            # 4. 尝试获取计费账号信息（可选）
            billing_account_id = None
            try:
                from google.cloud import billing_v1

                billing_client = billing_v1.CloudBillingClient(credentials=credentials)

                # 获取项目的计费信息
                project_billing_info = billing_client.get_project_billing_info(
                    name=f"projects/{project_id}"
                )

                if project_billing_info.billing_account_name:
                    billing_account_id = (
                        project_billing_info.billing_account_name.split("/")[-1]
                    )

                logger.info("- Billing: %s", billing_account_id)
            except Exception as e:
                logger.warning(": %s", e)
                # 同样不视为验证失败

            return {
                "valid": True,
                "project_id": project_id,
                "service_account_email": service_account_email,
                "organization_id": organization_id,
                "billing_account_id": billing_account_id,
                "error": None,
            }

        except Exception as e:
            logger.error("GCP : %s", e)
            return {
                "valid": False,
                "project_id": None,
                "service_account_email": None,
                "organization_id": None,
                "billing_account_id": None,
                "error": f"验证失败: {str(e)}",
            }

    def encrypt_credentials(self, credentials_json: dict) -> str:
        """加密 Service Account JSON

        Args:
            credentials_json: Service Account JSON Key

        Returns:
            加密后的字符串
        """
        try:
            json_str = json.dumps(credentials_json, ensure_ascii=False)
            encrypted = self.cipher.encrypt(json_str.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(": %s", e)
            raise ValueError(f"Service Account JSON 加密失败: {str(e)}")

    def decrypt_credentials(self, encrypted: str) -> dict:
        """解密 Service Account JSON

        Args:
            encrypted: 加密的字符串

        Returns:
            Service Account JSON Key
        """
        try:
            decrypted = self.cipher.decrypt(encrypted.encode())
            return json.loads(decrypted.decode())
        except Exception as e:
            logger.error(": %s", e)
            raise ValueError(
                f"Service Account JSON 解密失败，可能是加密密钥不匹配: {str(e)}"
            )

    def mask_service_account_email(self, email: str) -> str:
        """脱敏 Service Account Email

        Args:
            email: service-account@project.iam.gserviceaccount.com

        Returns:
            ser***ount@pro***ject.iam.gserviceaccount.com
        """
        if not email or "@" not in email:
            return "****"

        local, domain = email.split("@", 1)

        # 脱敏本地部分
        if len(local) <= 6:
            masked_local = local[:2] + "***"
        else:
            masked_local = local[:3] + "***" + local[-3:]

        # 脱敏域名中的项目 ID
        if "." in domain:
            parts = domain.split(".")
            project_part = parts[0]

            if len(project_part) <= 6:
                masked_project = project_part[:2] + "***"
            else:
                masked_project = project_part[:3] + "***"

            masked_domain = masked_project + "." + ".".join(parts[1:])
        else:
            masked_domain = domain[:3] + "***"

        return f"{masked_local}@{masked_domain}"


# 全局单例
_gcp_credential_manager: GCPCredentialManager | None = None


def get_gcp_credential_manager() -> GCPCredentialManager:
    """获取 GCP 凭证管理器单例

    Returns:
        GCPCredentialManager: GCP 凭证管理器实例
    """
    global _gcp_credential_manager

    if _gcp_credential_manager is None:
        _gcp_credential_manager = GCPCredentialManager()

    return _gcp_credential_manager
