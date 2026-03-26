"""FastAPI主应用"""

import asyncio
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .api.accounts import router as accounts_router

import logging
import sys

from .api.alerts import router as alerts_router
from .api.auth import router as auth_router
from .api.chat import router as chat_router
from .api.gcp_accounts import router as gcp_accounts_router
from .api.models import router as models_router

# P2-3: 禁用监控 API（安全考虑）
from .api.monitoring import router as monitoring_router  # Phase 4: 监控路由（简化版）
from .api.profile import router as profile_router
from .api.prompt_templates import router as prompt_templates_router
from .api.users import router as users_router
from .api.sse import sse_query_endpoint_v2, SSEQueryRequestV2
from .config.settings import settings
from .utils.auth import get_current_user

# ✅ 配置根 logger（确保所有模块的日志都能输出到控制台）
# 注意：必须在导入其他模块之前配置，否则某些模块的 logger 可能无法正确初始化
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),  # 输出到控制台
    ],
    force=True,  # 强制重新配置（如果之前已经配置过）
)

# 设置特定 logger 的级别
logging.getLogger("backend.services.agentcore_client").setLevel(log_level)
logging.getLogger("backend.api.sse").setLevel(log_level)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 启动时初始化所有资源

    Phase 2 优化: 启用 MCP 预热机制
    - 使用默认凭证预热高优先级 MCP 服务器
    - 预热失败不影响应用启动
    """

    # ✅ P0: 禁用 OpenTelemetry 详细日志（避免刷新页面时的 context 警告）
    import logging

    logging.getLogger("opentelemetry").setLevel(logging.ERROR)
    logging.getLogger("opentelemetry.context").setLevel(logging.CRITICAL)

    print("\n" + "=" * 60)
    print("启动 AWS CostQ Agent (动态架构)")
    print("=" * 60)
    print("核心组件已就绪")
    print("MCP客户端将在首次查询时按需创建")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 告警调度器启动
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    alert_scheduler_started = False
    try:
        from .services.alert_scheduler import alert_scheduler

        alert_scheduler.start()
        alert_scheduler_started = True
        print("AlertScheduler 已启动")
        # 获取下次执行时间
        status = alert_scheduler.get_status()
        if status.get("next_run_time"):
            print(f"下次执行: {status['next_run_time']}")
    except Exception as e:
        print(f"❌ AlertScheduler 启动失败（不影响其他功能）: {e}")
        import traceback

        traceback.print_exc()
        alert_scheduler_started = False

    # Phase 3: 健康检查（新架构简化版）
    # 注意：新架构无MCP缓存，无需健康检查
    health_check_task = None

    # 简化的健康检查（仅日志记录）
    try:

        async def health_check_loop():
            """简化的健康检查（新架构）

            新架构说明：
            - 无MCP客户端缓存，无需检查客户端状态
            - 只记录基本的运行状态
            """
            while True:
                try:
                    await asyncio.sleep(60)  # 每60秒检查一次

                    # ━━━━━━━━━━ MCP 客户端健康检查（已移除）━━━━━━━━━━
                    # 新架构无MCP缓存，跳过此检查
                    # client_manager = get_dynamic_client_manager()
                    # stats = client_manager.get_stats()

                    # 新架构：MCP检查已移除（无缓存）
                    # health_result = await asyncio.to_thread(...)
                    # （已移除MCP健康检查相关代码）

                    # ━━━━━━━━━━ SSE 查询状态检查（新架构）━━━━━━━━━━
                    # ✅ 新架构：SSE 是无状态的，每个查询都是独立的连接
                    # ✅ 不再需要 active_queries 统计，使用 resource_manager 获取查询统计
                    from .services.resource_manager import get_resource_manager
                    resource_manager = get_resource_manager()
                    stats = resource_manager.get_stats()
                    if stats.get("active_queries", 0) > 0:
                        logger.debug("🔌 活跃查询数: {stats.get('active_queries', 0)}")

                    # ━━━━━━━━━━ 数据库连接池监控 ━━━━━━━━━━
                    from .database import get_engine

                    try:
                        engine = get_engine()
                        pool = engine.pool
                        pool_size = pool.size()
                        checked_out = pool.checkedout()
                        overflow = pool.overflow()

                        # 连接池使用率
                        if pool_size > 0:
                            usage_rate = (checked_out / pool_size) * 100

                            # 高使用率告警（>80%）
                            if usage_rate > 80:
                                logger.warning(
                                    f"⚠️  数据库连接池使用率过高 - "
                                    f"活跃: {checked_out}/{pool_size} ({usage_rate:.0f}%), "
                                    f"溢出: {overflow}"
                                )
                            else:
                                logger.debug(
                                    f"🔌 数据库连接池 - "
                                    f"活跃: {checked_out}/{pool_size} ({usage_rate:.0f}%), "
                                    f"溢出: {overflow}"
                                )
                    except Exception as pool_err:
                        logger.debug(": %s", pool_err)

                except Exception as e:
                    logger.warning(": %s", e)

        # 启动后台健康检查
        health_check_task = asyncio.create_task(health_check_loop())
        logger.info("✅ Phase 3: MCP 健康检查已启动（每60秒）")

    except Exception as e:
        logger.warning(": %s", e)

    print("⚡ 启动时间: <3秒")
    print("=" * 60 + "\n")

    yield

    # 关闭时清理资源
    print("\n🔄 应用关闭，清理资源...")

    # 停止告警调度器
    if alert_scheduler_started:
        try:
            from .services.alert_scheduler import alert_scheduler

            alert_scheduler.stop()
            print("✅ AlertScheduler 已停止")
        except Exception as e:
            print(f"⚠️  AlertScheduler 停止失败: {e}")

    # 取消健康检查任务
    if health_check_task:
        health_check_task.cancel()
        try:
            await health_check_task
        except asyncio.CancelledError:
            pass

    # 新架构：无MCP缓存，无需清理
    # from .mcp.dynamic_clients import get_dynamic_client_manager
    # （已移除MCP清理代码）
    print("✅ 清理完成（新架构无需清理MCP缓存）")


# 初始化速率限制器
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="最懂AWS的智能助手",
    description="智能AWS分析和优化建议",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置速率限制
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# 添加全局验证异常处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """捕获并记录详细的验证错误"""
    errors = exc.errors()
    logger.error("- URL: %s, : %s", request.url, errors)

    # 转换错误为可序列化的格式
    serializable_errors = []
    for error in errors:
        error_dict = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": error.get("input"),
        }
        # 如果有 ctx，转换为字符串
        if "ctx" in error and error["ctx"]:
            error_dict["ctx"] = {k: str(v) for k, v in error["ctx"].items()}
        serializable_errors.append(error_dict)

    return JSONResponse(
        status_code=422,
        content={
            "detail": serializable_errors,
            "body": str(exc.body) if hasattr(exc, "body") else None,
        },
    )


# 添加请求日志中间件（用于调试403）
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录所有请求和响应"""
    if request.url.path.startswith("/api/gcp-accounts"):
        logger.debug(
            f"🔍 GCP请求 - Method: {request.method}, Path: {request.url.path}, Headers: {dict(request.headers)}"
        )

    response = await call_next(request)

    if request.url.path.startswith("/api/gcp-accounts") and response.status_code == 403:
        logger.error(
            f"❌ GCP 403错误 - Method: {request.method}, Path: {request.url.path}, Status: {response.status_code}"
        )

    return response


# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),  # 从配置读取允许的来源
    allow_credentials=True,  # 允许携带认证信息（cookies, authorization headers）
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # 允许的HTTP方法
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],  # 允许的请求头
    expose_headers=["Content-Length", "X-Request-ID", "Content-Type", "Cache-Control", "Connection"],  # 暴露给前端的响应头（包含 SSE 必需的响应头）
    max_age=600,  # 预检请求的缓存时间（秒）
)

# 注册路由
app.include_router(auth_router)  # 认证路由
app.include_router(profile_router)  # 个人信息路由
app.include_router(users_router)  # 用户管理路由
app.include_router(chat_router)  # 聊天历史路由
app.include_router(accounts_router)  # AWS 账号管理
app.include_router(gcp_accounts_router)  # GCP 账号管理
app.include_router(models_router)  # 模型管理路由
app.include_router(prompt_templates_router)  # 提示词模板路由
app.include_router(alerts_router)  # 告警管理路由 (Alert MCP Server)
# P2-3: 禁用监控 API（安全考虑）
app.include_router(monitoring_router)  # Phase 4: 监控路由（简化版）

# 挂载静态文件（开发环境禁用缓存）
class NoCacheStaticFiles(StaticFiles):
    """开发环境下禁用缓存的静态文件服务"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def __call__(self, scope, receive, send):
        """拦截响应，添加禁用缓存的响应头"""
        if scope["type"] == "http":

            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    headers = dict(message.get("headers", []))
                    # 开发环境禁用缓存（支持 local 和 development）
                    if settings.ENVIRONMENT in ("local", "development"):
                        headers[b"cache-control"] = b"no-cache, no-store, must-revalidate"
                        headers[b"pragma"] = b"no-cache"
                        headers[b"expires"] = b"0"
                    message["headers"] = list(headers.items())
                await send(message)

            await super().__call__(scope, receive, send_wrapper)
        else:
            await super().__call__(scope, receive, send)


# 挂载静态文件（如果目录存在）
if os.path.exists("static"):
    app.mount("/static", NoCacheStaticFiles(directory="static"), name="static")
else:
    logger.warning("⚠️  static 目录不存在，静态文件服务已禁用。请运行前端构建或创建 static 目录。")


@app.get("/")
async def get_index(response: Response):
    """返回React应用"""
    react_index = "static/react-build/index.html"

    if os.path.exists(react_index):
        with open(react_index, encoding="utf-8") as f:
            html_content = f.read()

        # 🚨 禁用缓存，确保加载最新代码
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # 修正静态资源路径
        html_content = html_content.replace('href="/assets/', 'href="/static/react-build/assets/')
        html_content = html_content.replace('src="/assets/', 'src="/static/react-build/assets/')
        html_content = html_content.replace(
            'href="/vite.svg"', 'href="/static/react-build/vite.svg"'
        )
        html_content = html_content.replace(
            'href="/cloud-icon.svg"', 'href="/static/react-build/cloud-icon.svg"'
        )

        return HTMLResponse(content=html_content)

    return {
        "error": "Frontend not built",
        "message": "Please run 'npm run build' in the frontend directory",
    }


@app.get("/health")
async def health():
    """基础健康检查"""
    return {"status": "healthy"}


@app.get("/health/detailed")
async def health_detailed():
    """详细健康检查"""
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/api/stats")
async def get_resource_stats():
    """
    获取资源使用统计

    Returns:
        dict: 包含资源使用情况的统计信息
    """
    from .services.resource_manager import get_resource_manager
    # 新架构：移除dynamic_clients和dynamic_agent
    # from .mcp.dynamic_clients import get_dynamic_client_manager
    # from .agent.dynamic_agent import get_dynamic_agent_manager

    resource_manager = get_resource_manager()

    return {
        "timestamp": time.time(),
        "resources": resource_manager.get_stats(),
        "architecture": "simplified",  # 标识新架构
        "note": "新架构无MCP/Agent缓存",
    }


async def get_current_user_optional(request: Request) -> dict | None:
    """
    可选的用户认证（用于 sendBeacon 等场景）

    如果请求包含 Authorization header，则验证用户
    如果没有，则返回 None（允许匿名请求）
    """
    from fastapi.security import HTTPBearer
    from .utils.auth import decode_access_token
    from .services.user_storage import get_user_storage

    security = HTTPBearer(auto_error=False)
    credentials = await security(request)

    if not credentials:
        return None

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            return None

        user_storage = get_user_storage()
        user = user_storage.get_user_by_id(user_id)
        if not user or not user.get("is_active"):
            return None

        return user
    except Exception:
        return None


@app.post("/api/sse/cancel/v2/{query_id}")
async def cancel_query_v2(query_id: str, request: Request, current_user: dict | None = Depends(get_current_user_optional)):
    """
    取消正在进行的查询（优雅的 API 设计）

    **设计理念**:
    - ✅ 显式调用取消接口（类似 Go SDK 的 CancelQuery）
    - ✅ 通过 query_id 查找查询并立即停止
    - ✅ 返回明确的成功/失败响应

    **认证**:
    - 优先使用 `Authorization: Bearer {token}` Header（如果提供）
    - 如果没有认证信息，允许通过（用于 sendBeacon）

    **使用示例**:
    ```bash
    curl -X POST http://localhost:8000/api/sse/cancel/v2/query_123 \
      -H "Authorization: Bearer {token}" \
      -H "Content-Type: application/json" \
      -d '{"reason": "user_cancelled"}'
    ```
    """
    try:
        # 尝试获取用户信息（可能为空，如果是 sendBeacon 请求）
        user_id = current_user.get("id") if current_user else None
        username = current_user.get("username", "Unknown") if current_user else "Unknown"

        # 获取取消原因
        reason = "user_cancelled"
        try:
            body = await request.json()
            reason = body.get("reason", "user_cancelled")
        except Exception:
            pass

        # ✅ 调用 agent_provider.cancel() 取消查询
        from .api.agent_provider import get_agent_provider

        agent_provider = get_agent_provider()
        success = await agent_provider.cancel(query_id)

        if not success:
            logger.warning("[V2] - QueryID: %s", query_id)
            return {
                "success": False,
                "error": "Query not found",
                "query_id": query_id
            }

        logger.info("[V2] - QueryID: %s, Reason: %s, User: %s", query_id, reason, username)

        return {
            "success": True,
            "message": "Query cancelled successfully",
            "query_id": query_id,
            "reason": reason
        }

    except Exception as e:
        logger.error("❌ [V2] 取消查询失败: %s", e, exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "query_id": query_id
        }


# ✅ WebSocket 端点已移除，现在使用 SSE
# @app.websocket("/ws") - 已废弃，使用 /api/sse/query/v2 代替
# ✅ /api/sse/message 端点已移除，现在使用 /api/sse/query/v2 和 /api/sse/cancel/v2/{query_id}


@app.post("/api/sse/query/v2", response_class=StreamingResponse)
async def sse_query_v2(
    request: Request,
    query_request: SSEQueryRequestV2,
    current_user: dict = Depends(get_current_user),
):
    """
    SSE 查询端点（使用 POST 方法）

    **特性**:
    - ✅ 使用 POST 方法（支持长查询内容）
    - ✅ 使用标准的 Authorization Header Bearer Token
    - ✅ 所有参数在 Body 中传输

    **认证**:
    - 使用 `Authorization: Bearer {token}` Header
    - 通过 `get_current_user` 依赖注入验证 Token
    """
    return await sse_query_endpoint_v2(request, query_request, current_user)


@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """
    Catch-all route for SPA client-side routing

    Returns the React app index.html for any non-API/non-static route.
    This allows React Router to handle client-side routing.
    Must be placed LAST to avoid catching API routes.
    """
    import os

    from fastapi.responses import HTMLResponse

    # ✅ 排除静态文件路径 - 防止拦截 JS/CSS 等资源
    if full_path.startswith("static/") or full_path.startswith("api/"):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Not Found")

    react_index = "static/react-build/index.html"

    if os.path.exists(react_index):
        with open(react_index, encoding="utf-8") as f:
            html_content = f.read()

        # Fix static asset paths
        html_content = html_content.replace('href="/assets/', 'href="/static/react-build/assets/')
        html_content = html_content.replace('src="/assets/', 'src="/static/react-build/assets/')
        html_content = html_content.replace(
            'href="/vite.svg"', 'href="/static/react-build/vite.svg"'
        )
        html_content = html_content.replace(
            'href="/cloud-icon.svg"', 'href="/static/react-build/cloud-icon.svg"'
        )

        return HTMLResponse(content=html_content)

    # If React build doesn't exist, return 404
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="Frontend not built")
