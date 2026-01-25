"""AWS 账号存储服务"""

from .account_storage_postgresql import AccountStoragePostgreSQL

# 导出 PostgreSQL 实现作为默认实现
AccountStorage = AccountStoragePostgreSQL

# 全局单例
_account_storage = None


def get_account_storage():
    """获取账号存储服务单例（使用 PostgreSQL）"""
    global _account_storage
    if _account_storage is None:
        _account_storage = AccountStoragePostgreSQL()
    return _account_storage
