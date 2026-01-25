"""邮箱验证码模型"""

import enum
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Integer, String

from backend.models.base import Base


class VerificationPurpose(str, enum.Enum):
    """验证码用途"""

    REGISTER = "register"
    RESET_PASSWORD = "reset_password"


class EmailVerificationCode(Base):
    """邮箱验证码表"""

    __tablename__ = "email_verification_codes"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    purpose = Column(String(20), nullable=False, default=VerificationPurpose.REGISTER)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    def is_expired(self) -> bool:
        """检查是否过期"""
        # 使用 UTC 时间进行比较
        now = datetime.now(UTC)
        # 如果 expires_at 没有时区信息，需要处理
        expires = self.expires_at
        if expires.tzinfo is None:
            # naive datetime，假设是 UTC
            from datetime import timezone
            expires = expires.replace(tzinfo=timezone.utc)
        return now > expires

    def is_verified(self) -> bool:
        """检查是否已验证"""
        return self.verified_at is not None

    def can_verify(self) -> bool:
        """检查是否可以验证（未过期、未验证、未超过尝试次数）"""
        return not self.is_expired() and not self.is_verified() and self.attempts < 5

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "email": self.email,
            "code": self.code,
            "purpose": self.purpose,
            "attempts": self.attempts,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "is_expired": self.is_expired(),
            "is_verified": self.is_verified(),
            "can_verify": self.can_verify(),
        }

    def __repr__(self):
        return (
            f"<EmailVerificationCode(email={self.email}, code={self.code}, purpose={self.purpose})>"
        )
