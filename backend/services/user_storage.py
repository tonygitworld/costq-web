"""用户存储服务"""

from .user_storage_postgresql import UserStoragePostgreSQL

# 导出 PostgreSQL 实现作为默认实现
UserStorage = UserStoragePostgreSQL

# 全局单例
_user_storage = None


def get_user_storage():
    """获取用户存储服务单例（使用 PostgreSQL）"""
    global _user_storage
    if _user_storage is None:
        _user_storage = UserStoragePostgreSQL()
    return _user_storage
