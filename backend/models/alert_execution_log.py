"""告警执行日志数据库模型

记录每次告警检查的详细执行过程，用于调试、审计和性能监控
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from backend.models.base import Base


class AlertExecutionLog(Base):
    """告警执行日志表

    记录每次告警检查的详细执行过程，包括：
    - 测试模式执行（用户手动触发）
    - 定时任务执行（系统自动触发）

    用途：
    1. 调试：帮助用户验证告警配置是否正确
    2. 审计：记录所有告警执行历史
    3. 监控：统计执行成功率、性能等指标
    """

    __tablename__ = "alert_execution_logs"

    # ============ 主键 ============
    id = Column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="执行日志ID"
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
        comment="组织ID（多租户隔离）",
    )

    # ============ 执行信息 ============
    execution_type = Column(
        String(20), nullable=False, comment="执行类型：test（测试）/ scheduled（定时任务）"
    )

    triggered_by_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="触发用户ID（测试模式时有值，定时任务时为NULL）",
    )

    account_id = Column(String(36), nullable=True, comment="使用的账号ID")

    account_type = Column(String(10), nullable=True, comment="账号类型：aws 或 gcp")

    # ============ 执行结果 ============
    success = Column(Boolean, nullable=False, default=False, comment="执行是否成功")

    triggered = Column(
        Boolean, nullable=False, default=False, comment="是否触发告警（满足阈值条件）"
    )

    current_value = Column(JSON, nullable=True, comment="当前查询到的值（数值、列表或对象）")

    threshold = Column(Float, nullable=True, comment="阈值")

    threshold_operator = Column(String(10), nullable=True, comment="比较运算符（>, <, >=, <=, =）")

    email_sent = Column(Boolean, nullable=False, default=False, comment="是否发送邮件")

    to_emails = Column(
        JSON, nullable=True, comment="收件人邮箱列表 ['email1@example.com', 'email2@example.com']"
    )

    # ============ 详细日志 ============
    execution_steps = Column(
        JSON,
        nullable=True,
        comment="执行步骤详细日志（JSON数组，每个步骤包含action、result、timestamp）",
    )

    agent_response = Column(Text, nullable=True, comment="Agent 原始响应（完整文本，用于调试）")

    error_message = Column(Text, nullable=True, comment="错误信息（执行失败时记录详细错误）")

    # ============ 性能指标 ============
    execution_duration_ms = Column(Integer, nullable=True, comment="执行耗时（毫秒）")

    # ============ 时间戳 ============
    started_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        comment="开始执行时间",
    )

    completed_at = Column(DateTime(timezone=True), nullable=True, comment="完成执行时间")

    # ============ 关系 ============
    monitoring_config = relationship("MonitoringConfig", back_populates="execution_logs")
    organization = relationship("Organization")
    triggered_by = relationship("User")

    # ============ 索引 ============
    __table_args__ = (
        # 按告警ID和时间查询（告警详情页的执行历史列表）
        Index("idx_execution_log_alert_time", "alert_id", "started_at"),
        # 按组织ID和时间查询（组织级别的执行统计）
        Index("idx_execution_log_org_time", "org_id", "started_at"),
        # 按执行类型查询（区分测试和定时任务）
        Index("idx_execution_log_type", "execution_type"),
        # 按触发状态查询（统计触发率）
        Index("idx_execution_log_triggered", "triggered"),
        # 按成功状态查询（监控成功率）
        Index("idx_execution_log_success", "success"),
    )

    def to_dict(self):
        """转换为字典（用于API响应）

        包含前端期望的字段映射
        """
        # 构造结果摘要
        if self.agent_response:
            try:
                import json

                response_data = json.loads(self.agent_response)
                result_summary = response_data.get("message", "")
            except:
                result_summary = self.agent_response[:200] if self.agent_response else ""
        else:
            result_summary = ""

        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "org_id": self.org_id,
            "execution_type": self.execution_type,
            "triggered_by_user_id": self.triggered_by_user_id,
            "account_id": self.account_id,
            "account_type": self.account_type,
            "success": self.success,
            "triggered": self.triggered,
            "current_value": self.current_value,
            "threshold": self.threshold,
            "threshold_operator": self.threshold_operator,
            "email_sent": self.email_sent,
            "to_emails": self.to_emails,
            "execution_steps": self.execution_steps,
            "agent_response": self.agent_response,
            "error_message": self.error_message,
            "execution_duration_ms": self.execution_duration_ms,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            # ✅ 前端期望的字段映射
            "executed_at": self.started_at.isoformat() if self.started_at else None,
            "status": "success" if self.success else "failed",
            "result_summary": result_summary,
        }
