"""租户管理 API"""

import logging
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.chat import ChatSession
from backend.models.monitoring import MonitoringConfig
from backend.models.tables import AWSAccountTable, GCPAccountTable
from backend.models.user import Organization, User
from backend.services.audit_logger import get_audit_logger
from backend.utils.auth import get_current_super_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["运营-租户管理"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 响应模型
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TenantListItem(BaseModel):
    """租户列表项"""

    id: str
    name: str
    is_active: bool
    user_count: int
    created_at: datetime
    last_active_at: datetime | None


class TenantListResponse(BaseModel):
    """租户列表响应"""

    total: int
    page: int
    page_size: int
    items: list[TenantListItem]


class TenantDetailResponse(BaseModel):
    """租户详情响应"""

    id: str
    name: str
    is_active: bool
    external_id: str | None
    user_count: int
    created_at: datetime
    updated_at: datetime


class TenantActionResponse(BaseModel):
    """租户操作响应"""

    message: str
    tenant_id: str
    is_active: bool


class TenantUserItem(BaseModel):
    """租户用户列表项"""

    id: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class TenantUserListResponse(BaseModel):
    """租户用户列表响应"""

    total: int
    page: int
    page_size: int
    items: list[TenantUserItem]


class TenantDeleteImpactResponse(BaseModel):
    """删除影响预览响应"""

    tenant_id: str
    tenant_name: str
    is_active: bool
    user_count: int
    aws_account_count: int
    gcp_account_count: int
    monitoring_config_count: int
    chat_session_count: int


class TenantDeleteRequest(BaseModel):
    """删除租户请求"""

    confirmation_name: str = Field(
        ..., description="确认删除的组织名称，必须与目标组织名称完全匹配"
    )


class TenantDeleteResponse(BaseModel):
    """删除租户响应"""

    message: str
    tenant_id: str
    tenant_name: str


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API 端点
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get("", response_model=TenantListResponse)
def list_tenants(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: str = Query("all", pattern="^(all|active|pending)$", description="状态筛选"),
    search: str | None = Query(None, description="搜索关键词"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantListResponse:
    """获取租户列表"""

    # 基础查询
    query = db.query(Organization)

    # 状态筛选
    if status == "active":
        query = query.filter(Organization.is_active == True)  # noqa: E712
    elif status == "pending":
        query = query.filter(Organization.is_active == False)  # noqa: E712

    # 搜索筛选
    if search:
        query = query.filter(Organization.name.ilike(f"%{search}%"))

    # 获取总数
    total = query.count()

    # 分页和排序
    query = query.order_by(Organization.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    tenants = query.all()

    # 获取每个租户的用户数和最后活跃时间
    items = []
    for tenant in tenants:
        user_count = db.query(func.count(User.id)).filter(User.org_id == tenant.id).scalar() or 0
        last_active = db.query(func.max(User.last_login_at)).filter(User.org_id == tenant.id).scalar()
        items.append(
            TenantListItem(
                id=str(tenant.id),
                name=tenant.name,
                is_active=tenant.is_active,
                user_count=user_count,
                created_at=tenant.created_at,
                last_active_at=last_active,
            )
        )

    return TenantListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/{tenant_id}", response_model=TenantDetailResponse)
def get_tenant(
    tenant_id: str = Path(..., description="租户 ID"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantDetailResponse:
    """获取租户详情"""

    tenant = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在",
        )

    user_count = db.query(func.count(User.id)).filter(User.org_id == tenant.id).scalar() or 0

    return TenantDetailResponse(
        id=str(tenant.id),
        name=tenant.name,
        is_active=tenant.is_active,
        external_id=tenant.external_id,
        user_count=user_count,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
    )


@router.put("/{tenant_id}/activate", response_model=TenantActionResponse)
def activate_tenant(
    tenant_id: str = Path(..., description="租户 ID"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantActionResponse:
    """激活租户"""

    tenant = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在",
        )

    if tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="租户已处于激活状态",
        )

    tenant.is_active = True
    db.commit()

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log(
        user_id=current_user["id"],
        org_id=tenant_id,
        action="tenant_activate",
        resource_type="organization",
        resource_id=tenant_id,
        details={"tenant_name": tenant.name},
    )

    return TenantActionResponse(
        message="租户已激活",
        tenant_id=tenant_id,
        is_active=True,
    )


@router.put("/{tenant_id}/deactivate", response_model=TenantActionResponse)
def deactivate_tenant(
    tenant_id: str = Path(..., description="租户 ID"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantActionResponse:
    """禁用租户"""

    tenant = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在",
        )

    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="租户已处于禁用状态",
        )

    tenant.is_active = False
    db.commit()

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log(
        user_id=current_user["id"],
        org_id=tenant_id,
        action="tenant_deactivate",
        resource_type="organization",
        resource_id=tenant_id,
        details={"tenant_name": tenant.name},
    )

    return TenantActionResponse(
        message="租户已禁用",
        tenant_id=tenant_id,
        is_active=False,
    )


@router.get("/{tenant_id}/users", response_model=TenantUserListResponse)
def list_tenant_users(
    tenant_id: str = Path(..., description="租户 ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=50, description="每页数量"),
    search: str | None = Query(None, description="搜索关键词"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantUserListResponse:
    """获取租户下的用户列表"""

    # 验证租户存在
    tenant = db.query(Organization).filter(Organization.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在",
        )

    # 基础查询
    query = db.query(User).filter(User.org_id == tenant_id)

    # 搜索筛选
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )

    # 获取总数
    total = query.count()

    # 分页和排序
    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    users = query.all()

    items = [
        TenantUserItem(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )
        for user in users
    ]

    return TenantUserListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get(
    "/{tenant_id}/impact",
    response_model=TenantDeleteImpactResponse,
)
def get_tenant_delete_impact(
    tenant_id: str = Path(..., description="租户 ID"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantDeleteImpactResponse:
    """获取删除租户的影响预览（关联数据统计）"""

    tenant = (
        db.query(Organization)
        .filter(Organization.id == tenant_id)
        .first()
    )
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在",
        )

    user_count = (
        db.query(func.count(User.id))
        .filter(User.org_id == tenant_id)
        .scalar() or 0
    )
    aws_account_count = (
        db.query(func.count(AWSAccountTable.id))
        .filter(AWSAccountTable.org_id == tenant_id)
        .scalar() or 0
    )
    gcp_account_count = (
        db.query(func.count(GCPAccountTable.id))
        .filter(GCPAccountTable.org_id == tenant_id)
        .scalar() or 0
    )
    monitoring_config_count = (
        db.query(func.count(MonitoringConfig.id))
        .filter(MonitoringConfig.org_id == tenant_id)
        .scalar() or 0
    )
    chat_session_count = (
        db.query(func.count(ChatSession.id))
        .filter(ChatSession.org_id == tenant_id)
        .scalar() or 0
    )

    return TenantDeleteImpactResponse(
        tenant_id=str(tenant.id),
        tenant_name=tenant.name,
        is_active=tenant.is_active,
        user_count=user_count,
        aws_account_count=aws_account_count,
        gcp_account_count=gcp_account_count,
        monitoring_config_count=monitoring_config_count,
        chat_session_count=chat_session_count,
    )


@router.delete(
    "/{tenant_id}",
    response_model=TenantDeleteResponse,
)
def delete_tenant(
    tenant_id: str = Path(..., description="租户 ID"),
    request: TenantDeleteRequest = Body(...),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TenantDeleteResponse:
    """永久删除租户及其所有关联数据

    ⚠️ 此操作不可逆，需要输入组织名称确认。
    """

    tenant = (
        db.query(Organization)
        .filter(Organization.id == tenant_id)
        .first()
    )
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在",
        )

    # 验证确认名称
    if request.confirmation_name != tenant.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="确认名称与租户名称不匹配",
        )

    tenant_name = tenant.name

    try:
        # 收集影响统计（用于审计日志）
        impact = {
            "user_count": (
                db.query(func.count(User.id))
                .filter(User.org_id == tenant_id)
                .scalar() or 0
            ),
            "aws_account_count": (
                db.query(func.count(AWSAccountTable.id))
                .filter(AWSAccountTable.org_id == tenant_id)
                .scalar() or 0
            ),
            "gcp_account_count": (
                db.query(func.count(GCPAccountTable.id))
                .filter(GCPAccountTable.org_id == tenant_id)
                .scalar() or 0
            ),
            "monitoring_config_count": (
                db.query(func.count(MonitoringConfig.id))
                .filter(MonitoringConfig.org_id == tenant_id)
                .scalar() or 0
            ),
            "chat_session_count": (
                db.query(func.count(ChatSession.id))
                .filter(ChatSession.org_id == tenant_id)
                .scalar() or 0
            ),
        }

        # 审计日志（删除前写入，audit_logs 无外键不会被级联删除）
        audit_logger = get_audit_logger()
        audit_logger.log_tenant_delete(
            user_id=current_user["id"],
            org_id=tenant_id,
            tenant_name=tenant_name,
            impact=impact,
        )

        # 手动删除无外键约束的关联表
        db.query(AWSAccountTable).filter(
            AWSAccountTable.org_id == tenant_id
        ).delete(synchronize_session=False)
        db.query(GCPAccountTable).filter(
            GCPAccountTable.org_id == tenant_id
        ).delete(synchronize_session=False)

        # 删除 Organization（级联删除 users、monitoring_configs 等）
        db.delete(tenant)
        db.commit()

        logger.info(
            "✅ 租户已删除 - tenant_id: %s, name: %s, impact: %s",
            tenant_id, tenant_name, impact,
        )

        return TenantDeleteResponse(
            message="租户已永久删除",
            tenant_id=tenant_id,
            tenant_name=tenant_name,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "❌ 删除租户失败 - tenant_id: %s, error: %s",
            tenant_id, e, exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除租户失败",
        )
