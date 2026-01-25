"""聊天会话和消息模型（PostgreSQL）"""

from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.models.base import Base


def _utc_now():
    """返回当前 UTC 时间（用于 SQLAlchemy default）"""
    return datetime.now(timezone.utc)


class ChatSession(Base):
    """聊天会话表（PostgreSQL）"""

    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id = Column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 基本信息
    title = Column(String(255), nullable=False, default="新对话")
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # 统计信息
    message_count = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)

    # 配置信息
    model_config = Column(JSON, default=dict)

    # 关联关系（使用字符串避免循环导入）
    user = relationship("User", foreign_keys=[user_id], back_populates="chat_sessions")
    organization = relationship("Organization", foreign_keys=[org_id])
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )

    def to_dict(self):
        """转换为字典"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "org_id": str(self.org_id),
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "message_count": self.message_count,
            "total_tokens": self.total_tokens,
            "model_config": self.model_config,
        }

    def __repr__(self):
        return f"<ChatSession(title={self.title}, user_id={self.user_id})>"


class ChatMessage(Base):
    """聊天消息表（PostgreSQL）"""

    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True)
    session_id = Column(
        String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 消息内容
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system', 'tool'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False, index=True)

    # Token统计
    token_count = Column(Integer, nullable=True)

    # 工具调用（JSON格式）
    tool_calls = Column(JSON, nullable=True)
    tool_results = Column(JSON, nullable=True)

    # 元数据（使用message_metadata避免与SQLAlchemy的metadata冲突）
    message_metadata = Column(JSON, default=dict)

    # 关联关系（使用字符串避免循环导入）
    session = relationship("ChatSession", back_populates="messages")
    user = relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        """转换为字典"""
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "user_id": str(self.user_id),
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "token_count": self.token_count,
            "tool_calls": self.tool_calls,
            "tool_results": self.tool_results,
            "metadata": self.message_metadata,  # 返回时使用metadata字段名（兼容API）
        }

    def __repr__(self):
        return f"<ChatMessage(role={self.role}, session_id={self.session_id})>"
