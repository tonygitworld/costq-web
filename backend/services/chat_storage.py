"""聊天历史存储服务"""

from .chat_storage_postgresql import ChatStoragePostgreSQL

# 导出 PostgreSQL 实现作为默认实现
ChatStorage = ChatStoragePostgreSQL

# 全局单例
_chat_storage = None


def get_chat_storage():
    """获取聊天存储服务实例（使用 PostgreSQL）"""
    global _chat_storage
    if _chat_storage is None:
        _chat_storage = ChatStoragePostgreSQL()
    return _chat_storage
