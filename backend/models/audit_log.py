"""审计日志模型"""

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.sql import func

from backend.models.base import Base


class AuditLog(Base):
    """审计日志表"""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50))
    resource_id = Column(String(255))
    details = Column(Text)  # JSON string
    ip_address = Column(String(45))
    user_agent = Column(String(255))
    timestamp = Column(DateTime, default=func.now(), index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "org_id": self.org_id,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
