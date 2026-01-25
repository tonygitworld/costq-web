"""Dashboard 统计 API"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.chat import ChatMessage
from backend.models.user import Organization, User
from backend.utils.auth import get_current_super_admin

router = APIRouter(prefix="/dashboard", tags=["运营-Dashboard"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 响应模型
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class DashboardStatsResponse(BaseModel):
    """Dashboard 统计数据响应"""

    total_tenants: int
    total_users: int
    active_tenants: int
    pending_tenants: int
    today_dau: int
    today_queries: int
    yesterday_dau: int
    yesterday_queries: int
    updated_at: datetime


class TrendDataPoint(BaseModel):
    """趋势数据点"""

    date: str  # YYYY-MM-DD
    value: int


class DashboardTrendsResponse(BaseModel):
    """Dashboard 趋势数据响应"""

    days: int
    dau_trend: list[TrendDataPoint]
    query_trend: list[TrendDataPoint]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API 端点
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> DashboardStatsResponse:
    """
    获取 Dashboard 统计数据

    Returns:
        - total_tenants: 租户总数
        - total_users: 用户总数
        - active_tenants: 已激活租户数
        - pending_tenants: 待审核租户数
        - today_dau: 今日活跃用户数
        - today_queries: 今日查询量
        - yesterday_dau: 昨日活跃用户数
        - yesterday_queries: 昨日查询量
    """
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    # 租户统计
    total_tenants = db.query(func.count(Organization.id)).scalar() or 0
    active_tenants = db.query(func.count(Organization.id)).filter(
        Organization.is_active == True  # noqa: E712
    ).scalar() or 0

    # 用户统计
    total_users = db.query(func.count(User.id)).scalar() or 0

    # 今日 DAU（有登录行为的独立用户数）
    today_dau = db.query(func.count(func.distinct(User.id))).filter(
        User.last_login_at >= today_start
    ).scalar() or 0

    # 昨日 DAU
    yesterday_dau = db.query(func.count(func.distinct(User.id))).filter(
        and_(
            User.last_login_at >= yesterday_start,
            User.last_login_at < today_start,
        )
    ).scalar() or 0

    # 今日查询量（用户发送的消息数）
    today_queries = db.query(func.count(ChatMessage.id)).filter(
        and_(
            ChatMessage.created_at >= today_start,
            ChatMessage.role == "user",
        )
    ).scalar() or 0

    # 昨日查询量
    yesterday_queries = db.query(func.count(ChatMessage.id)).filter(
        and_(
            ChatMessage.created_at >= yesterday_start,
            ChatMessage.created_at < today_start,
            ChatMessage.role == "user",
        )
    ).scalar() or 0

    return DashboardStatsResponse(
        total_tenants=total_tenants,
        total_users=total_users,
        active_tenants=active_tenants,
        pending_tenants=total_tenants - active_tenants,
        today_dau=today_dau,
        today_queries=today_queries,
        yesterday_dau=yesterday_dau,
        yesterday_queries=yesterday_queries,
        updated_at=now,
    )


@router.get("/trends", response_model=DashboardTrendsResponse)
def get_dashboard_trends(
    days: int = Query(7, ge=7, le=30, description="天数: 7 或 30"),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> DashboardTrendsResponse:
    """
    获取趋势数据

    Args:
        days: 天数（7 或 30）

    Returns:
        - days: 请求的天数
        - dau_trend: 日活趋势数据
        - query_trend: 查询量趋势数据
    """
    now = datetime.now(UTC)
    start_date = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    dau_trend = []
    query_trend = []

    # 逐日统计
    for i in range(days):
        day_start = start_date + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        date_str = day_start.strftime("%Y-%m-%d")

        # 当日 DAU
        dau = db.query(func.count(func.distinct(User.id))).filter(
            and_(
                User.last_login_at >= day_start,
                User.last_login_at < day_end,
            )
        ).scalar() or 0
        dau_trend.append(TrendDataPoint(date=date_str, value=dau))

        # 当日查询量
        queries = db.query(func.count(ChatMessage.id)).filter(
            and_(
                ChatMessage.created_at >= day_start,
                ChatMessage.created_at < day_end,
                ChatMessage.role == "user",
            )
        ).scalar() or 0
        query_trend.append(TrendDataPoint(date=date_str, value=queries))

    return DashboardTrendsResponse(
        days=days,
        dau_trend=dau_trend,
        query_trend=query_trend,
    )
