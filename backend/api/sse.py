"""SSE API端点 - 网络 Handler 层，只负责 HTTP/SSE 处理"""

import asyncio
import json
import time
import uuid
from typing import Optional

from fastapi import Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..api.agent_provider import get_agent_provider
from ..utils.auth import get_current_user

import logging

logger = logging.getLogger(__name__)


# ✅ build_message_metadata 已迁移到 agent_provider.py


# ============================================================================
# SSE 查询接口 V2（新版本）
# ============================================================================

class ImageData(BaseModel):
    """图片数据"""
    file_name: str = Field(..., description="文件名")
    mime_type: str = Field(..., description="MIME 类型")
    base64_data: str = Field(..., description="Base64 编码数据（不含 data URI 前缀）")


class SSEQueryRequestV2(BaseModel):
    """SSE 查询请求 V2"""

    query: str = Field(..., description="用户查询内容", min_length=1)
    query_id: Optional[str] = Field(None, description="查询ID（可选，如果不提供则自动生成）")
    session_id: Optional[str] = Field(None, description="会话ID（可选，如果不提供则创建新会话）")
    account_ids: Optional[list[str]] = Field(None, description="AWS 账号ID列表")
    gcp_account_ids: Optional[list[str]] = Field(None, description="GCP 账号ID列表")
    model_id: Optional[str] = Field(None, description="AI 模型 ID")
    images: Optional[list[ImageData]] = Field(None, description="图片附件列表（可选）")
    files: Optional[list[ImageData]] = Field(None, description="文件附件列表（Excel 等，可选）")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "分析我的 AWS 成本",
                "query_id": "query_1768874592989_sc4nyqmg3",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "account_ids": ["fd524247-7c81-46e7-b3c6-2697264876a0"],
                "gcp_account_ids": [],
                "model_id": "us.anthropic.claude-sonnet-4-20250514-v1:0"
            }
        }


