"""SQLAlchemy Models Package"""

# 导入所有模型，确保 SQLAlchemy 能够正确识别关系
from backend.models.alert_execution_log import AlertExecutionLog
from backend.models.aws_account import AWSAccount
from backend.models.base import Base
from backend.models.chat import ChatMessage, ChatSession
from backend.models.gcp_account import GCPAccount
from backend.models.monitoring import AlertHistory, MonitoringConfig
from backend.models.permission import AWSAccountPermission, GCPAccountPermission
from backend.models.prompt_template import PromptTemplate
from backend.models.user import Organization, User

__all__ = [
    "Base",
    "User",
    "Organization",
    "AWSAccountPermission",
    "GCPAccountPermission",
    "ChatSession",
    "ChatMessage",
    "AWSAccount",
    "GCPAccount",
    "PromptTemplate",
    "MonitoringConfig",
    "AlertHistory",
    "AlertExecutionLog",
]
