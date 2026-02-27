"""告警服务（脱离 MCP/Agent 依赖）

提供告警配置 CRUD 与告警执行（通过 AgentCore Runtime）。
"""

import asyncio
import json
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import joinedload

from backend.api.agentcore_response_parser import AgentCoreResponseParser
from backend.config.settings import settings
from backend.database import get_db
from backend.models.alert_execution_log import AlertExecutionLog
from backend.models.monitoring import MonitoringConfig
from backend.services.account_storage_postgresql import AccountStoragePostgreSQL
from backend.services.agentcore_client import AgentCoreClient
from backend.services.audit_logger import get_audit_logger

logger = logging.getLogger(__name__)

# ============ 常量配置 ============

DEFAULT_CHECK_FREQUENCY = "daily"
MAX_ALERTS_PER_USER = 100
MAX_ALERTS_PER_ORG = 500
CHECK_FREQUENCIES = {"hourly": "每小时", "daily": "每天", "weekly": "每周", "monthly": "每月"}

ERROR_MESSAGES = {
    "ALERT_NOT_FOUND": "告警不存在或无权限访问",
    "ALERT_LIMIT_EXCEEDED": "已达到告警数量上限",
    "INVALID_FREQUENCY": "无效的检查频率",
    "PERMISSION_DENIED": "权限不足",
    "DATABASE_ERROR": "数据库操作失败",
    "INVALID_PARAMS": "参数验证失败",
}

SUCCESS_MESSAGES = {
    "ALERT_CREATED": "告警创建成功",
    "ALERT_UPDATED": "告警更新成功",
    "ALERT_DELETED": "告警删除成功",
    "ALERT_TOGGLED": "告警状态切换成功",
}