async def sse_query_endpoint_v2(
    request: Request,
    query_request: SSEQueryRequestV2,
    current_user: dict = Depends(get_current_user),
) -> StreamingResponse:
    """
    SSE 查询端点 V2（新版本）

    **改进**:
    - ✅ 使用 POST 方法（支持长查询内容）
    - ✅ 使用标准的 Authorization Header Bearer Token
    - ✅ 所有参数在 Body 中传输

    **认证**:
    - 使用 `Authorization: Bearer {token}` Header
    - 通过 `get_current_user` 依赖注入验证 Token

    **请求示例**:
    ```bash
    curl -X POST http://localhost:8000/api/sse/query/v2 \
      -H "Authorization: Bearer {token}" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "分析我的 AWS 成本",
        "session_id": "550e8400-e29b-41d4-a716-446655440000",
        "account_ids": ["fd524247-7c81-46e7-b3c6-2697264876a0"]
      }'
    ```
    """

    # 从 current_user 获取用户信息（已通过 get_current_user 验证）
    user_id = current_user.get("id")
    org_id = current_user.get("org_id")
    role = current_user.get("role")
    username = current_user.get("username", "Unknown")

    # 生成 query_id（如果未提供）
    query_id = query_request.query_id or f"query_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"

    # 解析账号ID列表
    account_ids_list = query_request.account_ids or []
    gcp_account_ids_list = query_request.gcp_account_ids or []

    logger.info(
        f"💬 [SSE查询V2] 用户 {username} 发送查询: {query_request.query[:100]}{'...' if len(query_request.query) > 100 else ''}",
        extra={
            "user_id": user_id,
            "username": username,
            "org_id": org_id,
            "query_id": query_id,
            "session_id": query_request.session_id,
            "query": query_request.query,
            "query_length": len(query_request.query),
            "account_ids": account_ids_list,
            "gcp_account_ids": gcp_account_ids_list,
            "account_count": len(account_ids_list) + len(gcp_account_ids_list),
            "model_id": query_request.model_id,
        }
    )

    # ✅ 调用 agent_provider 处理查询（网络层只负责格式转换）
    #
    # ============================================================================
    # 为什么在函数内部定义函数（闭包 Closure）？
    # ============================================================================
    #
    # 1. **闭包（Closure）机制**：
    #    - `generate()` 定义在 `sse_query_endpoint_v2()` 内部，可以访问外部函数的
    #      所有变量（request, query_id, query_request, user_id, org_id, role, username等）
    #    - 无需通过参数传递这些变量，代码更简洁
    #
    # 2. **作用域隔离**：
    #    - `generate()` 和 `watch_disconnect()` 只在需要时存在，不会污染模块级别的命名空间
    #    - 这些函数是 SSE 流式响应专用的，不需要被其他模块调用
    #
    # 3. **上下文共享**：
    #    - `generate()` 可以直接访问 `request` 对象（用于检测连接断开）
    #    - `generate()` 可以直接访问 `query_id`、`query_request` 等变量
    #    - `watch_disconnect()` 可以直接访问 `request` 和 `cancel_event`
    #
    # 4. **生命周期管理**：
    #    - 内部函数的生命周期与外部函数绑定，当 `sse_query_endpoint_v2()` 执行完毕，
    #      内部函数也会自动清理，符合资源管理的最佳实践
    #
    # 5. **FastAPI StreamingResponse 的要求**：
    #    - `StreamingResponse` 需要一个异步生成器函数
    #    - 将生成器定义在函数内部，可以确保每次请求都有独立的生成器实例
    #    - 每个请求的 `request`、`query_id` 等变量都是独立的，不会相互干扰
    #
    # 示例对比：
    #
    # ❌ 不好的设计（模块级别函数，需要传递大量参数）：
    #    async def generate(request, query_id, query_request, user_id, org_id, ...):
    #        # 需要传递很多参数，代码冗长
    #
    # ✅ 好的设计（闭包，直接访问外部变量）：
    #    async def sse_query_endpoint_v2(...):
    #        query_id = ...
    #        async def generate():  # 直接访问 query_id，无需参数传递
    #            ...
    #
    async def generate():
        """
        SSE 流式响应生成器（异步生成器函数）

        这是一个闭包函数，可以访问外部函数 `sse_query_endpoint_v2()` 的所有变量：
        - request: FastAPI Request 对象（用于检测连接断开）
        - query_id: 查询ID
        - query_request: 查询请求对象
        - user_id, org_id, role, username: 用户信息
        - account_ids_list, gcp_account_ids_list: 账号ID列表

        这样设计避免了通过参数传递大量变量，代码更简洁、可读性更好。
        """
        # ✅ 创建取消事件，用于后台任务通知连接断开
        cancel_event = asyncio.Event()

        # ========================================================================
        # 为什么 `watch_disconnect()` 也定义在 `generate()` 内部？
        # ========================================================================
        #
        # 1. **访问 `cancel_event`**：
        #    - `watch_disconnect()` 需要访问 `cancel_event` 来设置取消标志
        #    - 如果定义在模块级别，需要通过参数传递，代码更复杂
        #
        # 2. **访问 `request` 和 `query_id`**：
        #    - `watch_disconnect()` 需要访问 `request` 来检测连接断开
        #    - 需要访问 `query_id` 来记录日志
        #    - 这些变量都来自 `sse_query_endpoint_v2()`，通过闭包可以自然访问
        #
        # 3. **生命周期绑定**：
        #    - `watch_disconnect()` 的生命周期与 `generate()` 绑定
        #    - 当 `generate()` 结束时，`watch_disconnect()` 任务也会被取消
        #    - 这样确保了资源不会泄漏
        #
        # ✅ 后台任务：监控连接断开
        async def watch_disconnect():
            """
            后台任务：监控 HTTP 连接断开

            这是一个闭包函数，可以访问：
            - request: FastAPI Request 对象（检测连接状态）
            - query_id: 查询ID（用于日志）
            - cancel_event: 取消事件（设置取消标志）

            为什么需要这个后台任务？
            - FastAPI 的 `request.is_disconnected()` 需要主动轮询检查
            - 如果连接断开，需要立即设置 `cancel_event`，通知业务逻辑层停止查询
            - 这样可以实现类似 Ctrl+C 的效果，快速响应客户端断开连接
            """
            try:
                while True:
                    if request and await request.is_disconnected():
                        logger.info("[] Ctrl+C- QueryID: %s", query_id)
                        cancel_event.set()  # ✅ 设置取消标志
                        break
                    await asyncio.sleep(0.1)  # ✅ 每 100ms 检查一次
            except asyncio.CancelledError:
                pass  # 正常取消
            except Exception as e:
                logger.warning("[] : %s", e)

        # ✅ 启动后台监控任务
        watch_task = asyncio.create_task(watch_disconnect())

        try:
            # ✅ 调用 agent_provider.query() 处理查询
            agent_provider = get_agent_provider()
            async for event in agent_provider.query(
                query_id=query_id,
                query=query_request.query,
                user_id=user_id,
                org_id=org_id,
                role=role,
                username=username,
                account_ids=account_ids_list,
                gcp_account_ids=gcp_account_ids_list,
                session_id=query_request.session_id,
                model_id=query_request.model_id,
                cancel_event=cancel_event,
                images=query_request.images,
                files=query_request.files,
            ):
                # ✅ 在每次 yield 前检查取消标志
                if cancel_event.is_set():
                    logger.info("[generate] - QueryID: %s", query_id)
                    yield f"data: {json.dumps({'type': 'generation_cancelled', 'query_id': query_id, 'message': '生成已取消'})}\n\n"
                    break

                # ✅ 转换为 SSE 格式
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            logger.info("[generate] - QueryID: %s", query_id)
            cancel_event.set()  # ✅ 确保设置取消标志
        except Exception as e:
            logger.error("❌ SSE查询V2失败: %s", e, exc_info=True)
            error_event = {
                "type": "error",
                "content": f"查询处理失败: {str(e)}",
                "query_id": query_id,
                "session_id": query_request.session_id,
                "timestamp": time.time(),
            }
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            # ✅ 取消后台监控任务
            watch_task.cancel()
            try:
                await watch_task
            except asyncio.CancelledError:
                pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        }
    )


# ✅ process_query_streaming 已迁移到 agent_provider.py
# ✅ 网络层（sse.py）现在只负责 HTTP/SSE 处理，调用 agent_provider.query()
