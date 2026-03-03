"""运营后台 - Marketplace 手动检查/刷新订阅状态

手动模式：不做自动事件处理。

能力：
- 对指定 tenant(org) 执行 entitlement refresh，并根据结果启用/禁用租户。

安全：仅 super admin。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.utils.auth import get_current_super_admin
from backend.api.marketplace import refresh_entitlement, RefreshRequest, RefreshResponse

router = APIRouter(prefix="/marketplace", tags=["运营-Marketplace"])


class OpsRefreshRequest(BaseModel):
    tenant_id: str


@router.post("/tenants/refresh", response_model=RefreshResponse)
def ops_refresh_tenant_subscription(
    req: OpsRefreshRequest,
    current_user: dict = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    # Reuse marketplace refresh logic
    return refresh_entitlement(RefreshRequest(org_id=req.tenant_id), db=db)