class AlertService:
    """告警服务"""

    class CreateAlertParams(BaseModel):
        query_description: str = Field(
            ...,
            description=(
                "完整的自然语言描述，包含查询逻辑、阈值判断和邮件发送。"
            ),
            min_length=10,
            max_length=5000,
        )
        display_name: str | None = Field(
            None, description="告警显示名称，用于UI展示。", max_length=200
        )
        user_id: str | None = Field(None, min_length=1, max_length=36)
        org_id: str | None = Field(None, min_length=1, max_length=36)
        check_frequency: str = Field(default=DEFAULT_CHECK_FREQUENCY)
        account_id: str | None = Field(None, max_length=36)
        account_type: str | None = Field(None, max_length=10)

        @field_validator("check_frequency")
        @classmethod
        def validate_frequency(cls, v: str) -> str:
            if v not in CHECK_FREQUENCIES:
                raise ValueError(
                    f"无效的检查频率。允许的值: {', '.join(CHECK_FREQUENCIES.keys())}"
                )
            return v

        @field_validator("query_description")
        @classmethod
        def validate_query_description(cls, v: str) -> str:
            v = v.strip()
            dangerous_patterns = [r"<script", r"javascript:", r"on\w+\s*="]
            for pattern in dangerous_patterns:
                if re.search(pattern, v, re.IGNORECASE):
                    raise ValueError("查询描述包含不允许的内容")
            return v

        @field_validator("display_name")
        @classmethod
        def validate_display_name(cls, v: str | None) -> str | None:
            if v:
                v = v.strip()
                if re.search(r"[<>]", v):
                    raise ValueError("显示名称包含不允许的字符")
            return v

    class ListAlertsParams(BaseModel):
        org_id: str = Field(..., min_length=1, max_length=36)
        user_id: str = Field(..., min_length=1, max_length=36)
        is_admin: bool = Field(default=False)
        status_filter: str | None = Field(default="all")

        @field_validator("status_filter")
        @classmethod
        def validate_status(cls, v: str | None) -> str:
            if v and v not in ["active", "inactive", "all"]:
                raise ValueError("无效的状态过滤。允许的值: active, inactive, all")
            return v or "all"

    class UpdateAlertParams(BaseModel):
        alert_id: str | None = Field(None, min_length=1, max_length=36)
        query_description: str | None = Field(None, min_length=10, max_length=5000)
        display_name: str | None = Field(None, max_length=200)
        check_frequency: str | None = Field(None)
        account_id: str | None = Field(None, max_length=36)
        account_type: str | None = Field(None, max_length=10)
        user_id: str | None = Field(None, min_length=1, max_length=36)
        org_id: str | None = Field(None, min_length=1, max_length=36)

        @field_validator("check_frequency")
        @classmethod
        def validate_frequency(cls, v: str | None) -> str | None:
            if v and v not in CHECK_FREQUENCIES:
                raise ValueError(
                    f"无效的检查频率。允许的值: {', '.join(CHECK_FREQUENCIES.keys())}"
                )
            return v

    class ToggleAlertParams(BaseModel):
        alert_id: str = Field(..., min_length=1, max_length=36)
        user_id: str = Field(..., min_length=1, max_length=36)
        org_id: str = Field(..., min_length=1, max_length=36)

    class DeleteAlertParams(BaseModel):
        alert_id: str = Field(..., min_length=1, max_length=36)
        user_id: str = Field(..., min_length=1, max_length=36)
        org_id: str = Field(..., min_length=1, max_length=36)

    @staticmethod
    async def create_alert(params: "AlertService.CreateAlertParams") -> dict[str, Any]:
        try:
            logger.info(": user_id=%s, org_id=%s", params.user_id, params.org_id)
            db = next(get_db())
            try:
                user_alert_count = (
                    db.query(MonitoringConfig)
                    .filter(MonitoringConfig.user_id == params.user_id)
                    .count()
                )
                if user_alert_count >= MAX_ALERTS_PER_USER:
                    raise ValueError(
                        f"{ERROR_MESSAGES['ALERT_LIMIT_EXCEEDED']} (用户限制: {MAX_ALERTS_PER_USER})"
                    )

                org_alert_count = (
                    db.query(MonitoringConfig)
                    .filter(MonitoringConfig.org_id == params.org_id)
                    .count()
                )
                if org_alert_count >= MAX_ALERTS_PER_ORG:
                    raise ValueError(
                        f"{ERROR_MESSAGES['ALERT_LIMIT_EXCEEDED']} (组织限制: {MAX_ALERTS_PER_ORG})"
                    )

                display_name = params.display_name or f"告警-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}"

                alert = MonitoringConfig(
                    org_id=params.org_id,
                    user_id=params.user_id,
                    query_description=params.query_description,
                    display_name=display_name,
                    check_frequency=params.check_frequency,
                    is_active=True,
                    account_id=params.account_id,
                    account_type=params.account_type,
                )
                db.add(alert)
                db.commit()
                db.refresh(alert)

                audit_logger = get_audit_logger()
                audit_logger.log_alert_create(
                    user_id=params.user_id,
                    org_id=params.org_id,
                    alert_id=alert.id,
                    display_name=alert.display_name,
                    query_description=params.query_description,
                )

                return {
                    "success": True,
                    "alert_id": alert.id,
                    "display_name": alert.display_name,
                    "message": SUCCESS_MESSAGES["ALERT_CREATED"],
                }
            finally:
                db.close()
        except ValueError as e:
            logger.warning("创建告警失败（参数错误）: {str(e)}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error("创建告警失败: %s", e, exc_info=True)
            return {"success": False, "error": f"{ERROR_MESSAGES['DATABASE_ERROR']}: {str(e)}"}

    @staticmethod
    async def list_alerts(params: "AlertService.ListAlertsParams") -> dict[str, Any]:
        try:
            logger.info(
                "查询告警列表: org_id=%s, user_id=%s, is_admin=%s, status=%s",
                params.org_id,
                params.user_id,
                params.is_admin,
                params.status_filter,
            )
            db = next(get_db())
            try:
                query = (
                    db.query(MonitoringConfig)
                    .options(joinedload(MonitoringConfig.user), joinedload(MonitoringConfig.organization))
                    .filter(MonitoringConfig.org_id == params.org_id)
                )

                if params.status_filter == "active":
                    query = query.filter(MonitoringConfig.is_active == True)
                elif params.status_filter == "inactive":
                    query = query.filter(MonitoringConfig.is_active == False)

                alerts = query.order_by(MonitoringConfig.created_at.desc()).all()

                for alert in alerts:
                    if alert.user:
                        _ = alert.user.username

                alert_list = [alert.to_dict() for alert in alerts]
                return {"success": True, "alerts": alert_list, "count": len(alert_list)}
            finally:
                db.close()
        except Exception as e:
            logger.error("查询告警列表失败: %s", e, exc_info=True)
            return {"success": False, "error": f"{ERROR_MESSAGES['DATABASE_ERROR']}: {str(e)}"}

    @staticmethod
    async def update_alert(params: "AlertService.UpdateAlertParams") -> dict[str, Any]:
        try:
            logger.info("update_alert: alert_id=%s, org_id=%s", params.alert_id, params.org_id)
            db = next(get_db())
            try:
                # 权限检查已在API层完成，这里只需通过ID和组织ID查询
                alert = (
                    db.query(MonitoringConfig)
                    .filter(
                        MonitoringConfig.id == params.alert_id,
                        MonitoringConfig.org_id == params.org_id,
                    )
                    .first()
                )
                if not alert:
                    return {"success": False, "error": ERROR_MESSAGES["ALERT_NOT_FOUND"]}

                if params.query_description is not None:
                    alert.query_description = params.query_description
                if params.display_name is not None:
                    alert.display_name = params.display_name
                if params.check_frequency is not None:
                    alert.check_frequency = params.check_frequency
                if params.account_id is not None:
                    alert.account_id = params.account_id
                if params.account_type is not None:
                    alert.account_type = params.account_type

                alert.updated_at = datetime.now(UTC)
                db.commit()

                audit_logger = get_audit_logger()
                changes = {}
                if params.query_description:
                    changes["query_description"] = params.query_description
                if params.display_name:
                    changes["display_name"] = params.display_name
                if params.check_frequency:
                    changes["check_frequency"] = params.check_frequency

                audit_logger.log_alert_update(
                    user_id=params.user_id,
                    org_id=params.org_id,
                    alert_id=alert.id,
                    display_name=alert.display_name,
                    changes=changes if changes else None,
                )

                return {
                    "success": True,
                    "alert_id": alert.id,
                    "message": SUCCESS_MESSAGES["ALERT_UPDATED"],
                }
            finally:
                db.close()
        except Exception as e:
            logger.error("更新告警失败: %s", e, exc_info=True)
            return {"success": False, "error": f"{ERROR_MESSAGES['DATABASE_ERROR']}: {str(e)}"}

    @staticmethod
    async def toggle_alert(params: "AlertService.ToggleAlertParams") -> dict[str, Any]:
        try:
            logger.info(": alert_id=%s, user_id=%s", params.alert_id, params.user_id)
            db = next(get_db())
            try:
                alert = (
                    db.query(MonitoringConfig)
                    .filter(
                        MonitoringConfig.id == params.alert_id,
                        MonitoringConfig.org_id == params.org_id,
                        MonitoringConfig.user_id == params.user_id,
                    )
                    .first()
                )
                if not alert:
                    return {"success": False, "error": ERROR_MESSAGES["ALERT_NOT_FOUND"]}

                alert.is_active = not alert.is_active
                alert.updated_at = datetime.now(UTC)
                db.commit()

                audit_logger = get_audit_logger()
                audit_logger.log_alert_toggle(
                    user_id=params.user_id,
                    org_id=params.org_id,
                    alert_id=alert.id,
                    is_active=alert.is_active,
                    display_name=alert.display_name,
                )

                status_text = "已启用" if alert.is_active else "已禁用"
                return {
                    "success": True,
                    "alert_id": alert.id,
                    "is_active": alert.is_active,
                    "message": f"{SUCCESS_MESSAGES['ALERT_TOGGLED']} - {status_text}",
                }
            finally:
                db.close()
        except Exception as e:
            logger.error("切换告警状态失败: %s", e, exc_info=True)
            return {"success": False, "error": f"{ERROR_MESSAGES['DATABASE_ERROR']}: {str(e)}"}

    @staticmethod
    async def delete_alert(params: "AlertService.DeleteAlertParams") -> dict[str, Any]:
        try:
            logger.info(": alert_id=%s, user_id=%s", params.alert_id, params.user_id)
            db = next(get_db())
            try:
                alert = (
                    db.query(MonitoringConfig)
                    .filter(
                        MonitoringConfig.id == params.alert_id,
                        MonitoringConfig.org_id == params.org_id,
                        MonitoringConfig.user_id == params.user_id,
                    )
                    .first()
                )
                if not alert:
                    return {"success": False, "error": ERROR_MESSAGES["ALERT_NOT_FOUND"]}

                alert_info = {
                    "display_name": alert.display_name,
                    "query_description": alert.query_description,
                }

                db.delete(alert)
                db.commit()

                audit_logger = get_audit_logger()
                audit_logger.log_alert_delete(
                    user_id=params.user_id,
                    org_id=params.org_id,
                    alert_id=params.alert_id,
                    display_name=alert_info.get("display_name"),
                    query_description=alert_info.get("query_description"),
                )

                return {
                    "success": True,
                    "alert_id": params.alert_id,
                    "message": SUCCESS_MESSAGES["ALERT_DELETED"],
                }
            finally:
                db.close()
        except Exception as e:
            logger.error("删除告警失败: %s", e, exc_info=True)
            return {"success": False, "error": f"{ERROR_MESSAGES['DATABASE_ERROR']}: {str(e)}"}

    @staticmethod
    async def execute_alert_check(
        alert_id: str,
        alert_name: str,
        query_description: str,
        org_id: str,
        account_id: str,
        account_type: str,
        user_id: str | None = None,
        is_test: bool = False,
    ) -> dict[str, Any]:
        start_time = time.time()
        log_id = None
        agent_response_raw: str | None = None

        if not alert_name or not alert_name.strip():
            alert_name = f"告警-{str(alert_id)[:8]}"

        logger.info(
            "🚀 开始执行告警检查 - Alert: %s, Name: %s, Account: %s (%s), Test: %s",
            alert_id,
            alert_name,
            account_id,
            account_type,
            is_test,
        )

        try:
            log_id = await AlertService._create_execution_log(
                alert_id=alert_id,
                org_id=org_id,
                user_id=user_id,
                account_id=account_id,
                account_type=account_type,
                is_test=is_test,
            )

            account_info = await AlertService._get_account_info(
                account_id=account_id, account_type=account_type, org_id=org_id
            )

            enhanced_query = AlertService._build_enhanced_query(
                query_description=query_description,
                alert_name=alert_name,
                account_info=account_info,
                alert_id=alert_id,
                org_id=org_id,
                is_test=is_test,
            )

            client = AgentCoreClient(
                runtime_arn=settings.AGENTCORE_RUNTIME_ARN,
                region=settings.AGENTCORE_REGION,
            )

            parser = AgentCoreResponseParser(session_id=None)
            assistant_response: list[str] = []
            event_count = 0
            timeout_seconds = 600

            async with asyncio.timeout(timeout_seconds):
                async for event in client.invoke_streaming(
                    prompt=enhanced_query,
                    account_id=str(account_info.get("id")),
                    session_id=None,
                    user_id=str(user_id) if user_id else None,
                    org_id=str(org_id) if org_id else None,
                    prompt_type="alert",
                    account_type=account_type,
                ):
                    event_count += 1
                    ws_messages = parser.parse_event(event)
                    for ws_msg in ws_messages:
                        if ws_msg.get("type") == "chunk":
                            assistant_response.append(ws_msg["content"])
                        elif ws_msg.get("type") == "error":
                            assistant_response.append(ws_msg["content"])

            agent_response_raw = "".join(assistant_response) if assistant_response else ""
            result = AlertService._parse_agent_response(agent_response_raw)

            execution_time = int((time.time() - start_time) * 1000)
            result["execution_duration_ms"] = execution_time

            await AlertService._update_execution_log(
                log_id=log_id,
                result=result,
                agent_response=agent_response_raw,
                execution_time=execution_time,
            )

            return result

        except asyncio.TimeoutError:
            execution_time = int((time.time() - start_time) * 1000)
            error_result = {
                "success": False,
                "triggered": False,
                "email_sent": False,
                "message": "执行超时（600秒）",
                "error": "Timeout",
                "execution_duration_ms": execution_time,
            }
            if log_id:
                await AlertService._update_execution_log(
                    log_id=log_id,
                    result=error_result,
                    agent_response=None,
                    execution_time=execution_time,
                )
            return error_result

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_result = {
                "success": False,
                "triggered": False,
                "email_sent": False,
                "message": f"执行失败: {str(e)}",
                "error": str(e),
                "execution_duration_ms": execution_time,
            }
            if log_id:
                await AlertService._update_execution_log(
                    log_id=log_id,
                    result=error_result,
                    agent_response=agent_response_raw,
                    execution_time=execution_time,
                )
            return error_result

    @staticmethod
    async def _get_account_info(
        account_id: str, account_type: str, org_id: str
    ) -> dict[str, Any]:
        if account_type != "aws":
            raise ValueError(f"当前只支持 AWS 账号，不支持: {account_type}")

        account_storage = AccountStoragePostgreSQL()
        account_dict = account_storage.get_account(account_id=account_id, org_id=org_id)

        if not account_dict:
            raise ValueError(f"账号不存在或无权限访问: {account_id}")

        return {
            "id": account_dict["id"],
            "alias": account_dict.get("alias", ""),
            "account_id": account_dict.get("account_id", ""),
            "org_id": org_id,
            "account_type": "aws",
            "region": account_dict.get("region", "us-east-1"),
        }

    @staticmethod
    async def _create_execution_log(
        alert_id: str,
        org_id: str,
        user_id: str | None,
        account_id: str,
        account_type: str,
        is_test: bool,
    ) -> str:
        db = next(get_db())
        try:
            log = AlertExecutionLog(
                alert_id=alert_id,
                org_id=org_id,
                triggered_by_user_id=user_id,
                account_id=account_id,
                account_type=account_type,
                execution_type="test" if is_test else "scheduled",
                success=False,
                triggered=False,
                email_sent=False,
                started_at=datetime.now(UTC),
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            return log.id
        finally:
            db.close()

    @staticmethod
    async def _update_execution_log(
        log_id: str,
        result: dict[str, Any],
        agent_response: str | None,
        execution_time: int,
    ) -> None:
        db = next(get_db())
        try:
            log = db.query(AlertExecutionLog).filter(AlertExecutionLog.id == log_id).first()
            if not log:
                return

            email_sent = result.get("email_sent", False)
            success = result.get("success", False)
            if email_sent:
                success = True

            log.success = success
            log.triggered = result.get("triggered", False)
            log.current_value = AlertService._make_json_serializable(
                result.get("current_value")
            )
            log.threshold = result.get("threshold")
            log.threshold_operator = result.get("threshold_operator")
            log.email_sent = email_sent
            log.to_emails = AlertService._make_json_serializable(result.get("to_emails"))
            log.agent_response = agent_response
            log.error_message = result.get("error")
            log.execution_duration_ms = execution_time
            log.completed_at = datetime.now(UTC)
            db.commit()
        finally:
            db.close()

    @staticmethod
    def _build_enhanced_query(
        query_description: str,
        alert_name: str,
        account_info: dict[str, Any],
        alert_id: str,
        org_id: str,
        is_test: bool,
    ) -> str:
        account_type = account_info.get("account_type", "aws")
        max_subject_length = 78
        email_subject = f"[测试] {alert_name}" if is_test else alert_name
        if len(email_subject) > max_subject_length:
            email_subject = email_subject[: max_subject_length - 3] + "..."

        if account_type == "gcp":
            enhanced_query = f"""用户查询: {query_description}

告警名称: {alert_name}

当前查询的 GCP 账号:
- 账号名称: {account_info.get('alias', 'Unknown')}
- GCP 项目 ID: {account_info.get('project_id', 'Unknown')}
- 组织 ID: {account_info.get('organization_id', 'Unknown')}

告警ID: {alert_id}
组织ID: {org_id}

{"模式: 测试模式" if is_test else "模式: 正常执行"}

⚠️ 重要：发送邮件时，请使用上述"告警名称"作为邮件主题（subject）。
邮件主题格式："{email_subject}"

请执行告警检查并返回纯 JSON 格式的结果。"""
        else:
            enhanced_query = f"""用户查询: {query_description}

告警名称: {alert_name}

当前查询的 AWS 账号:
- 账号别名: {account_info.get('alias', 'Unknown')}
- AWS 账号 ID: {account_info.get('account_id', 'Unknown')}

告警ID: {alert_id}
组织ID: {org_id}

{"模式: 测试模式" if is_test else "模式: 正常执行"}

⚠️ 重要：发送邮件时，请使用上述"告警名称"作为邮件主题（subject）。
邮件主题格式："{email_subject}"

请执行告警检查并返回纯 JSON 格式的结果。"""

        return enhanced_query.strip()

    @staticmethod
    def _parse_agent_response(response: str) -> dict[str, Any]:
        try:
            result = json.loads(response.strip())
            if isinstance(result, dict) and "success" in result:
                return result
        except json.JSONDecodeError:
            pass

        json_block_pattern = r"```(?:json)?\s*\n?(.*?)\n?```"
        matches = re.findall(json_block_pattern, response, re.DOTALL)
        if matches:
            for match in matches:
                try:
                    result = json.loads(match.strip())
                    if isinstance(result, dict) and "success" in result:
                        return result
                except json.JSONDecodeError:
                    continue

        json_object_pattern = r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
        matches = re.findall(json_object_pattern, response, re.DOTALL)
        if matches:
            matches_sorted = sorted(matches, key=len, reverse=True)
            for match in matches_sorted:
                try:
                    result = json.loads(match)
                    if isinstance(result, dict) and "success" in result:
                        return result
                except json.JSONDecodeError:
                    continue

        return {
            "success": False,
            "triggered": False,
            "email_sent": False,
            "message": "Agent 响应格式错误或无法解析",
            "error": f"无法解析 Agent 响应: {response[:200]}...",
            "raw_response": response,
        }

    @staticmethod
    def _make_json_serializable(obj: Any, _depth: int = 0) -> Any:
        from uuid import UUID

        if _depth > 100:
            return "<RecursionLimitExceeded>"
        if obj is None:
            return None
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, list):
            return [AlertService._make_json_serializable(item, _depth + 1) for item in obj]
        if isinstance(obj, dict):
            return {
                key: AlertService._make_json_serializable(value, _depth + 1)
                for key, value in obj.items()
            }
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)
