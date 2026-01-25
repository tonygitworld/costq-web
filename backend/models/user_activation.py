"""用户激活Token模型"""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, String

from backend.models.base import Base


class UserActivationToken(Base):
    """用户激活Token表"""

    __tablename__ = "user_activation_tokens"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token = Column(String(128), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)

    def is_expired(self) -> bool:
        """检查是否过期"""
        return datetime.now(UTC) > self.expires_at

    def is_used(self) -> bool:
        """检查是否已使用"""
        return self.used_at is not None

    def can_use(self) -> bool:
        """检查是否可以使用（未过期、未使用）"""
        return not self.is_expired() and not self.is_used()

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token": self.token,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "used_at": self.used_at.isoformat() if self.used_at else None,
            "is_expired": self.is_expired(),
            "is_used": self.is_used(),
            "can_use": self.can_use(),
        }

    def __repr__(self):
        return f"<UserActivationToken(email={self.email}, token={self.token[:16]}...)>"
