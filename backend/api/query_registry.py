"""查询注册表 - 轻量级状态管理"""

import asyncio
import time
from dataclasses import dataclass

import logging

logger = logging.getLogger(__name__)


@dataclass
class QueryInfo:
    """查询信息"""
    session_id: str | None
    cancel_event: asyncio.Event
    created_at: float


class QueryRegistry:
    """查询注册表 - 轻量级状态管理"""
    
    def __init__(self):
        self._queries: dict[str, QueryInfo] = {}
        self._lock = asyncio.Lock()
    
    async def register(
        self, 
        query_id: str, 
        session_id: str | None, 
        cancel_event: asyncio.Event
    ) -> None:
        """注册查询"""
        async with self._lock:
            self._queries[query_id] = QueryInfo(
                session_id=session_id,
                cancel_event=cancel_event,
                created_at=time.time()
            )
            logger.info("[QueryRegistry] - QueryID: %s, SessionID: %s", query_id, session_id)
    
    async def get(self, query_id: str) -> QueryInfo | None:
        """获取查询信息"""
        async with self._lock:
            return self._queries.get(query_id)
    
    async def cancel(self, query_id: str) -> bool:
        """取消查询"""
        async with self._lock:
            if query_id not in self._queries:
                logger.warning("[QueryRegistry] - QueryID: %s", query_id)
                return False
            
            info = self._queries[query_id]
            info.cancel_event.set()
            logger.info("[QueryRegistry] - QueryID: %s", query_id)
            return True
    
    async def unregister(self, query_id: str) -> None:
        """注销查询"""
        async with self._lock:
            if query_id in self._queries:
                del self._queries[query_id]
                logger.info("[QueryRegistry] - QueryID: %s", query_id)
    
    async def get_session_id(self, query_id: str) -> str | None:
        """获取查询的 session_id"""
        async with self._lock:
            info = self._queries.get(query_id)
            return info.session_id if info else None
    
    def get_stats(self) -> dict:
        """获取统计信息"""
        return {
            "active_queries": len(self._queries),
            "query_ids": list(self._queries.keys())
        }


# 全局单例
query_registry = QueryRegistry()
