"""告警监控数据库模型

包含告警配置和告警历史两个表，支持多租户隔离
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from backend.models.base import Base


class MonitoringConfig(Base):
    """告警配置表（纯自然语言架构）

    核心设计：
    - query_description: 完整的自然语言描述（唯一的执行依据）
    - Agent 自主解析并执行查询、判断阈值、发送邮件
    - 多租户隔离：org_id + user_id
    """

    __tablename__ = "monitoring_configs"

    # ============ 主键和租户关联 ============
    id = Column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="告警配置ID"
    )

    org_id = Column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="组织ID（多租户隔离）",
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="创建用户ID",
    )

    # ============ 核心字段（唯一的执行依据）============
    query_description = Column(
        Text,
        nullable=False,
        comment="完整的自然语言描述，包含所有执行逻辑。例如：'每天查询prod-01账号的SP覆盖率，如果低于70%，发邮件给aaa@aaa.com'",
    )

    # ============ 账号关联字段 ============
    account_id = Column(
        String(36),
        nullable=True,
        index=True,
        comment="关联的账号ID（AWS或GCP账号的UUID）（可选，如果不指定则从query_description中提取或使用默认账号）",
    )

    account_type = Column(
        String(10), nullable=True, comment="账号类型：aws 或 gcp（可选，与account_id配套使用）"
    )

    # ============ 元数据字段（仅用于UI展示和管理）============
    display_name = Column(String(200), nullable=False, comment="告警显示名称，用于UI列表展示")

    # ============ 调度和状态 ============
    is_active = Column(Boolean, default=True, nullable=False, index=True, comment="是否启用")

    check_frequency = Column(
        String(20),
        default="daily",
        nullable=False,
        comment="检查频率：hourly/daily/weekly/monthly（用于调度优化）",
    )

    # ============ 时间戳 ============
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        comment="创建时间",
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        comment="更新时间",
    )

    last_checked_at = Column(DateTime(timezone=True), nullable=True, comment="最后检查时间")

    # ============ 关系 ============
    organization = relationship("Organization", back_populates="monitoring_configs")
    user = relationship("User", back_populates="monitoring_configs")
    alert_histories = relationship(
        "AlertHistory", back_populates="monitoring_config", cascade="all, delete-orphan"
    )
    execution_logs = relationship(
        "AlertExecutionLog", back_populates="monitoring_config", cascade="all, delete-orphan"
    )

    # ============ 索引 ============
    __table_args__ = (
        Index("idx_monitoring_org_active", "org_id", "is_active"),
        Index("idx_monitoring_user_active", "user_id", "is_active"),
        Index("idx_monitoring_frequency_active", "check_frequency", "is_active"),
    )

    def to_dict(self):
        """转换为字典（用于API响应）"""
        # 获取创建者用户名（如果关联加载）
        created_by_username = None
        if hasattr(self, "user") and self.user:
            created_by_username = self.user.username

        return {
            "id": self.id,
            "org_id": self.org_id,
            "user_id": self.user_id,
            "description": self.query_description,  # ✅ 映射到前端期望的字段名
            "query_description": self.query_description,  # 保留原字段名用于兼容
            "display_name": self.display_name,
            "account_id": self.account_id,  # ⭐ 新增：关联的账号ID
            "account_type": self.account_type,  # ⭐ 新增：账号类型（aws/gcp）
            "is_active": self.is_active,
            "check_frequency": self.check_frequency,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_executed_at": self.last_checked_at.isoformat()
            if self.last_checked_at
            else None,  # ✅ 映射到前端期望的字段名
            "last_checked_at": self.last_checked_at.isoformat()
            if self.last_checked_at
            else None,  # 保留原字段名用于兼容
            "created_by_username": created_by_username,  # ✅ 添加前端期望的字段
        }


class AlertHistory(Base):
    """告警历史表

    记录每次告警执行的结果
    """

    __tablename__ = "alert_history"

    # ============ 主键 ============
    id = Column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="历史记录ID"
    )

    # ============ 关联字段 ============
    alert_id = Column(
        String(36),
        ForeignKey("monitoring_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联的告警配置ID",
    )

    org_id = Column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="组织ID（冗余存储，性能优化）",
    )

    # ============ 执行结果 ============
    triggered = Column(Boolean, nullable=False, default=False, comment="是否触发告警")

    current_value = Column(Float, nullable=True, comment="当前值（如果可提取）")

    # ============ 邮件发送状态 ============
    email_sent = Column(Boolean, nullable=False, default=False, comment="邮件是否发送成功")

    email_error = Column(Text, nullable=True, comment="邮件发送错误信息")

    # ============ 完整执行结果（JSON）============
    execution_result = Column(
        JSON, nullable=True, comment="完整的执行结果（JSON格式），包含Agent响应、查询结果等"
    )

    error_message = Column(Text, nullable=True, comment="执行错误信息")

    # ============ 时间戳 ============
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        comment="执行时间",
    )

    # ============ 关系 ============
    monitoring_config = relationship("MonitoringConfig", back_populates="alert_histories")
    organization = relationship("Organization")

    # ============ 索引 ============
    __table_args__ = (
        Index("idx_alert_history_alert_triggered", "alert_id", "triggered"),
        Index("idx_alert_history_created_at", "created_at"),
        Index("idx_alert_history_org_created", "org_id", "created_at"),
    )

    def to_dict(self):
        """转换为字典（用于API响应）"""
        # 判断执行状态
        status = "success" if not self.error_message else "failed"

        # 生成结果摘要
        result_summary = ""
        if self.triggered:
            result_summary = "告警已触发"
            if self.current_value is not None:
                result_summary += f"，当前值: {self.current_value}"
        else:
            result_summary = "未触发告警"

        if self.email_sent:
            result_summary += " | 邮件已发送"
        elif self.email_error:
            result_summary += f" | 邮件发送失败: {self.email_error}"

        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "org_id": self.org_id,
            "triggered": self.triggered,
            "current_value": self.current_value,
            "email_sent": self.email_sent,
            "email_error": self.email_error,
            "execution_result": self.execution_result,
            "error_message": self.error_message,
            "executed_at": self.created_at.isoformat()
            if self.created_at
            else None,  # ✅ 映射到前端期望的字段名
            "created_at": self.created_at.isoformat()
            if self.created_at
            else None,  # 保留原字段名用于兼容
            "status": status,  # ✅ 添加前端期望的status字段
            "result_summary": result_summary,  # ✅ 添加前端期望的result_summary字段
        }
