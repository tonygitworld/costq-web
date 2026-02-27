"""Agent Provider - Agent 抽象层，提供查询和取消接口"""

import asyncio
import base64
import json
import time
import uuid
from abc import ABC, abstractmethod
from typing import AsyncIterator

# ✅ 用于快速取消检测
try:
    anext = anext  # Python 3.10+
except NameError:
    # Python 3.9 兼容
    async def anext(iterator):
        return await iterator.__anext__()

import logging

from ..api.agentcore_response_parser import AgentCoreResponseParser
from ..api.query_registry import query_registry
from ..config.settings import settings
from ..services.agentcore_client import AgentCoreClient
from ..services.audit_logger import get_audit_logger
from ..services.resource_manager import get_resource_manager
from ..services.user_storage import get_user_storage

logger = logging.getLogger(__name__)


def build_message_metadata(token_usage_data: dict | None) -> str | None:
    """
    构建消息的 metadata JSON 字符串

    Args:
        token_usage_data: Token 统计数据字典

    Returns:
        metadata JSON 字符串，失败时返回 None
    """
    import json

    if not token_usage_data:
        return None

    metadata_dict = {"token_usage": token_usage_data}

    try:
        return json.dumps(metadata_dict)
    except (TypeError, ValueError) as e:
        logger.error("Token : %s", e)
        return None


class AgentProvider(ABC):
    """Agent 提供者接口"""

    @abstractmethod
    async def query(
        self,
        query_id: str,
        query: str,
        user_id: str,
        org_id: str,
        role: str,
        username: str,
        account_ids: list[str],
        gcp_account_ids: list[str],
        session_id: str | None = None,
        model_id: str | None = None,
        cancel_event: asyncio.Event | None = None,
        images: list | None = None,
        files: list | None = None,
    ) -> AsyncIterator[dict]:
        """
        执行查询并返回流式结果

        Args:
            query_id: 查询ID
            query: 用户查询内容
            user_id: 用户ID
            org_id: 组织ID
            role: 用户角色
            username: 用户名
            account_ids: AWS账号ID列表
            gcp_account_ids: GCP账号ID列表
            session_id: 会话ID（可选）
            model_id: AI 模型 ID（可选）
            cancel_event: 取消事件（可选）
            images: 图片附件列表（可选）
            files: 文件附件列表（Excel 等，可选）

        Yields:
            dict: 查询事件（status, content, tool_call, complete, error等）
        """
        pass

    @abstractmethod
    async def cancel(self, query_id: str) -> bool:
        """
        取消正在进行的查询

        Args:
            query_id: 查询ID

        Returns:
            bool: 是否成功取消
        """
        pass


