"""用户同意记录模型"""

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.models.base import Base


def _utc_now():
    """返回当前 UTC 时间"""
    return datetime.now(timezone.utc)


class ConsentType(str, Enum):
    """同意类型枚举"""

    PRIVACY_POLICY = "privacy_policy"
    TERMS_OF_SERVICE = "terms_of_service"


class UserConsent(Base):
    """用户同意记录表"""

    __tablename__ = "user_consents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_type = Column(String(50), nullable=False)
    consent_version = Column(String(20), nullable=False)
    agreed_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    user = relationship("User", back_populates="consents")

    __table_args__ = (Index("idx_consent_user_type", "user_id", "consent_type"),)
