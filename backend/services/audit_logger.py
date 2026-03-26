"""审计日志服务 (PostgreSQL)"""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.audit_log import AuditLog

import logging

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """返回当前 UTC 时间"""
    return datetime.now(timezone.utc)


# 系统操作使用的 UUID (Nil UUID)
SYSTEM_UUID = "00000000-0000-0000-0000-000000000000"


class AuditLogger:
    """审计日志记录器 - 记录所有用户操作"""

    def __init__(self):
        pass

    def log(
        self,
        user_id: str,
        org_id: str,
        action: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        session_id: str | None = None,
    ) -> None:
        """记录审计日志

        Args:
            user_id: 用户ID
            org_id: 组织ID
            action: 操作类型 (login, logout, query, account_create, etc.)
            resource_type: 资源类型 (aws_account, gcp_account, user, chat_session)
            resource_id: 资源ID
            details: 详细信息(JSON)
            ip_address: IP地址
            user_agent: User-Agent
            session_id: 会话ID，仅query操作有值
        """
        log_id = str(uuid.uuid4())
        details_json = json.dumps(details) if details else None

        db: Session = next(get_db())
        try:
            audit_log = AuditLog(
                id=log_id,
                user_id=user_id,
                org_id=org_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details_json,
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                timestamp=_utc_now(),
            )
            db.add(audit_log)
            db.commit()
            logger.debug(
                "📝 审计日志: %s - User: %s, Resource: %s/%s",
                action, user_id, resource_type, resource_id,
            )

        except Exception as e:
            db.rollback()
            logger.error("审计日志写入失败: %s", e, exc_info=True)
        finally:
            db.close()

    # 便捷方法

    def log_login(self, user_id: str, org_id: str, ip_address: str | None = None):
        """记录登录"""
        self.log(user_id, org_id, "login", ip_address=ip_address)

    def log_login_failed(
        self,
        email: str,
        reason: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        user_id: str | None = None,
        org_id: str | None = None,
    ):
        """记录失败的登录尝试"""
        self.log(
            user_id=user_id or SYSTEM_UUID,
            org_id=org_id or SYSTEM_UUID,
            action="login_failed",
            details={"email": email, "reason": reason},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    def log_logout(self, user_id: str, org_id: str):
        """记录登出"""
        self.log(user_id, org_id, "logout")

    def log_query(
        self,
        user_id: str,
        org_id: str,
        query: str,
        account_ids: list[str],
        account_type: str = "aws",
        session_id: str | None = None,
        query_id: str | None = None,
    ):
        """记录查询操作

        Args:
            user_id: 用户ID
            org_id: 组织ID
            query: 查询内容（保留兼容性，不记录）
            account_ids: 账号ID列表
            account_type: 账号类型（aws/gcp）
            session_id: 会话ID
            query_id: 请求级唯一标识，用于后续精确回写 token_usage
        """
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="query",
            resource_type=f"{account_type}_account",
            resource_id=",".join(account_ids[:3]) if account_ids else None,
            details={"query_id": query_id} if query_id else None,
            session_id=session_id,
        )

    def update_query_token_usage(
        self,
        query_id: str,
        session_id: str,
        token_usage: dict,
    ) -> None:
        """将 token_usage 回写到对应 query 审计日志的 details 字段。

        通过 details 中的 query_id 精确匹配，避免并发下串写。

        Args:
            query_id: 请求级唯一标识（与 log_query 写入的一致）
            session_id: 会话ID（备用匹配）
            token_usage: Token 统计数据字典
        """
        if not query_id or not token_usage:
            return

        db: Session = next(get_db())
        try:
            # ✅ 优先按 query_id 精确匹配
            # details 是 jsonb 列，需要 cast 为 text 再做文本匹配
            audit_log = (
                db.query(AuditLog)
                .filter(
                    AuditLog.action == "query",
                    AuditLog.session_id == session_id,
                    cast(AuditLog.details, String).contains(query_id),
                )
                .order_by(AuditLog.timestamp.desc())
                .first()
            )

            if not audit_log:
                logger.warning(
                    "未找到 query_id=%s 的审计日志，跳过 token_usage 回写",
                    query_id,
                )
                return

            # 合并 details：保留已有字段，追加 token_usage
            existing = {}
            if audit_log.details:
                try:
                    existing = json.loads(audit_log.details)
                except (json.JSONDecodeError, TypeError):
                    existing = {}

            existing["token_usage"] = token_usage
            audit_log.details = json.dumps(existing)
            db.commit()

            logger.debug(
                "📊 token_usage 已回写到审计日志 - query_id=%s",
                query_id,
            )
        except Exception as e:
            db.rollback()
            logger.error(
                "token_usage 回写审计日志失败: %s", e, exc_info=True
            )
        finally:
            db.close()

    def log_account_create(
        self,
        user_id: str,
        org_id: str,
        account_id: str,
        account_type: str = "aws",
        alias: str | None = None,
    ):
        """记录创建账号"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="account_create",
            resource_type=f"{account_type}_account",
            resource_id=account_id,
            details={"alias": alias} if alias else None,
        )

    def log_account_delete(
        self, user_id: str, org_id: str, account_id: str, account_type: str = "aws"
    ):
        """记录删除账号"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="account_delete",
            resource_type=f"{account_type}_account",
            resource_id=account_id,
        )

    def log_permission_grant(
        self,
        user_id: str,
        org_id: str,
        target_user_id: str,
        account_id: str,
        account_type: str = "aws",
    ):
        """记录授予权限"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="permission_grant",
            resource_type=f"{account_type}_account",
            resource_id=account_id,
            details={"target_user": target_user_id},
        )

    def log_permission_revoke(
        self,
        user_id: str,
        org_id: str,
        target_user_id: str,
        account_id: str,
        account_type: str = "aws",
    ):
        """记录撤销权限"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="permission_revoke",
            resource_type=f"{account_type}_account",
            resource_id=account_id,
            details={"target_user": target_user_id},
        )

    def log_user_create(self, creator_id: str, org_id: str, new_user_id: str, username: str):
        """记录创建用户"""
        self.log(
            user_id=creator_id,
            org_id=org_id,
            action="user_create",
            resource_type="user",
            resource_id=new_user_id,
            details={"username": username},
        )

    def log_user_delete(self, deleter_id: str, org_id: str, deleted_user_id: str, username: str):
        """记录删除用户"""
        self.log(
            user_id=deleter_id,
            org_id=org_id,
            action="user_delete",
            resource_type="user",
            resource_id=deleted_user_id,
            details={"username": username},
        )

    def log_alert_create(
        self,
        user_id: str,
        org_id: str,
        alert_id: str,
        display_name: str,
        query_description: str | None = None,
    ):
        """记录创建告警"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="alert_create",
            resource_type="alert",
            resource_id=alert_id,
            details={"display_name": display_name, "query_description": query_description},
        )

    def log_alert_update(
        self,
        user_id: str,
        org_id: str,
        alert_id: str,
        display_name: str | None = None,
        changes: dict | None = None,
    ):
        """记录更新告警"""
        details = {}
        if display_name:
            details["display_name"] = display_name
        if changes:
            details["changes"] = changes

        self.log(
            user_id=user_id,
            org_id=org_id,
            action="alert_update",
            resource_type="alert",
            resource_id=alert_id,
            details=details if details else None,
        )

    def log_alert_delete(
        self,
        user_id: str,
        org_id: str,
        alert_id: str,
        display_name: str | None = None,
        query_description: str | None = None,
    ):
        """记录删除告警"""
        details = {}
        if display_name:
            details["display_name"] = display_name
        if query_description:
            details["query_description"] = query_description

        self.log(
            user_id=user_id,
            org_id=org_id,
            action="alert_delete",
            resource_type="alert",
            resource_id=alert_id,
            details=details if details else None,
        )

    def log_alert_toggle(
        self,
        user_id: str,
        org_id: str,
        alert_id: str,
        is_active: bool,
        display_name: str | None = None,
    ):
        """记录启用/禁用告警"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="alert_toggle",
            resource_type="alert",
            resource_id=alert_id,
            details={"is_active": is_active, "display_name": display_name},
        )

    def log_tenant_delete(
        self,
        user_id: str,
        org_id: str,
        tenant_name: str,
        impact: dict,
    ):
        """记录删除租户"""
        self.log(
            user_id=user_id,
            org_id=org_id,
            action="tenant_delete",
            resource_type="organization",
            resource_id=org_id,
            details={"tenant_name": tenant_name, "impact": impact},
        )

    # 查询方法

    def get_user_logs(
        self, user_id: str, limit: int = 100, action: str | None = None
    ) -> list[dict]:
        """获取用户的审计日志"""
        db: Session = next(get_db())
        try:
            query = db.query(AuditLog).filter(AuditLog.user_id == user_id)
            if action:
                query = query.filter(AuditLog.action == action)

            logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
            return [log.to_dict() for log in logs]
        finally:
            db.close()

    def get_org_logs(self, org_id: str, limit: int = 100, action: str | None = None) -> list[dict]:
        """获取组织的审计日志"""
        db: Session = next(get_db())
        try:
            query = db.query(AuditLog).filter(AuditLog.org_id == org_id)
            if action:
                query = query.filter(AuditLog.action == action)

            logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
            return [log.to_dict() for log in logs]
        finally:
            db.close()


# 单例模式
_audit_logger = None


def get_audit_logger() -> AuditLogger:
    """获取审计日志记录器实例"""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger
