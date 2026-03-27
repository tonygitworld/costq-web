"""Invoice 只读模型 - 客户侧仅用于查询，与 costq-admin 共享同一张表"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.models.base import Base


def _utc_now():
    return datetime.now(timezone.utc)


class Invoice(Base):
    """Invoice 表（只读）"""

    __tablename__ = "invoices"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False,
    )
    invoice_number = Column(String(30), nullable=False, unique=True)
    version = Column(Integer, nullable=False, default=1)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    cloud_cost_total = Column(Numeric(15, 2), nullable=False, default=0)
    costq_fee = Column(Numeric(15, 2), nullable=False, default=0)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="USD")
    status = Column(String(20), nullable=False, default="pending")
    s3_path = Column(String(500), nullable=True)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "organization_id": str(self.organization_id),
            "invoice_number": self.invoice_number,
            "version": self.version,
            "period_year": self.period_year,
            "period_month": self.period_month,
            "cloud_cost_total": float(self.cloud_cost_total or 0),
            "costq_fee": float(self.costq_fee or 0),
            "total_amount": float(self.total_amount or 0),
            "currency": self.currency,
            "status": self.status,
            "generated_at": (
                self.generated_at.isoformat() if self.generated_at else None
            ),
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }
