"""GCP 账号存储服务"""

from .gcp_account_storage_postgresql import GCPAccountStoragePostgreSQL

# 导出 PostgreSQL 实现作为默认实现
GCPAccountStorage = GCPAccountStoragePostgreSQL

# 全局单例
_gcp_account_storage = None


def get_gcp_account_storage():
    """获取 GCP 账号存储单例（使用 PostgreSQL）"""
    global _gcp_account_storage
    if _gcp_account_storage is None:
        _gcp_account_storage = GCPAccountStoragePostgreSQL()
    return _gcp_account_storage
