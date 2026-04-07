"""
AgentCore Runtime 客户端

使用 AWS 官方文档推荐的 boto3 方式调用 Runtime
参考: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-invoke-agent.html

实现方式:
1. 使用 boto3.client('bedrock-agentcore') 创建客户端
2. 使用 invoke_agent_runtime() 调用 Runtime
3. 使用 iter_chunks() 迭代流式响应 (SSE 格式) - 避免 iter_lines() 的 IncompleteRead Bug
4. 通过 asyncio.Queue + threading.Thread 实现异步包装
"""

import asyncio
import json
import logging
import threading
import time
from collections.abc import AsyncIterator
from http.client import IncompleteRead

import boto3

logger = logging.getLogger(__name__)


class AgentCoreClient:
    """AgentCore Runtime 客户端（使用 AWS 官方 boto3 方式）"""

    def __init__(self, runtime_arn: str, region: str = "ap-northeast-1"):
        """
        初始化客户端

        Args:
            runtime_arn: Runtime ARN
            region: AWS 区域
        """
        self.runtime_arn = runtime_arn
        self.region = region
        # AWS 官方推荐：创建 boto3 客户端（增加超时配置）
        from botocore.config import Config

        config = Config(
            read_timeout=120,  # 120 秒读取超时（单次 chunk 读取，非整个流）
            connect_timeout=30,  # 30 秒连接超时
        )
        self.client = boto3.client(
            "bedrock-agentcore", region_name=region, config=config
        )
        logger.info("AgentCoreClient : %s", runtime_arn)

    def stop_runtime_session(self, runtime_session_id: str, qualifier: str = "DEFAULT") -> bool:
        """
        停止正在运行的 Runtime Session

        使用 AWS Bedrock AgentCore 的 StopRuntimeSession API 来立即终止活跃的 session
        并停止任何正在进行的流式响应。

        参考文档：
        - https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-stop-session.html
        - https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_StopRuntimeSession.html

        Args:
            runtime_session_id: Runtime Session ID（就是我们的 session_id）
            qualifier: 限定符（可选，默认 'DEFAULT'）

        Returns:
            bool: 是否成功停止（如果 session 不存在或已终止，返回 False）

        Raises:
            Exception: 如果停止失败（除了 ResourceNotFoundException）
        """
        try:
            response = self.client.stop_runtime_session(
                agentRuntimeArn=self.runtime_arn,
                runtimeSessionId=runtime_session_id,
                qualifier=qualifier
            )
            logger.info(
                "✅ [Agent Runtime] Session 已停止 - SessionID: %s",
                runtime_session_id,
                extra={
                    "runtime_arn": self.runtime_arn,
                    "runtime_session_id": runtime_session_id,
                    "qualifier": qualifier,
                }
            )
            return True
        except self.client.exceptions.ResourceNotFoundException:
            logger.warning(
                "⚠️ [Agent Runtime] Session 不存在或已终止 - SessionID: %s",
                runtime_session_id,
                extra={
                    "runtime_arn": self.runtime_arn,
                    "runtime_session_id": runtime_session_id,
                }
            )
            return False
        except Exception as e:
            logger.error(
                "❌ [Agent Runtime] 停止 Session 失败 - SessionID: %s, Error: %s",
                runtime_session_id,
                e,
                exc_info=True,
                extra={
                    "runtime_arn": self.runtime_arn,
                    "runtime_session_id": runtime_session_id,
                }
            )
            raise

    async def invoke_streaming(
        self,
        prompt: str,
        account_id: str,
        session_id: str | None = None,
        user_id: str | None = None,
        org_id: str | None = None,
        prompt_type: str = "dialog",
        account_type: str = "aws",
        model_id: str | None = None,
        images: list | None = None,
        files: list | None = None,
    ) -> AsyncIterator[dict]:
        """
        异步流式调用 Runtime

        使用独立线程执行 boto3 同步调用，通过 asyncio.Queue 传递事件

        Args:
            prompt: 用户查询
            account_id: AWS/GCP 账号 ID
            session_id: 会话 ID（可选，对话场景使用）
            user_id: 用户 ID（可选，对话场景使用）
            org_id: 组织 ID（可选，对话场景使用）
            prompt_type: 提示词类型（默认: "dialog"）
                - "dialog": 对话场景，使用对话提示词 + Memory
                - "alert": 告警场景，使用告警提示词，无 Memory
            account_type: 账号类型（默认: "aws"）
                - "aws": AWS 账号
                - "gcp": GCP 账号
            model_id: AI 模型 ID（可选，如不提供则使用 Runtime 默认模型）

        Yields:
            dict: SSE 事件数据（已解析的 JSON 对象）

        Raises:
            Exception: Runtime 调用失败时抛出异常

        Note:
            RDS_SECRET_NAME 和 ENCRYPTION_KEY 不再通过 payload 传递，
            Runtime 容器直接从环境变量读取（在 Runtime 配置中设置）

        Examples:
            >>> # 对话场景（默认）
            >>> async for event in client.invoke_streaming(
            ...     prompt="查询成本",
            ...     account_id="123456789012",
            ...     session_id="sess-123",
            ... ):
            ...     process_event(event)

            >>> # 告警场景
            >>> async for event in client.invoke_streaming(
            ...     prompt="当日 EC2 成本超过 $1000",
            ...     account_id="123456789012",
            ...     prompt_type="alert",  # ✅ 关键
            ... ):
            ...     process_event(event)
        """
        event_queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _invoke_in_thread():
            """在线程中执行 AWS 官方文档推荐的同步调用"""
            event_count = 0
            bytes_read = 0
            chunk_count = 0

            try:
                logger.debug("🔵 [线程] 线程函数开始执行")
                # 构建 payload
                payload = {
                    "prompt": prompt,
                    "account_id": account_id,
                    "prompt_type": prompt_type,  # ✅ 传递提示词类型
                    "account_type": account_type,  # ✅ 传递账号类型
                }
                if session_id:
                    payload["session_id"] = session_id
                if user_id:
                    payload["user_id"] = user_id
                if org_id:
                    payload["org_id"] = org_id
                if model_id:
                    payload["model_id"] = model_id
                if images:
                    # ✅ 传递图片数据到 Runtime（Pydantic 模型转为 dict）
                    payload["images"] = [
                        img.model_dump() if hasattr(img, 'model_dump') else img
                        for img in images
                    ]
                if files:
                    # ✅ 传递文件附件数据到 Runtime（Excel 等）
                    payload["files"] = [
                        f.model_dump() if hasattr(f, 'model_dump') else f
                        for f in files
                    ]

                # ✅ 记录 Agent Runtime 调用参数（包含 model_id 追踪）
                logger.info(
                    "🚀 [Agent Runtime调用] 准备调用Agent Runtime"
                    " | model_id=%s",
                    model_id,
                    extra={
                        "runtime_arn": self.runtime_arn,
                        "prompt_type": prompt_type,
                        "account_type": account_type,
                        "session_id": session_id,
                        "user_id": user_id,
                        "org_id": org_id,
                        "account_id": account_id,
                        "prompt_length": len(prompt),
                        "has_session_id": session_id is not None,
                        "has_user_id": user_id is not None,
                        "has_org_id": org_id is not None,
                        "model_id": model_id,
                    }
                )

                # AWS 官方方式：调用 invoke_agent_runtime
                # 参数说明：
                # - agentRuntimeArn: Runtime ARN（必需）
                # - payload: 请求数据（必需）
                #   * session_id 在 payload 中传递（应用层会话 ID，用于 Memory 和聊天历史）
                # - runtimeSessionId: Runtime 级别的会话 ID（可选，让 AWS 自动生成）
                #   * 注意：这不是我们应用的 session_id！
                #   * 用于 Runtime 内部状态管理，与我们的聊天会话无关
                # - contentType/accept: 可选，默认值通常就够用

                # 这些日志已被上面的详细日志替代，可以删除或保留作为补充
                # logger.info(f"📤 [Client] 发送请求到Runtime: {self.runtime_arn}")
                # logger.info(f"📤 [Client] Payload键: {list(payload.keys())}")

                # ✅ 构建 invoke_agent_runtime 参数
                invoke_params = {
                    "agentRuntimeArn": self.runtime_arn,
                    "payload": json.dumps(payload).encode("utf-8"),
                }

                # ✅ P0 修复：如果有 session_id，作为 runtimeSessionId 传递
                # 这样可以：
                # 1. 复用 microVM（15分钟空闲超时，8小时最大生命周期）
                # 2. AgentCore Memory 自动关联对话历史
                # 3. 节省资源（不会每次查询都创建新的 microVM）
                if session_id:
                    # 确保 session_id 是字符串（可能是 UUID 对象）
                    invoke_params["runtimeSessionId"] = str(session_id)
                    logger.info(
                        "🔗 [Session-MicroVM映射] session_id → runtimeSessionId → MicroVM",
                        extra={
                            "session_id": str(session_id),
                            "runtime_session_id": str(session_id),
                            "mapping": f"session_id={session_id} → runtimeSessionId={session_id} → MicroVM",
                            "user_id": user_id,
                            "org_id": org_id,
                            "note": "AWS将根据runtimeSessionId复用或创建MicroVM（15分钟空闲超时）",
                        }
                    )
                    logger.info(
                        "✅ [Agent Runtime调用] 使用 runtimeSessionId 复用 microVM",
                        extra={
                            "runtime_session_id": str(session_id),
                            "session_id": session_id,
                            "user_id": user_id,
                            "org_id": org_id,
                        }
                    )
                else:
                    logger.info(
                        "📌 [Agent Runtime调用] 未指定 session_id，AWS 将自动生成临时 runtimeSessionId",
                        extra={
                            "user_id": user_id,
                            "org_id": org_id,
                            "note": "AWS将自动生成临时runtimeSessionId，每次查询可能创建新的MicroVM",
                        }
                    )

                # ✅ 记录 Runtime 调用开始（不区分环境）
                runtime_session_id = invoke_params.get("runtimeSessionId")

                logger.info(
                    "📤 [Agent Runtime调用] 发送请求到 Runtime",
                    extra={
                        "runtime_arn": self.runtime_arn,
                        "runtime_session_id": runtime_session_id,
                        "session_id": session_id,
                        "user_id": user_id,
                        "org_id": org_id,
                        "account_id": account_id,
                        "prompt_type": prompt_type,
                        "account_type": account_type,
                        "payload_keys": list(payload.keys()),
                        "session_microvm_mapping": f"Session({session_id}) → MicroVM(runtimeSessionId={runtime_session_id})" if session_id else "临时MicroVM",
                    }
                )

                invoke_start_time = time.time()
                response = self.client.invoke_agent_runtime(**invoke_params)
                invoke_duration = time.time() - invoke_start_time

                # ✅ 提取 runtimeSessionId 并注入合成事件，供告警场景捕获
                aws_runtime_session_id = response.get("runtimeSessionId")
                if aws_runtime_session_id:
                    asyncio.run_coroutine_threadsafe(
                        event_queue.put({"type": "runtime_session_id", "value": aws_runtime_session_id}),
                        loop,
                    )
                    logger.info(
                        "📌 [Agent Runtime调用] 注入 runtime_session_id 合成事件",
                        extra={"runtime_session_id": aws_runtime_session_id},
                    )

                content_type = response.get("contentType", "")
                # ✅ 记录 Runtime 响应（不区分环境）
                logger.info(
                    "📥 [Agent Runtime调用] 收到 Runtime 响应",
                    extra={
                        "content_type": content_type,
                        "response_keys": list(response.keys()),
                        "session_id": session_id,
                        "user_id": user_id,
                        "runtime_session_id": invoke_params.get("runtimeSessionId"),
                        "invoke_duration": f"{invoke_duration:.2f}秒",
                    }
                )

                # ✅ 修复：使用 iter_chunks() 替代 iter_lines()，避免 IncompleteRead Bug
                if "text/event-stream" in content_type:
                    logger.info("📥 [Client] 开始迭代流式响应（使用 iter_chunks）...")

                    # ✅ 手动处理行分割，避免 boto3 iter_lines 的 Bug
                    # chunk_size=4096 是平衡性能和稳定性的推荐值
                    buffer = b""
                    first_chunk_received = False  # ✅ 用于诊断：记录是否收到任何数据
                    iter_start_time = time.time()

                    try:
                        for chunk in response["response"].iter_chunks(chunk_size=4096):  # type: ignore[union-attr]
                            chunk_count += 1
                            bytes_read += len(chunk)
                            buffer += chunk

                            # ✅ 诊断：记录第一个 chunk 的内容（用于调试空响应问题）
                            if not first_chunk_received and chunk:
                                first_chunk_received = True
                                chunk_preview = chunk[:200].decode("utf-8", errors="ignore")
                                logger.debug(
                                    "📥 [Agent Runtime调用] 收到第一个 chunk",
                                    extra={
                                        "chunk_preview": chunk_preview,
                                        "chunk_size": len(chunk),
                                        "session_id": session_id,
                                        "user_id": user_id,
                                    }
                                )

                            # 每 20 个 chunk 记录一次进度（使用 extra 参数，不区分环境）
                            if chunk_count % 20 == 0:
                                logger.debug(
                                    "📊 [Agent Runtime调用] 流式传输进度",
                                    extra={
                                        "bytes_read": bytes_read,
                                        "chunk_count": chunk_count,
                                        "event_count": event_count,
                                        "session_id": session_id,
                                        "user_id": user_id,
                                    }
                                )

                            # 手动处理行分割
                            while b"\n" in buffer:
                                line_bytes, buffer = buffer.split(b"\n", 1)

                                if not line_bytes.strip():
                                    continue

                                line_str = line_bytes.decode("utf-8").strip()

                                # 解析 SSE 格式: "data: {...}"
                                if line_str.startswith("data: "):
                                    data_str = line_str[6:]  # 去掉 "data: " 前缀
                                    try:
                                        event_data = json.loads(data_str)
                                        event_count += 1

                                        # ✅ 详细日志：显示接收到的事件类型（不区分环境，使用 extra 参数）
                                        if event_count <= 5 or event_count % 50 == 0:
                                            event_keys = (
                                                list(event_data.keys())
                                                if isinstance(event_data, dict)
                                                else "not-dict"
                                            )
                                            logger.info(
                                                "📥 [Agent Runtime调用] 收到事件",
                                                extra={
                                                    "event_count": event_count,
                                                    "event_keys": event_keys,
                                                    "event_type": event_data.get("type") if isinstance(event_data, dict) else None,
                                                    "session_id": session_id,
                                                    "user_id": user_id,
                                                    "runtime_session_id": invoke_params.get("runtimeSessionId"),
                                                }
                                            )

                                        # ⭐ 专门检测 token_usage 事件
                                        if isinstance(event_data, dict) and event_data.get("type") == "token_usage":
                                            usage = event_data.get('usage', {})
                                            logger.info(
                                                "收到 token_usage 事件",
                                                extra={
                                                    "input_tokens": usage.get('input_tokens'),
                                                    "output_tokens": usage.get('output_tokens'),
                                                    "cache_read_tokens": usage.get('cache_read_tokens'),
                                                    "cache_write_tokens": usage.get('cache_write_tokens'),
                                                }
                                            )

                                        # 放入异步队列（已解析的字典）
                                        asyncio.run_coroutine_threadsafe(
                                            event_queue.put(event_data), loop
                                        )
                                    except json.JSONDecodeError as e:
                                        logger.warning(
                                            "⚠️ [Agent Runtime调用] 无法解析 SSE 数据",
                                            extra={
                                                "data_preview": data_str[:100],
                                                "error": str(e),
                                                "session_id": session_id,
                                                "user_id": user_id,
                                                "event_count": event_count,
                                            }
                                        )

                    except Exception as iter_error:
                        iter_duration = time.time() - iter_start_time
                        logger.error(
                            "❌ [Agent Runtime调用] iter_chunks() 迭代失败",
                            extra={
                                "error": str(iter_error),
                                "error_type": type(iter_error).__name__,
                                "iter_duration": f"{iter_duration:.2f}秒",
                                "event_count": event_count,
                                "bytes_read": bytes_read,
                                "chunk_count": chunk_count,
                                "session_id": session_id,
                                "user_id": user_id,
                                "buffer_preview": buffer.decode("utf-8", errors="ignore")[:200] if buffer else None,
                            },
                            exc_info=True,
                        )
                        # 重新抛出异常，让外层异常处理
                        raise
                    finally:
                        # ✅ 修复：主动关闭 HTTP 响应体，防止 iter_chunks 在流结束后
                        # 因连接未关闭而一直阻塞等待（boto3 已知问题）
                        try:
                            response["response"].close()
                        except Exception:
                            pass

                    iter_duration = time.time() - iter_start_time
                    logger.info(
                        "✅ [Agent Runtime调用] iter_chunks() 迭代完成",
                        extra={
                            "iter_duration": f"{iter_duration:.2f}秒",
                            "event_count": event_count,
                            "bytes_read": bytes_read,
                            "chunk_count": chunk_count,
                            "session_id": session_id,
                            "user_id": user_id,
                        }
                    )

                    # ✅ 处理剩余缓冲区（最后一行可能没有 \n）
                    if buffer.strip():
                        line_str = buffer.decode("utf-8").strip()
                        if line_str.startswith("data: "):
                            data_str = line_str[6:]
                            try:
                                event_data = json.loads(data_str)
                                event_count += 1
                                asyncio.run_coroutine_threadsafe(
                                    event_queue.put(event_data), loop
                                )
                                logger.debug(
                                    "✅ [Agent Runtime调用] 处理了缓冲区中的最后一行",
                                    extra={
                                        "session_id": session_id,
                                        "user_id": user_id,
                                    }
                                )
                            except json.JSONDecodeError:
                                logger.warning(
                                    "⚠️ [Agent Runtime调用] 无法解析最后一行",
                                    extra={
                                        "data_preview": data_str[:100],
                                        "session_id": session_id,
                                        "user_id": user_id,
                                    }
                                )

                    # ✅ 记录 Runtime 调用完成（不区分环境，移到 if buffer.strip() 块外）
                    # ⚠️ 如果 event_count = 0，记录警告和诊断信息
                    if event_count == 0:
                        logger.warning(
                            "⚠️ [Agent Runtime调用] Runtime 调用完成但未收到任何事件",
                            extra={
                                "event_count": event_count,
                                "bytes_read": bytes_read,
                                "chunk_count": chunk_count,
                                "session_id": session_id,
                                "user_id": user_id,
                                "buffer_preview": buffer.decode("utf-8", errors="ignore")[:200] if buffer else None,
                                "content_type": content_type,
                                "invoke_duration": f"{invoke_duration:.2f}秒",
                                "iter_duration": f"{iter_duration:.2f}秒",
                                "diagnosis": "可能原因：1) Runtime 返回空响应 2) 响应格式不正确 3) 响应被截断 4) iter_chunks() 提前结束"
                            }
                        )

                    logger.info(
                        "✅ [Agent Runtime调用] Runtime 调用完成",
                        extra={
                            "event_count": event_count,
                            "bytes_read": bytes_read,
                            "chunk_count": chunk_count,
                            "session_id": session_id,
                            "user_id": user_id,
                            "org_id": org_id,
                            "account_id": account_id,
                            "runtime_session_id": invoke_params.get("runtimeSessionId"),
                            "content_type": content_type,
                        }
                    )
                else:
                    logger.warning(
                        "⚠️ [Agent Runtime调用] 非流式响应",
                        extra={
                            "content_type": content_type,
                            "session_id": session_id,
                            "user_id": user_id,
                            "runtime_session_id": invoke_params.get("runtimeSessionId"),
                        }
                    )

                # 发送结束标记
                asyncio.run_coroutine_threadsafe(event_queue.put(None), loop)

                # 注意：上面的 "Runtime 调用完成" 日志已经在流式响应处理完成后记录
                # 这里不再重复记录

            except IncompleteRead as e:
                # ✅ 捕获 IncompleteRead，优雅降级
                logger.warning(
                    "⚠️ SSE 流提前结束（IncompleteRead）！已读取 %d 字节（期望更多），"
                    "总共接收了 %d 个事件，%d 总字节，%d chunk",
                    len(e.partial), event_count, bytes_read, chunk_count,
                )
                logger.warning(
                    "⚠️ 这可能不是错误，boto3 在某些情况下会误报 IncompleteRead。"
                    "已接收的 %d 个事件将正常返回给前端。",
                    event_count,
                )

                # 不抛出异常，发送结束标记（让前端收到已有的数据）
                asyncio.run_coroutine_threadsafe(event_queue.put(None), loop)

                logger.info("Runtime 调用完成（IncompleteRead 已处理）")

            except Exception as e:
                logger.error(
                    "❌ [线程] Runtime 调用失败: %s（event_count=%d, bytes_read=%d, chunk_count=%d）",
                    e, event_count, bytes_read, chunk_count,
                    exc_info=True,
                )
                # 发送异常
                asyncio.run_coroutine_threadsafe(event_queue.put(e), loop)
            except BaseException as e:
                # 捕获所有异常，包括 KeyboardInterrupt 和 SystemExit
                logger.error(
                    "❌ [线程] 线程函数发生未捕获的异常: %s（event_count=%d, bytes_read=%d, chunk_count=%d）",
                    e, event_count, bytes_read, chunk_count,
                    exc_info=True,
                )
                # 发送异常
                asyncio.run_coroutine_threadsafe(event_queue.put(e), loop)
            finally:
                logger.info("[] event_count=%s, bytes_read=%s, chunk_count=%s", event_count, bytes_read, chunk_count)

        # 启动线程
        thread = threading.Thread(target=_invoke_in_thread, daemon=True)
        thread.start()
        logger.debug("🚀 [invoke_streaming] 后台线程已启动")

        # 异步消费队列
        queue_start_time = time.time()
        first_event_time = None
        event_count = 0
        logger.debug(
            f"⏳ [invoke_streaming] 开始等待事件（队列启动时间: {queue_start_time:.3f}）",
            extra={
                "queue_start_time": queue_start_time,
            }
        )
        while True:
            wait_start = time.time()
            logger.debug(
                f"⏳ [invoke_streaming] 等待事件（已等待 {wait_start - queue_start_time:.2f} 秒，事件数: {event_count}）",
                extra={
                    "queue_wait_duration": f"{wait_start - queue_start_time:.2f}秒",
                    "event_count": event_count,
                }
            )
            event = await event_queue.get()
            wait_duration = time.time() - wait_start
            logger.debug(
                f"📥 [invoke_streaming] 从队列获取到事件（等待了 {wait_duration:.3f} 秒）",
                extra={
                    "wait_duration": f"{wait_duration:.3f}秒",
                    "event_type": type(event).__name__ if event is not None else "None",
                    "is_exception": isinstance(event, Exception),
                    "event_count": event_count,
                }
            )

            if first_event_time is None:
                first_event_time = time.time()
                queue_wait_duration = first_event_time - queue_start_time
                logger.info(
                    f"📥 [invoke_streaming] 收到第一个事件（等待了 {queue_wait_duration:.2f} 秒）",
                    extra={
                        "queue_wait_duration": f"{queue_wait_duration:.2f}秒",
                        "event_type": type(event).__name__ if event is not None else "None",
                        "is_exception": isinstance(event, Exception),
                    }
                )

            if event is None:
                # 结束
                total_duration = time.time() - queue_start_time
                logger.info(
                    f"🛑 [invoke_streaming] 流式输出结束（总耗时: {total_duration:.2f}秒，事件数: {event_count}）",
                    extra={
                        "total_duration": f"{total_duration:.2f}秒",
                        "event_count": event_count,
                    }
                )
                break

            if isinstance(event, Exception):
                # 抛出异常
                total_duration = time.time() - queue_start_time
                logger.error(
                    f"❌ [invoke_streaming] 收到异常: {event}（总耗时: {total_duration:.2f}秒，事件数: {event_count}）",
                    extra={
                        "error": str(event),
                        "error_type": type(event).__name__,
                        "total_duration": f"{total_duration:.2f}秒",
                        "event_count": event_count,
                    }
                )
                raise event

            event_count += 1
            yield event
