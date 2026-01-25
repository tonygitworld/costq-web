"""用户模型"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from backend.models.base import Base


def _utc_now():
    """返回当前 UTC 时间（用于 SQLAlchemy default）"""
    return datetime.now(timezone.utc)


class Organization(Base):
    """组织表（多租户）"""

    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    external_id = Column(String(255), unique=True, nullable=True)  # IAM Role External ID

    # 租户启用/禁用（用于注册审核）
    is_active = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False)

    # 关联关系
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    monitoring_configs = relationship(
        "MonitoringConfig", back_populates="organization", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """转换为字典"""
        return {
            "id": str(self.id),  # UUID 转字符串
            "name": self.name,
            "is_active": self.is_active,  # ✅ 新增
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Organization(name={self.name})>"


class User(Base):
    """用户表"""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    org_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # 'admin' or 'user'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)  # 最后登录时间

    # 关联关系
    organization = relationship("Organization", back_populates="users")
    monitoring_configs = relationship(
        "MonitoringConfig", back_populates="user", cascade="all, delete-orphan"
    )

    aws_permissions = relationship(
        "AWSAccountPermission",
        foreign_keys="AWSAccountPermission.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    gcp_permissions = relationship(
        "GCPAccountPermission",
        foreign_keys="GCPAccountPermission.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # ✅ 新增：聊天会话关联
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        """转换为字典"""
        return {
            "id": str(self.id),  # UUID 转字符串
            "org_id": str(self.org_id),  # UUID 转字符串
            "username": self.username,
            "email": self.email,
            "password_hash": self.hashed_password,  # API 兼容性：数据库字段是 hashed_password
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }

    def __repr__(self):
        return f"<User(username={self.username}, role={self.role})>"