class AWSBedrockAgentProvider(AgentProvider):
    """AWS Bedrock Agent 提供者实现"""

    def __init__(self):
        self._query_registry = query_registry

    async def query(
        self,
        query_id: str,
        query: str,
        user_id: str,
        org_id: str,
        role: str,
        username: str,
        account_ids: list[str],
        gcp_account_ids: list[str],
        session_id: str | None = None,
        model_id: str | None = None,
        cancel_event: asyncio.Event | None = None,
        images: list | None = None,
        files: list | None = None,
    ) -> AsyncIterator[dict]:
        """执行查询（包含所有业务逻辑）"""

        # ✅ 记录用户查询日志（关键日志，必须显示）
        query_preview = query[:100] + "..." if len(query) > 100 else query
        logger.info(
            "💬 [聊天查询] 用户 %s 发送查询: %s | model_id=%s",
            username,
            query_preview,
            model_id,
            extra={
                "user_id": user_id,
                "username": username,
                "org_id": org_id,
                "query_id": query_id,
                "session_id": session_id,
                "query_length": len(query),
                "account_ids": account_ids,
                "gcp_account_ids": gcp_account_ids,
                "account_count": len(account_ids) + len(gcp_account_ids),
                "model_id": model_id,
            }
        )

        # ✅ 注册查询到 registry
        if cancel_event:
            await self._query_registry.register(query_id, session_id, cancel_event)

        try:
            # 并发查询限制检查
            resource_manager = get_resource_manager()
            if not await resource_manager.check_query_limit(user_id):
                logger.warning("并发查询数达到上限 - User: %s", username)
                yield {
                    "type": "error",
                    "content": "并发查询数达到上限，请等待当前查询完成",
                    "query_id": query_id,
                    "session_id": session_id,
                    "timestamp": time.time(),
                }
                return

            # 记录审计日志
            audit_logger = get_audit_logger()
            if account_ids:
                audit_logger.log_query(user_id, org_id, query, account_ids, "aws", session_id=session_id)
            if gcp_account_ids:
                audit_logger.log_query(user_id, org_id, query, gcp_account_ids, "gcp", session_id=session_id)

            # 权限验证
            user_storage = get_user_storage()
            if role != "admin":
                if account_ids:
                    allowed_aws_accounts = user_storage.get_user_aws_accounts(user_id)
                    unauthorized_aws = [aid for aid in account_ids if aid not in allowed_aws_accounts]
                    if unauthorized_aws:
                        logger.warning("- User: %s, AWS: %s", username, unauthorized_aws)
                        yield {
                            "type": "error",
                            "content": f"❌ 您没有访问以下AWS账号的权限: {', '.join(unauthorized_aws[:3])}{'...' if len(unauthorized_aws) > 3 else ''}",
                            "query_id": query_id,
                            "session_id": session_id,
                            "timestamp": time.time(),
                        }
                        return

                if gcp_account_ids:
                    allowed_gcp_accounts = user_storage.get_user_gcp_accounts(user_id)
                    unauthorized_gcp = [gid for gid in gcp_account_ids if gid not in allowed_gcp_accounts]
                    if unauthorized_gcp:
                        logger.warning("- User: %s, GCP: %s", username, unauthorized_gcp)
                        yield {
                            "type": "error",
                            "content": f"❌ 您没有访问以下GCP账号的权限: {', '.join(unauthorized_gcp[:3])}{'...' if len(unauthorized_gcp) > 3 else ''}",
                            "query_id": query_id,
                            "session_id": session_id,
                            "timestamp": time.time(),
                        }
                        return
            else:
                logger.info("用户无需验证 - User: %s", username)

            # 性能追踪
            query_start = time.time()

            # 获取账号信息
            from ..services.account_storage import get_account_storage
            from ..services.aws_credentials_provider import get_credentials_provider
            from ..services.gcp_account_storage_postgresql import get_gcp_account_storage_postgresql
            from ..services.gcp_credentials_provider import get_gcp_credentials_provider

            aws_credentials_provider = get_credentials_provider()
            gcp_credentials_provider = get_gcp_credentials_provider()
            aws_account_storage = get_account_storage()
            gcp_account_storage = get_gcp_account_storage_postgresql()

            if role == "admin":
                all_aws_accounts = aws_account_storage.list_accounts(org_id=org_id)
                all_gcp_accounts = gcp_account_storage.list_accounts(org_id=org_id)
                logger.info(
                    "管理员账号查询 - Org: %s, AWS: %s, GCP: %s",
                    org_id, len(all_aws_accounts), len(all_gcp_accounts),
                )
            else:
                authorized_aws_account_ids = user_storage.get_user_aws_accounts(user_id)
                all_gcp_accounts = gcp_account_storage.list_accounts(org_id=org_id)
                all_aws_accounts_raw = aws_account_storage.list_accounts(org_id=org_id)
                all_aws_accounts = [acc for acc in all_aws_accounts_raw if acc["id"] in authorized_aws_account_ids]
                logger.info(
                    "普通用户账号查询 - Org: %s, AWS: %s/%s, GCP: %s",
                    org_id, len(all_aws_accounts),
                    len(all_aws_accounts_raw), len(all_gcp_accounts),
                )

            if not all_aws_accounts and not all_gcp_accounts:
                yield {
                    "type": "response",
                    "content": """❗ **请先配置云账号**

您还没有添加任何云账号。请按以下步骤操作：

**添加 AWS 账号：**
1. 点击侧边栏的 **"AWS 账号"** 按钮
2. 点击 **"添加账号"**
3. 填写您的 AWS 凭证信息

**添加 GCP 账号：**
1. 点击侧边栏的 **"GCP 账号"** 按钮
2. 点击 **"添加账号"**
3. 上传您的 GCP Service Account JSON

添加完成后，您就可以开始查询了！

💡 如果需要帮助，请参考文档或联系管理员。""",
                    "timestamp": time.time(),
                }
                return

            # 确定要使用的账号
            account_id_to_use = None
            account_type = None

            if account_ids and len(account_ids) > 0:
                account_id_to_use = account_ids[0]
                account_type = "aws"
            elif gcp_account_ids and len(gcp_account_ids) > 0:
                account_id_to_use = gcp_account_ids[0]
                account_type = "gcp"
            elif all_aws_accounts:
                default_account = all_aws_accounts[0]
                account_id_to_use = default_account["id"]
                account_type = "aws"
            elif all_gcp_accounts:
                default_account = all_gcp_accounts[0]
                account_id_to_use = default_account["id"]
                account_type = "gcp"

            # 获取或创建session_id
            chat_storage = None
            try:
                from ..services.chat_storage import get_chat_storage
                chat_storage = get_chat_storage()

                if session_id:
                    try:
                        existing_session = chat_storage.get_session(session_id)
                        if not existing_session:
                            # ✅ 如果不存在，使用前端提供的UUID创建新会话
                            session_title = query[:20] + "..." if len(query) > 20 else query
                            logger.info("UUID: %s", session_id)
                            session = chat_storage.create_session(
                                user_id=user_id,
                                org_id=org_id,
                                title=session_title,
                                session_id=session_id  # ✅ 使用前端提供的UUID
                            )
                            session_id = session["id"]

                            # ✅ 发送 session_created 事件（用于确认，但前端已经知道）
                            yield {
                                "type": "session_created",
                                "session_id": session_id,
                                "query_id": query_id,
                                "timestamp": time.time(),
                            }
                        elif existing_session["user_id"] != user_id:
                            # ✅ 如果存在但不属于当前用户，拒绝
                            logger.warning("%s ", session_id)
                            session_id = None
                        else:
                            # ✅ 如果存在且属于当前用户，复用
                            logger.info("复用已有会话: %s", session_id)
                    except Exception as e:
                        logger.error("会话验证失败: %s", e, exc_info=True)
                        session_id = None

                if not session_id:
                    # ✅ 如果没有提供 session_id 或验证失败，创建新会话（向后兼容）
                    session_title = query[:20] + "..." if len(query) > 20 else query
                    try:
                        session = chat_storage.create_session(user_id=user_id, org_id=org_id, title=session_title)
                        session_id = session["id"]
                        logger.info("创建新会话: %s", session_id)

                        yield {
                            "type": "session_created",
                            "session_id": session_id,
                            "query_id": query_id,
                            "timestamp": time.time(),
                        }
                    except Exception as e:
                        logger.error("创建会话失败: %s", e, exc_info=True)
                        session_id = None
            except Exception as e:
                logger.error("会话处理失败: %s", e, exc_info=True)
                session_id = None
                chat_storage = None

            # 发送初始化状态
            yield {
                "type": "status",
                "status_type": "initializing",
                "message": "正在初始化账号连接...",
                "session_id": session_id,
                "query_id": query_id,
            }

            # 获取账号元数据（只获取显示信息，不获取凭证）
            gcp_account_info = None
            account_display_name = None
            aws_account_id_12digit = None

            try:
                if account_type == "gcp":
                    # ✅ 只获取 GCP 账号元数据（账号名称、项目ID等）
                    gcp_account_info = gcp_credentials_provider.get_account_info(account_id_to_use)
                    if not gcp_account_info:
                        raise Exception(f"GCP 账号 {account_id_to_use} 不存在")
                    account_display_name = gcp_account_info.get("account_name", account_id_to_use)
                else:
                    # ✅ 只获取 AWS 账号元数据（账号别名、账号ID等）
                    # ⚠️ 不获取凭证（凭证由 Runtime 负责获取）
                    aws_account_info = aws_credentials_provider.get_account_info(account_id_to_use)
                    if not aws_account_info:
                        raise Exception(f"AWS 账号 {account_id_to_use} 不存在")
                    account_display_name = aws_account_info.get("alias", account_id_to_use)
                    # ✅ 获取 AWS 账号 ID（12位数字），用于增强查询显示
                    aws_account_id_12digit = aws_account_info.get("account_id")
                    if not aws_account_id_12digit:
                        logger.warning("账号 %s 缺少 AWS Account ID (12位数字)", account_id_to_use)
            except Exception as e:
                logger.error("获取账号信息失败: %s", e)
                yield {
                    "type": "error",
                    "content": f"获取账号信息失败: {str(e)}",
                    "query_id": query_id,
                    "session_id": session_id,
                    "timestamp": time.time(),
                }
                return

            # 构建增强查询
            if account_type == "gcp":
                enhanced_query = f"""用户查询: {query}

当前查询的 GCP 账号:
- 账号名称: {gcp_account_info.get("account_name", "Unknown")}
- GCP 项目 ID: {gcp_account_info.get("project_id", "Unknown")}
- 组织 ID: {gcp_account_info.get("organization_id", "Unknown")}
"""
            else:
                # ✅ 使用 AWS 账号 ID（12位数字）而不是 UUID
                enhanced_query = f"""用户查询: {query}

当前查询的 AWS 账号:
- 账号别名: {account_display_name}
- AWS 账号 ID: {aws_account_id_12digit or account_id_to_use}
"""

            logger.info("开始查询 - User: %s, Query: %s", user_id, query_id)

            # 构建附件元数据（不含 base64 内容）
            metadata = None
            if images or files:
                # 定义 MIME 类型分类
                EXCEL_TYPES = {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-excel",
                }
                IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
                # 文档类型包括标准 MIME 和可能的变体
                DOCUMENT_TYPES = {
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "text/markdown",
                    "text/plain",
                    "text/x-markdown",
                }

                def is_document(f):
                    """判断文件是否为文档类型（支持 MIME 类型或文件扩展名）"""
                    if f.mime_type in DOCUMENT_TYPES:
                        return True
                    # 根据文件扩展名判断
                    doc_extensions = {".pdf", ".doc", ".docx", ".md", ".markdown", ".txt"}
                    return any(f.file_name.lower().endswith(ext) for ext in doc_extensions)

                def get_base64_size(base64_data: str, file_name: str) -> int:
                    """安全获取 base64 数据大小（字节），失败返回 0"""
                    try:
                        return len(base64.b64decode(base64_data))
                    except Exception as e:
                        logger.warning(
                            "附件 base64 解码失败 - file_name: %s, error: %s",
                            file_name,
                            e,
                        )
                        return 0

                attachments_metadata = {
                    "images": [
                        {"id": str(uuid.uuid4()), "fileName": img.file_name,
                         "fileSize": get_base64_size(img.base64_data, img.file_name),
                         "mimeType": img.mime_type}
                        for img in (images or [])
                    ],
                    "excels": [
                        {"id": str(uuid.uuid4()), "fileName": f.file_name,
                         "fileSize": get_base64_size(f.base64_data, f.file_name),
                         "mimeType": f.mime_type}
                        for f in (files or [])
                        if f.mime_type in EXCEL_TYPES or f.file_name.lower().endswith((".xlsx", ".xls"))
                    ],
                    "documents": [
                        {"id": str(uuid.uuid4()), "fileName": f.file_name,
                         "fileSize": get_base64_size(f.base64_data, f.file_name),
                         "mimeType": f.mime_type}
                        for f in (files or [])
                        if is_document(f)
                    ],
                }
                metadata = json.dumps({"attachments_metadata": attachments_metadata})

            # 保存用户消息（使用 run_in_executor 避免阻塞事件循环）
            if chat_storage and session_id:
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: chat_storage.save_message(
                            session_id=session_id,
                            user_id=user_id,
                            message_type="user",
                            content=query,
                            metadata=metadata,
                        ),
                    )
                except Exception as e:
                    logger.error("保存用户消息失败: %s", e, exc_info=True)

            # 初始化Runtime客户端和解析器
            client = AgentCoreClient(
                runtime_arn=settings.AGENTCORE_RUNTIME_ARN,
                region=settings.AGENTCORE_REGION,
            )
            parser = AgentCoreResponseParser(session_id=session_id)

            # ✅ 记录即将调用 Agent Runtime 的参数（不区分环境）
            logger.info(
                "🚀 [SSE查询] 准备调用 Agent Runtime",
                extra={
                    "query_id": query_id,
                    "session_id": session_id,
                    "user_id": user_id,
                    "org_id": org_id,
                    "account_id": account_id_to_use,
                    "account_type": account_type,
                    "account_display_name": account_display_name,
                    "query_length": len(query),
                    "enhanced_query_length": len(enhanced_query),
                    "runtime_arn": settings.AGENTCORE_RUNTIME_ARN,
                    "runtime_region": settings.AGENTCORE_REGION,
                    "session_microvm_note": f"Session({session_id})将映射到MicroVM(runtimeSessionId={session_id})" if session_id else "无session_id，AWS将生成临时MicroVM",
                }
            )

            # 发送连接状态
            yield {
                "type": "status",
                "status_type": "processing",
                "message": f"已连接到 {account_display_name}，正在启动分析...",
                "session_id": session_id,
                "query_id": query_id,
            }

            # 调用Runtime并流式转发
            assistant_response = []
            event_count = 0
            token_usage_data = None

            try:
                # ✅ 创建事件流迭代器
                event_stream = client.invoke_streaming(
                    prompt=enhanced_query,
                    account_id=account_id_to_use,
                    session_id=session_id,
                    user_id=user_id,
                    org_id=org_id,
                    account_type=account_type,
                    model_id=model_id,
                    images=images,
                    files=files,
                )

                event_iter = aiter(event_stream)
                iteration_start_time = time.time()
                first_event_received = False

                # ✅ 直接迭代事件流，不添加超时机制（让 invoke_streaming 正常等待事件）
                # 取消检测通过 cancel_event 在 invoke_streaming 内部实现
                while True:
                    try:
                        # ✅ 直接等待下一个事件，不添加超时
                        event = await anext(event_iter)

                        if not first_event_received:
                            first_event_received = True
                            wait_duration = time.time() - iteration_start_time
                            logger.info(
                                "📥 [AgentProvider] 收到第一个事件（等待了 %.2f 秒） - QueryID: %s",
                                wait_duration,
                                query_id,
                                extra={
                                    "wait_duration": f"{wait_duration:.2f}秒",
                                    "query_id": query_id,
                                }
                            )

                        if cancel_event and cancel_event.is_set():
                            logger.info("用户取消查询 - QueryID: %s", query_id)

                            # ✅ 停止 AWS Bedrock Session（如果有 session_id）
                            if session_id:
                                try:
                                    success = client.stop_runtime_session(session_id)
                                    if success:
                                        logger.info("已停止 AWS Bedrock Session - SessionID: %s, Query: %s", session_id, query_id)
                                    else:
                                        logger.warning("停止 AWS Bedrock Session 失败 - SessionID: %s, Query: %s", session_id, query_id)
                                except Exception as e:
                                    logger.warning("停止 AWS Bedrock Session 异常 - SessionID: %s, Query: %s, Error: %s", session_id, query_id, e)

                            yield {
                                "type": "generation_cancelled",
                                "query_id": query_id,
                                "message": "生成已取消",
                            }
                            break

                        event_count += 1

                        # 解析SSE事件 → 消息
                        ws_messages = parser.parse_event(event)

                        # ✅ 先捕获 token_usage 数据（在 yield 之前）
                        for ws_msg in ws_messages:
                            if ws_msg.get("type") == "token_usage":
                                token_usage_data = ws_msg.get("usage")
                                logger.info(
                                    "📊 [AgentProvider] 捕获到 token_usage 数据",
                                    extra={
                                        "query_id": query_id,
                                        "input_tokens": token_usage_data.get("input_tokens", 0) if token_usage_data else 0,
                                        "output_tokens": token_usage_data.get("output_tokens", 0) if token_usage_data else 0,
                                    }
                                )

                            if ws_msg.get("type") == "chunk":
                                assistant_response.append(ws_msg["content"])
                            elif ws_msg.get("type") == "error":
                                assistant_response.append(ws_msg["content"])

                        # ✅ 然后 yield 消息（包括 token_usage 事件，供前端兼容处理）
                        for ws_msg in ws_messages:
                            yield ws_msg
                    except StopAsyncIteration:
                        iteration_duration = time.time() - iteration_start_time
                        logger.info(
                            "🛑 [AgentProvider] 迭代结束（StopAsyncIteration，"
                            "总耗时: %.2f秒，事件数: %s） - QueryID: %s",
                            iteration_duration,
                            event_count,
                            query_id,
                            extra={
                                "iteration_duration": f"{iteration_duration:.2f}秒",
                                "event_count": event_count,
                                "query_id": query_id,
                            }
                        )
                        break
                    except Exception as e:
                        iteration_duration = time.time() - iteration_start_time
                        logger.error(
                            "❌ [AgentProvider] 迭代异常（耗时: %.2f秒，"
                            "事件数: %s） - QueryID: %s, Error: %s",
                            iteration_duration,
                            event_count,
                            query_id,
                            e,
                            extra={
                                "iteration_duration": f"{iteration_duration:.2f}秒",
                                "event_count": event_count,
                                "error": str(e),
                                "error_type": type(e).__name__,
                                "query_id": query_id,
                            },
                            exc_info=True,
                        )
                        raise

                response = "".join(assistant_response) if assistant_response else None
                query_time = time.time() - query_start

                if not response or len(response.strip()) == 0:
                    logger.error(
                        "Runtime 返回空响应 - Query: %s, 耗时: %.2f秒, 事件数: %s",
                        query_id, query_time, event_count,
                    )
                    yield {
                        "type": "complete",
                        "success": False,
                        "error": "服务器未返回响应，请重试或简化问题",
                        "query_id": query_id,
                        "timestamp": time.time(),
                        "meta": {
                            "query_time": query_time,
                            "event_count": event_count,
                        }
                    }
                else:
                    # 保存助手响应
                    if chat_storage and session_id:
                        try:
                            metadata_json = build_message_metadata(token_usage_data)

                            await asyncio.get_event_loop().run_in_executor(
                                None,
                                chat_storage.save_message,
                                session_id,
                                user_id,
                                "assistant",
                                response.strip(),
                                metadata_json,
                                None,
                                None,
                                None,
                            )
                        except Exception as e:
                            logger.error("保存助手响应失败: %s", e, exc_info=True)

                    # 发送成功complete事件（包含 token_usage）
                    complete_event = {
                        "type": "complete",
                        "success": True,
                        "query_id": query_id,
                        "timestamp": time.time(),
                        "meta": {
                            "query_time": query_time,
                            "event_count": event_count,
                            "response_length": len(response),
                        }
                    }

                    # ✅ 如果有 Token 统计数据，直接包含在 complete 事件中
                    if token_usage_data:
                        complete_event["token_usage"] = token_usage_data
                        logger.info(
                            "📊 [AgentProvider] complete 事件包含 token_usage",
                            extra={
                                "query_id": query_id,
                                "input_tokens": token_usage_data.get("input_tokens", 0),
                                "output_tokens": token_usage_data.get("output_tokens", 0),
                            }
                        )

                    yield complete_event

                # 记录查询性能
                from ..utils.metrics import get_metrics
                metrics = get_metrics()
                primary_account_id = account_ids[0] if account_ids else "unknown"
                metrics.record_query_time(primary_account_id, query_time)

                logger.info("查询完成 - QueryID: %s", query_id)

            except Exception as e:
                logger.error("❌ Runtime 调用失败 - User: %s, QueryID: %s, Error: %s", username, query_id, e, exc_info=True)
                yield {
                    "type": "error",
                    "content": f"查询失败: {str(e)}",
                    "query_id": query_id,
                    "session_id": session_id,
                }
        except Exception as e:
            logger.error("❌ 处理查询失败 - User: %s, QueryID: %s, Error: %s", username, query_id, e, exc_info=True)
            yield {
                "type": "error",
                "content": f"处理请求失败: {str(e)}",
                "query_id": query_id,
                "session_id": session_id,
                "timestamp": time.time(),
            }
        finally:
            # ✅ 查询结束时自动清理
            await self._query_registry.unregister(query_id)
            logger.info("查询资源已清理 - QueryID: %s", query_id)

    async def cancel(self, query_id: str) -> bool:
        """取消查询"""
        info = await self._query_registry.get(query_id)
        if not info:
            logger.warning("[AgentProvider] 未找到查询 - QueryID: %s", query_id)
            return False

        # 设置取消标志
        await self._query_registry.cancel(query_id)

        # 停止 AWS Bedrock Session
        if info.session_id:
            try:
                client = AgentCoreClient(
                    runtime_arn=settings.AGENTCORE_RUNTIME_ARN,
                    region=settings.AGENTCORE_REGION,
                )
                success = client.stop_runtime_session(info.session_id)
                if success:
                    logger.info("[AgentProvider] 已停止 AWS Bedrock Session - SessionID: %s, Query: %s", info.session_id, query_id)
                else:
                    logger.warning("[AgentProvider] 停止 AWS Bedrock Session 失败 - SessionID: %s, Query: %s", info.session_id, query_id)
            except Exception as e:
                logger.warning("[AgentProvider] 停止 AWS Bedrock Session 异常 - SessionID: %s, Query: %s, Error: %s", info.session_id, query_id, e)

        return True


# 全局单例
_agent_provider: AgentProvider | None = None


def get_agent_provider() -> AgentProvider:
    """获取 Agent Provider 实例（单例）"""
    global _agent_provider
    if _agent_provider is None:
        _agent_provider = AWSBedrockAgentProvider()
    return _agent_provider
