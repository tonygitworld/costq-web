"""Token 用量统计 API

提供全平台、按组织、按用户三个维度的 Token 消耗聚合查询。
数据来源于 chat_messages.message_metadata 中的 token_usage 字段，
通过 PostgreSQL JSON 操作符提取并聚合。
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Integer, and_, cast, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.chat import ChatMessage, ChatSession
from backend.models.user import Organization, User
from backend.utils.auth import get_current_super_admin

router = APIRouter(prefix="/token-usage", tags=["运营-Token用量"])


# ----------------------------------------------------------------
# 响应模型
# ----------------------------------------------------------------


class TokenUsageSummaryResponse(BaseModel):
    """全平台 Token 用量汇总"""

    total_input_tokens: int
    total_output_tokens: int
    total_cache_read_tokens: int
    total_cache_write_tokens: int
    total_tokens: int
    total_messages: int
    start_date: str
    end_date: str


class OrgTokenUsageItem(BaseModel):
    """组织维度 Token 用量项"""

    org_id: str
    org_name: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    total_tokens: int


class TokenUsageByOrgResponse(BaseModel):
    """组织维度 Token 用量响应"""

    total: int
    page: int
    page_size: int
    items: list[OrgTokenUsageItem]


class UserTokenUsageItem(BaseModel):
    """用户维度 Token 用量项"""

    user_id: str
    username: str
    org_id: str
    org_name: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    total_tokens: int


class TokenUsageByUserResponse(BaseModel):
    """用户维度 Token 用量响应"""

    total: int
    page: int
    page_size: int
    items: list[UserTokenUsageItem]


# ----------------------------------------------------------------
# 辅助函数
# ----------------------------------------------------------------


def _token_field(field_name: str) -> Any:
    """从 message_metadata -> token_usage -> field_name 提取整数值。

    使用 COALESCE 确保缺失字段返回 0，避免 NULL 影响聚合结果。

    Args:
        field_name: token_usage 中的字段名
            （input_tokens / output_tokens /
            cache_read_tokens / cache_write_tokens）

    Returns:
        SQLAlchemy 表达式，提取并转换为整数
    """
    return func.coalesce(
        cast(
            ChatMessage.message_metadata[
                "token_usage"
            ][field_name].as_string(),
            Integer,
        ),
        0,
    )


def _build_token_agg_exprs() -> tuple[Any, Any, Any, Any, Any]:
    """构建 Token 聚合表达式（消除重复代码）。

    Returns:
        (sum_input, sum_output, sum_cache_read,
         sum_cache_write, total_expr)
    """
    sum_input = func.coalesce(
        func.sum(_token_field("input_tokens")), 0
    )
    sum_output = func.coalesce(
        func.sum(_token_field("output_tokens")), 0
    )
    sum_cache_read = func.coalesce(
        func.sum(_token_field("cache_read_tokens")), 0
    )
    sum_cache_write = func.coalesce(
        func.sum(_token_field("cache_write_tokens")), 0
    )
    total_expr = sum_input + sum_output
    return (
        sum_input, sum_output,
        sum_cache_read, sum_cache_write,
        total_expr,
    )


def _build_base_filters(
    start_date: datetime | None,
    end_date: datetime | None,
) -> tuple[list[Any], datetime, datetime]:
    """构建基础过滤条件。

    仅聚合 role='assistant' 的消息，支持时间范围筛选，
    默认最近 30 天。

    Args:
        start_date: 开始时间（可选）
        end_date: 结束时间（可选）

    Returns:
        (过滤条件列表, 实际开始时间, 实际结束时间)
    """
    now = datetime.now(timezone.utc)

    # 默认时间范围：最近 30 天
    actual_start = start_date or (now - timedelta(days=30))
    actual_end = end_date or now

    filters: list[Any] = [
        ChatMessage.role == "assistant",
        ChatMessage.created_at >= actual_start,
        ChatMessage.created_at <= actual_end,
    ]

    return filters, actual_start, actual_end



# ----------------------------------------------------------------
# API 端点
# ----------------------------------------------------------------


@router.get("/summary", response_model=TokenUsageSummaryResponse)
def get_token_usage_summary(
    start_date: datetime | None = Query(
        None, description="开始日期"
    ),
    end_date: datetime | None = Query(
        None, description="结束日期"
    ),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TokenUsageSummaryResponse:
    """获取全平台 Token 用量汇总。

    Args:
        start_date: 开始日期（可选，默认 30 天前）
        end_date: 结束日期（可选，默认当前时间）

    Returns:
        全平台 input/output/cache_read/cache_write
        tokens 总计及消息数
    """
    filters, actual_start, actual_end = _build_base_filters(
        start_date, end_date
    )

    result = db.query(
        func.coalesce(
            func.sum(_token_field("input_tokens")), 0
        ).label("total_input"),
        func.coalesce(
            func.sum(_token_field("output_tokens")), 0
        ).label("total_output"),
        func.coalesce(
            func.sum(_token_field("cache_read_tokens")), 0
        ).label("total_cache_read"),
        func.coalesce(
            func.sum(_token_field("cache_write_tokens")), 0
        ).label("total_cache_write"),
        func.count(ChatMessage.id).label("total_messages"),
    ).filter(
        and_(*filters)
    ).one()

    total_input = int(result.total_input)
    total_output = int(result.total_output)

    return TokenUsageSummaryResponse(
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_cache_read_tokens=int(result.total_cache_read),
        total_cache_write_tokens=int(result.total_cache_write),
        total_tokens=total_input + total_output,
        total_messages=int(result.total_messages),
        start_date=actual_start.strftime("%Y-%m-%d"),
        end_date=actual_end.strftime("%Y-%m-%d"),
    )


@router.get("/by-org", response_model=TokenUsageByOrgResponse)
def get_token_usage_by_org(
    start_date: datetime | None = Query(
        None, description="开始日期"
    ),
    end_date: datetime | None = Query(
        None, description="结束日期"
    ),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(
        20, ge=1, le=100, description="每页数量"
    ),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TokenUsageByOrgResponse:
    """按组织维度聚合 Token 用量。

    通过 chat_messages JOIN chat_sessions（获取 org_id）
    JOIN organizations（获取组织名称）进行聚合。
    结果按总 Token 数（input + output）降序排列。

    Args:
        start_date: 开始日期（可选，默认 30 天前）
        end_date: 结束日期（可选，默认当前时间）
        page: 页码（默认 1）
        page_size: 每页数量（默认 20，最大 100）

    Returns:
        分页的组织维度 Token 用量列表
    """
    filters, _, _ = _build_base_filters(start_date, end_date)
    (
        sum_input, sum_output,
        sum_cache_read, sum_cache_write,
        total_expr,
    ) = _build_token_agg_exprs()

    # JOIN chat_sessions 和 organizations
    base_query = (
        db.query(
            ChatSession.org_id,
            Organization.name.label("org_name"),
            sum_input.label("input_tokens"),
            sum_output.label("output_tokens"),
            sum_cache_read.label("cache_read_tokens"),
            sum_cache_write.label("cache_write_tokens"),
            total_expr.label("total_tokens"),
        )
        .join(
            ChatSession,
            ChatMessage.session_id == ChatSession.id,
        )
        .join(
            Organization,
            ChatSession.org_id == Organization.id,
        )
        .filter(and_(*filters))
        .group_by(ChatSession.org_id, Organization.name)
    )

    total = base_query.count()

    rows = (
        base_query.order_by(total_expr.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        OrgTokenUsageItem(
            org_id=str(row.org_id),
            org_name=row.org_name,
            input_tokens=int(row.input_tokens),
            output_tokens=int(row.output_tokens),
            cache_read_tokens=int(row.cache_read_tokens),
            cache_write_tokens=int(row.cache_write_tokens),
            total_tokens=int(row.total_tokens),
        )
        for row in rows
    ]

    return TokenUsageByOrgResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )



@router.get("/by-user", response_model=TokenUsageByUserResponse)
def get_token_usage_by_user(
    start_date: datetime | None = Query(
        None, description="开始日期"
    ),
    end_date: datetime | None = Query(
        None, description="结束日期"
    ),
    org_id: str | None = Query(
        None, description="组织 ID 筛选"
    ),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(
        20, ge=1, le=100, description="每页数量"
    ),
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> TokenUsageByUserResponse:
    """按用户维度聚合 Token 用量。

    通过 chat_messages JOIN users（获取用户名）
    JOIN organizations（获取组织名称）进行聚合。
    支持按 org_id 筛选特定组织下的用户。
    结果按总 Token 数（input + output）降序排列。

    Args:
        start_date: 开始日期（可选，默认 30 天前）
        end_date: 结束日期（可选，默认当前时间）
        org_id: 组织 ID（可选，筛选特定组织）
        page: 页码（默认 1）
        page_size: 每页数量（默认 20，最大 100）

    Returns:
        分页的用户维度 Token 用量列表
    """
    filters, _, _ = _build_base_filters(start_date, end_date)
    (
        sum_input, sum_output,
        sum_cache_read, sum_cache_write,
        total_expr,
    ) = _build_token_agg_exprs()

    # 组织筛选
    if org_id:
        filters.append(User.org_id == org_id)

    # JOIN users 和 organizations
    base_query = (
        db.query(
            ChatMessage.user_id,
            User.username,
            User.org_id.label("org_id"),
            Organization.name.label("org_name"),
            sum_input.label("input_tokens"),
            sum_output.label("output_tokens"),
            sum_cache_read.label("cache_read_tokens"),
            sum_cache_write.label("cache_write_tokens"),
            total_expr.label("total_tokens"),
        )
        .join(User, ChatMessage.user_id == User.id)
        .join(Organization, User.org_id == Organization.id)
        .filter(and_(*filters))
        .group_by(
            ChatMessage.user_id,
            User.username,
            User.org_id,
            Organization.name,
        )
    )

    total = base_query.count()

    rows = (
        base_query.order_by(total_expr.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        UserTokenUsageItem(
            user_id=str(row.user_id),
            username=row.username,
            org_id=str(row.org_id),
            org_name=row.org_name,
            input_tokens=int(row.input_tokens),
            output_tokens=int(row.output_tokens),
            cache_read_tokens=int(row.cache_read_tokens),
            cache_write_tokens=int(row.cache_write_tokens),
            total_tokens=int(row.total_tokens),
        )
        for row in rows
    ]

    return TokenUsageByUserResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )
