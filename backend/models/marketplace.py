"""AWS Marketplace 相关模型"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    BIGINT,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from backend.models.base import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MarketplaceCustomer(Base):
    """Marketplace buyer 与本地组织的绑定关系"""

    __tablename__ = "marketplace_customers"
    __table_args__ = (
        UniqueConstraint("product_code", "customer_identifier", name="uq_mp_customer_identifier"),
        UniqueConstraint(
            "product_code", "customer_aws_account_id", name="uq_mp_customer_account_id"
        ),
        Index("idx_mp_customers_org_id", "organization_id"),
        Index("idx_mp_customers_status", "subscription_status"),
    )

    id = Column(String(36), primary_key=True)
    product_code = Column(String(64), nullable=False)
    customer_identifier = Column(String(255), nullable=True)
    customer_aws_account_id = Column(String(12), nullable=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    primary_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    subscription_status = Column(String(32), nullable=False, default="pending")
    onboarding_status = Column(String(32), nullable=False, default="pending")
    latest_license_arn = Column(String(255), nullable=True)
    resolve_payload = Column(JSONB, nullable=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    organization = relationship("Organization")
    primary_user = relationship("User")
    agreements = relationship(
        "MarketplaceAgreement", back_populates="marketplace_customer", cascade="all, delete-orphan"
    )
    onboarding_sessions = relationship(
        "MarketplaceOnboardingSession",
        back_populates="marketplace_customer",
        cascade="all, delete-orphan",
    )
    metering_records = relationship(
        "MarketplaceMeteringRecord",
        back_populates="marketplace_customer",
        cascade="all, delete-orphan",
    )


class MarketplaceAgreement(Base):
    """Marketplace agreement / entitlement 状态"""

    __tablename__ = "marketplace_agreements"
    __table_args__ = (
        UniqueConstraint("agreement_id", name="uq_mp_agreement_id"),
        UniqueConstraint("license_arn", name="uq_mp_license_arn"),
        Index("idx_mp_agreements_customer_id", "marketplace_customer_id"),
        Index("idx_mp_agreements_status", "status"),
    )

    id = Column(String(36), primary_key=True)
    marketplace_customer_id = Column(
        String(36), ForeignKey("marketplace_customers.id"), nullable=False
    )
    agreement_id = Column(String(255), nullable=True)
    license_arn = Column(String(255), nullable=True)
    offer_id = Column(String(255), nullable=True)
    status = Column(String(32), nullable=False, default="active")
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    dimensions = Column(JSONB, nullable=True)
    entitlement_payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    marketplace_customer = relationship("MarketplaceCustomer", back_populates="agreements")


class MarketplaceOnboardingSession(Base):
    """订阅跳转后的临时 onboarding session"""

    __tablename__ = "marketplace_onboarding_sessions"
    __table_args__ = (
        UniqueConstraint("session_token", name="uq_mp_onboarding_session_token"),
        Index("idx_mp_onboarding_customer_id", "marketplace_customer_id"),
        Index("idx_mp_onboarding_status", "status"),
    )

    id = Column(String(36), primary_key=True)
    marketplace_customer_id = Column(
        String(36), ForeignKey("marketplace_customers.id"), nullable=False
    )
    session_token = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    claimed_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: _utc_now() + timedelta(hours=2),
    )
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    session_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    marketplace_customer = relationship(
        "MarketplaceCustomer", back_populates="onboarding_sessions"
    )
    claimed_by_user = relationship("User")


class MarketplaceNotification(Base):
    """Marketplace SNS / entitlement 通知审计表"""

    __tablename__ = "marketplace_notifications"
    __table_args__ = (
        UniqueConstraint("message_id", name="uq_mp_notification_message_id"),
        Index("idx_mp_notifications_type", "notification_type"),
        Index("idx_mp_notifications_status", "processing_status"),
    )

    id = Column(String(36), primary_key=True)
    message_id = Column(String(255), nullable=False)
    notification_type = Column(String(64), nullable=False)
    action = Column(String(64), nullable=True)
    topic_arn = Column(String(255), nullable=True)
    processing_status = Column(String(32), nullable=False, default="received")
    signature_verified = Column(Boolean, nullable=False, default=False)
    payload = Column(JSONB, nullable=False)
    error_message = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)


class MarketplaceMeteringRecord(Base):
    """Marketplace usage metering 上报记录"""

    __tablename__ = "marketplace_metering_records"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_mp_metering_idempotency_key"),
        Index("idx_mp_metering_customer_id", "marketplace_customer_id"),
        Index("idx_mp_metering_dimension_hour", "usage_dimension", "usage_hour"),
        Index("idx_mp_metering_status", "metering_status"),
    )

    id = Column(String(36), primary_key=True)
    marketplace_customer_id = Column(
        String(36), ForeignKey("marketplace_customers.id"), nullable=False
    )
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    agreement_id = Column(String(255), nullable=True)
    license_arn = Column(String(255), nullable=True)
    customer_aws_account_id = Column(String(12), nullable=True)
    usage_dimension = Column(String(64), nullable=False)
    usage_hour = Column(DateTime(timezone=True), nullable=False)
    metered_quantity = Column(BIGINT, nullable=False, default=0)
    cumulative_quantity = Column(BIGINT, nullable=False, default=0)
    cloud_spend_snapshot_cents = Column(BIGINT, nullable=True)
    metering_status = Column(String(32), nullable=False, default="pending")
    attempt_count = Column(Integer, nullable=False, default=0)
    idempotency_key = Column(String(255), nullable=False)
    aws_metering_record_id = Column(String(255), nullable=True)
    aws_response = Column(JSONB, nullable=True)
    last_error = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    marketplace_customer = relationship(
        "MarketplaceCustomer", back_populates="metering_records"
    )
    organization = relationship("Organization")
