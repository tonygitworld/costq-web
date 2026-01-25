"""权限模型 - 云账号授权"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.models.base import Base


def _utc_now():
    """返回当前 UTC 时间（用于 SQLAlchemy default）"""
    return datetime.now(timezone.utc)


class AWSAccountPermission(Base):
    """AWS账号权限表"""

    __tablename__ = "aws_account_permissions"
    __table_args__ = (UniqueConstraint("user_id", "account_id", name="uix_user_aws_account"),)

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(String(36), nullable=False)  # AWS账号ID（关联aws_accounts表）
    granted_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)

    # 关联关系
    user = relationship("User", foreign_keys=[user_id], back_populates="aws_permissions")
    grantor = relationship("User", foreign_keys=[granted_by])

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "account_id": self.account_id,
            "granted_by": self.granted_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class GCPAccountPermission(Base):
    """GCP账号权限表"""

    __tablename__ = "gcp_account_permissions"
    __table_args__ = (UniqueConstraint("user_id", "account_id", name="uix_user_gcp_account"),)

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(String(36), nullable=False)  # GCP账号ID（关联gcp_accounts表）
    granted_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)

    # 关联关系
    user = relationship("User", foreign_keys=[user_id], back_populates="gcp_permissions")
    grantor = relationship("User", foreign_keys=[granted_by])

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "account_id": self.account_id,
            "granted_by": self.granted_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
