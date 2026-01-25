"""审计日志 API"""

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.audit_log import AuditLog
from backend.models.user import Organization, User
from backend.utils.auth import get_current_super_admin

router = APIRouter(prefix="/audit-logs", tags=["运营-审计日志"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 操作类型映射
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTION_TYPES = [
    {"value": "login", "label": "登录"},
    {"value": "login_failed", "label": "登录失败"},
    {"value": "logout", "label": "登出"},
    {"value": "user_create", "label": "创建用户"},
    {"value": "user_update", "label": "更新用户"},
    {"value": "user_delete", "label": "删除用户"},
    {"value": "permission_grant", "label": "授权"},
    {"value": "permission_revoke", "label": "撤销授权"},
    {"value": "config_update", "label": "配置变更"},
    {"value": "tenant_activate", "label": "激活租户"},
    {"value": "tenant_deactivate", "label": "禁用租户"},
    {"value": "account_create", "label": "创建账号"},
    {"value": "account_delete", "label": "删除账号"},
    {"value": "alert_create", "label": "创建告警"},
    {"value": "alert_update", "label": "更新告警"},
    {"value": "alert_delete", "label": "删除告警"},
    {"value": "alert_toggle", "label": "启用/禁用告警"},
    {"value": "query", "label": "查询"},
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 响应模型
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class AuditLogItem(BaseModel):
    """审计日志项"""

    id: str
    timestamp: datetime
    org_id: str | None
    org_name: str | None
    user_id: str | None
    username: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    user_agent: str | None
    details: str | None  # JSON 字符串


class AuditLogListResponse(BaseModel):
    """审计日志列表响应"""

    total: int
    page: int
    page_size: int
    items: list[AuditLogItem]


class ActionTypeItem(BaseModel):
    """操作类型项"""

    value: str
    label: str


class ActionTypesResponse(BaseModel):
    """操作类型列表响应"""

    actions: list[ActionTypeItem]


class FilterOption(BaseModel):
    """筛选选项"""

    value: str
    label: str


class FilterOptionsResponse(BaseModel):
    """筛选选项列表响应"""

    options: list[FilterOption]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API 端点
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    start_date: datetime | None = Query(None, description="开始日期"),
    end_date: datetime | None = Query(None, description="结束日期"),
    org_id: str | None = Query(None, description="租户 ID"),
    user_id: str | None = Query(None, description="用户 ID"),
    action: str | None = Query(None, description="操作类型"),
    search: str | None = Query(None, description="关键词搜索"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> AuditLogListResponse:
    """获取审计日志列表"""

    # 基础查询
    query = db.query(AuditLog)

    # 时间范围筛选
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)

    # 默认最近 7 天
    if not start_date and not end_date:
        default_start = datetime.now(timezone.utc) - timedelta(days=7)
        query = query.filter(AuditLog.timestamp >= default_start)

    # 租户筛选
    if org_id:
        query = query.filter(AuditLog.org_id == org_id)

    # 用户筛选
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    # 操作类型筛选
    if action:
        query = query.filter(AuditLog.action == action)

    # 关键词搜索（在租户名、用户名、details 字段中搜索）
    if search:
        # 先查找匹配的租户和用户 ID
        matching_org_ids = db.query(Organization.id).filter(
            Organization.name.ilike(f"%{search}%")
        ).all()
        matching_user_ids = db.query(User.id).filter(
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        ).all()

        org_id_list = [str(org_id[0]) for org_id in matching_org_ids]
        user_id_list = [str(user_id[0]) for user_id in matching_user_ids]

        # 构建 OR 条件
        search_conditions = [AuditLog.details.ilike(f"%{search}%")]
        if org_id_list:
            search_conditions.append(AuditLog.org_id.in_(org_id_list))
        if user_id_list:
            search_conditions.append(AuditLog.user_id.in_(user_id_list))

        query = query.filter(or_(*search_conditions))

    # 获取总数
    total = query.count()

    # 分页和排序
    query = query.order_by(AuditLog.timestamp.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    logs = query.all()

    # 批量获取关联的租户和用户信息
    org_ids = {log.org_id for log in logs if log.org_id}
    user_ids = {log.user_id for log in logs if log.user_id}

    orgs: dict[str, str] = {}
    if org_ids:
        org_result = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
        orgs = {str(org.id): org.name for org in org_result}

    users: dict[str, str] = {}
    if user_ids:
        user_result = db.query(User).filter(User.id.in_(user_ids)).all()
        users = {str(user.id): user.username for user in user_result}

    # 构建响应
    items = [
        AuditLogItem(
            id=str(log.id),
            timestamp=log.timestamp,
            org_id=str(log.org_id) if log.org_id else None,
            org_name=orgs.get(str(log.org_id)) if log.org_id else None,
            user_id=str(log.user_id) if log.user_id else None,
            username=users.get(str(log.user_id)) if log.user_id else None,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=str(log.resource_id) if log.resource_id else None,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            details=json.dumps(log.details) if isinstance(log.details, dict) else log.details,
        )
        for log in logs
    ]

    return AuditLogListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/actions", response_model=ActionTypesResponse)
def get_action_types(
    current_user: dict = Depends(get_current_super_admin),
) -> ActionTypesResponse:
    """获取所有操作类型（用于筛选下拉框）"""
    return ActionTypesResponse(
        actions=[ActionTypeItem(**item) for item in ACTION_TYPES]
    )


@router.get("/tenants", response_model=FilterOptionsResponse)
def get_tenant_options(
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> FilterOptionsResponse:
    """获取所有租户选项（用于筛选下拉框）"""
    orgs = db.query(Organization).order_by(Organization.name).all()
    return FilterOptionsResponse(
        options=[FilterOption(value=str(org.id), label=org.name) for org in orgs]
    )


@router.get("/users", response_model=FilterOptionsResponse)
def get_user_options(
    org_id: str | None = Query(None, description="租户 ID（可选，用于筛选特定租户下的用户）"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> FilterOptionsResponse:
    """获取用户选项（用于筛选下拉框）"""
    query = db.query(User)
    if org_id:
        query = query.filter(User.org_id == org_id)
    users = query.order_by(User.username).all()
    return FilterOptionsResponse(
        options=[
            FilterOption(value=str(user.id), label=f"{user.username} ({user.email})")
            for user in users
        ]
    )
