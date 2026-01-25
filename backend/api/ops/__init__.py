"""
运营后台 API 模块

提供平台级管理功能，仅超级管理员可访问。
所有端点均使用 get_current_super_admin 进行权限验证。
"""

from fastapi import APIRouter

from backend.api.ops.audit_logs import router as audit_logs_router
from backend.api.ops.dashboard import router as dashboard_router
from backend.api.ops.tenants import router as tenants_router

# 创建运营后台主路由
ops_router = APIRouter(
    prefix="/api/ops",
    tags=["运营后台"],
)

# 注册子路由
ops_router.include_router(dashboard_router)
ops_router.include_router(tenants_router)
ops_router.include_router(audit_logs_router)

__all__ = ["ops_router"]
