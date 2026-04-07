"""告警可观测性增强 - 单元测试

覆盖：
- ALERT_MODEL_ID 常量正确性及失败策略
- AuditLogger.log_alert_execute 方法
- user_id 语义（测试执行 vs 定时执行）
- runtime_session_id / token_usage 缺失时的 NULL 处理
- Agent 忽略 execution_log_id 注入指令时不影响执行结果
"""

from unittest.mock import MagicMock, patch

import pytest


# ============ ALERT_MODEL_ID 常量 ============

def test_alert_model_id_constant():
    """ALERT_MODEL_ID 应存在且为非空字符串"""
    from backend.services.alert_service import ALERT_MODEL_ID

    assert isinstance(ALERT_MODEL_ID, str)
    assert len(ALERT_MODEL_ID) > 0
    assert "haiku" in ALERT_MODEL_ID.lower()


def test_alert_model_id_raises_on_missing():
    """当 AVAILABLE_MODELS 中不存在 haiku45 时，_get_alert_model_id 应抛出 ValueError"""
    from backend.services.alert_service import _get_alert_model_id

    with patch("backend.services.alert_service.AVAILABLE_MODELS", []):
        with pytest.raises(ValueError, match="haiku45"):
            _get_alert_model_id()


# ============ AuditLogger.log_alert_execute ============

def test_log_alert_execute_method_exists():
    """AuditLogger 应有 log_alert_execute 方法"""
    from backend.services.audit_logger import AuditLogger

    assert hasattr(AuditLogger, "log_alert_execute")
    assert callable(getattr(AuditLogger, "log_alert_execute"))


def test_log_alert_execute_details_complete():
    """log_alert_execute 写入的 details 应包含 execution_log_id、token_usage、model_id"""
    from backend.services.audit_logger import AuditLogger

    logger = AuditLogger()
    captured = {}

    def mock_log(**kwargs):
        captured.update(kwargs)

    logger.log = mock_log
    logger.log_alert_execute(
        org_id="org-1",
        alert_id="alert-1",
        execution_log_id="exec-123",
        token_usage={"input_tokens": 100, "output_tokens": 50},
        model_id="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        user_id="user-1",
    )

    assert captured["details"]["execution_log_id"] == "exec-123"
    assert captured["details"]["token_usage"] == {"input_tokens": 100, "output_tokens": 50}
    assert captured["details"]["model_id"] == "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
    assert captured["action"] == "alert_execute"
    assert captured["resource_type"] == "alert"
    assert captured["resource_id"] == "alert-1"


# ============ user_id 语义 ============

def test_audit_log_user_id_test_mode():
    """is_test=True 时，审计日志 user_id 应为实际用户 ID"""
    from backend.services.audit_logger import AuditLogger

    logger = AuditLogger()
    captured = {}
    logger.log = lambda **kwargs: captured.update(kwargs)

    logger.log_alert_execute(
        org_id="org-1",
        alert_id="alert-1",
        execution_log_id="exec-1",
        user_id="real-user-id",
    )
    assert captured["user_id"] == "real-user-id"


def test_audit_log_user_id_scheduled_mode():
    """is_test=False（定时执行）时，user_id=None 应写入 SYSTEM_UUID"""
    from backend.services.audit_logger import SYSTEM_UUID, AuditLogger

    logger = AuditLogger()
    captured = {}
    logger.log = lambda **kwargs: captured.update(kwargs)

    logger.log_alert_execute(
        org_id="org-1",
        alert_id="alert-1",
        execution_log_id="exec-1",
        user_id=None,  # 定时执行传 None
    )
    assert captured["user_id"] == SYSTEM_UUID


# ============ NULL 处理 ============

def test_runtime_session_id_null_when_missing():
    """_build_enhanced_query 不依赖 runtime_session_id，log_id=None 时不注入追踪指令"""
    from backend.services.alert_service import AlertService

    result = AlertService._build_enhanced_query(
        query_description="查询 EC2 成本",
        alert_name="测试告警",
        account_info={"account_type": "aws", "alias": "test", "account_id": "123456789012"},
        alert_id="alert-1",
        org_id="org-1",
        is_test=False,
        log_id=None,
    )
    assert "Execution ID" not in result


def test_token_usage_null_when_missing():
    """log_alert_execute 传入 token_usage=None 时，details 中 token_usage 应为 None"""
    from backend.services.audit_logger import AuditLogger

    logger = AuditLogger()
    captured = {}
    logger.log = lambda **kwargs: captured.update(kwargs)

    logger.log_alert_execute(
        org_id="org-1",
        alert_id="alert-1",
        execution_log_id="exec-1",
        token_usage=None,
    )
    assert captured["details"]["token_usage"] is None


# ============ execution_log_id 注入 ============

def test_execution_log_id_injected_in_aws_prompt():
    """AWS 分支 prompt 应包含 execution_log_id"""
    from backend.services.alert_service import AlertService

    result = AlertService._build_enhanced_query(
        query_description="查询 EC2 成本",
        alert_name="测试告警",
        account_info={"account_type": "aws", "alias": "test", "account_id": "123456789012"},
        alert_id="alert-1",
        org_id="org-1",
        is_test=False,
        log_id="exec-abc-123",
    )
    assert "exec-abc-123" in result
    assert "Execution ID" in result


def test_agent_ignore_log_id_no_failure():
    """Agent 响应不含 execution_log_id 时，_parse_agent_response 应正常返回"""
    from backend.services.alert_service import AlertService

    response_without_id = '{"success": true, "triggered": false, "email_sent": false, "message": "ok"}'
    result = AlertService._parse_agent_response(response_without_id)
    assert result["success"] is True
