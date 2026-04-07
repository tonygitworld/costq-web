"""
AgentCore Runtime 响应解析器

将 Runtime 的 SSE 格式转换为前端 WebSocket 格式

SSE 格式示例:
    data: {"start": true}
    data: {"event": {"contentBlockDelta": {"delta": {"text": "Hello"}}}}
    data: {"event": {"messageStop": {"stopReason": "end_turn"}}}

WebSocket 格式示例:
    {"type": "thinking", "content": "正在思考...", "timestamp": 1234567890.123}
    {"type": "chunk", "content": "Hello", "timestamp": 1234567890.123}
    {"type": "complete", "timestamp": 1234567890.123}
"""

import ast
import json
import re
import time
from typing import Any

import logging

logger = logging.getLogger(__name__)



class AgentCoreResponseParser:
    """AgentCore Runtime 响应解析器"""

    def __init__(self, session_id: str | None = None):
        """
        初始化解析器

        Args:
            session_id: 会话ID（用于在消息中标识归属）
        """
        self.buffer = ""
        self.session_id = session_id  # ✅ 新增：会话ID
        self.tool_id_map = {}  # 工具ID映射（工具名 -> tool_id）
        self.sent_tool_ids = set()  # ✅ 已发送的工具调用ID集合（去重）
        self.pending_tool_calls = {}  # ✅ 待处理的工具调用（tool_id -> {name, args_buffer, content_block_index}）
        self._session_id_warned = False  # 避免重复打印 session_id 缺失日志

    def _add_session_id(self, message: dict[str, Any]) -> dict[str, Any]:
        """
        为消息添加 session_id（如果已配置）

        Args:
            message: 原始消息字典

        Returns:
            Dict: 添加了 session_id 的消息
        """
        if self.session_id:
            message["session_id"] = self.session_id
        elif not self._session_id_warned:
            logger.debug("[Parser] 未配置 session_id（告警场景正常）")
            self._session_id_warned = True
        return message

    def parse_event(self, event: bytes | dict) -> list[dict[str, Any]]:
        """
        解析单个 SSE 事件为 WebSocket 消息列表

        Args:
            event: SSE 事件数据，支持两种格式：
                   - bytes: b'data: {...}' (原始 SSE 格式)
                   - dict: 已解析的字典

        Returns:
            List[Dict]: WebSocket 消息列表
        """
        messages = []

        # ✅ 添加原始事件日志（仅在开发环境）
        import os

        if os.getenv("ENVIRONMENT") == "local":
            if isinstance(event, dict):
                logger.debug("🔍 [Parser] 收到字典事件，键: %s", list(event.keys()))
            elif isinstance(event, bytes):
                logger.debug("🔍 [Parser] 收到bytes事件，长度: %s", len(event))

        try:
            # 如果已经是字典，直接转换
            if isinstance(event, dict):
                messages.extend(self._convert_to_websocket_messages(event))
                # ✅ 为所有消息添加 session_id
                return [self._add_session_id(msg) for msg in messages]

            # 如果是字符串，直接使用
            if isinstance(event, str):
                event_str = event.strip()
            # 如果是 bytes，解码
            elif isinstance(event, bytes):
                event_str = event.decode("utf-8", errors="ignore").strip()
            else:
                logger.warning("未知事件类型: %s, 跳过", type(event))
                return messages

            if not event_str:
                return messages

            # 解析 SSE 格式
            if event_str.startswith("data: "):
                data_str = event_str[6:]  # 移除 'data: ' 前缀

                # 尝试解析数据
                data = self._parse_data_string(data_str)

                if data:
                    # 转换为 WebSocket 消息
                    messages.extend(self._convert_to_websocket_messages(data))
            else:
                logger.debug("忽略非 SSE 格式事件: %s", event_str[:100])

        except Exception as e:
            logger.error("事件解析失败: %s", e, exc_info=False)

        # ✅ 为所有消息添加 session_id
        return [self._add_session_id(msg) for msg in messages]

    def _parse_data_string(self, data_str: str) -> dict[str, Any] | None:
        """
        解析数据字符串（支持 JSON 和 Python 字典字符串）

        Args:
            data_str: 数据字符串

        Returns:
            解析后的字典，失败返回 None
        """
        # 方法1: 尝试 JSON 解析（标准格式）
        try:
            return json.loads(data_str)
        except json.JSONDecodeError:
            pass

        # 方法2: 尝试解析 Python 字典字符串（Runtime 返回格式）
        try:
            # 移除 Python 对象引用（如 <strands.agent.agent.Agent object at 0x...>）
            cleaned = re.sub(r"<[^>]+>", "{}", data_str)

            # 使用 ast.literal_eval 安全解析 Python 字典
            return ast.literal_eval(cleaned)
        except (ValueError, SyntaxError):
            pass

        logger.debug("无法解析数据: %s", data_str[:100])
        return None

    def _convert_to_websocket_messages(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        """
        将 Runtime 事件转换为 WebSocket 消息

        支持两种格式:
        1. 标准 Bedrock 格式: {"event": {"contentBlockDelta": {...}}}
        2. Runtime 内部格式: {"delta": {"text": "..."}, "data": "..."}
        3. 错误格式: {"error": "..."}

        Args:
            data: Runtime 事件数据

        Returns:
            List[Dict]: WebSocket 消息列表
        """
        messages = []
        timestamp = time.time()

        # 类型检查：确保 data 是字典
        if not isinstance(data, dict):
            # 如果不是字典，直接返回空列表
            return messages

        # 处理错误消息
        if "error" in data:
            error_msg = data["error"]
            logger.error("Runtime : %s", error_msg)
            error_message = {
                "type": "error",
                "content": f"Runtime 错误: {error_msg}",
                "timestamp": timestamp,
            }
            # ✅ 为错误消息添加 session_id
            messages.append(self._add_session_id(error_message))
            return messages

        # ⭐ 处理 Token 统计事件（Runtime 流式结束后发送）
        if data.get("type") == "token_usage":
            usage = data.get("usage", {})
            messages.append(
                {
                    "type": "token_usage",
                    "usage": {  # ⭐ 前端期望 "usage" 字段，不是 "token_usage"
                        "input_tokens": usage.get("input_tokens", 0),
                        "output_tokens": usage.get("output_tokens", 0),
                        "cache_read_tokens": usage.get("cache_read_tokens", 0),
                        "cache_write_tokens": usage.get("cache_write_tokens", 0),
                        "input_cache_hit_rate": usage.get("input_cache_hit_rate", 0.0),
                        "output_cache_hit_rate": usage.get("output_cache_hit_rate", 0.0),
                    },
                    "timestamp": data.get("timestamp", timestamp),
                }
            )
            logger.info(
                "Token 统计事件已解析",
                extra={
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "cache_read_tokens": usage.get("cache_read_tokens", 0),
                    "cache_write_tokens": usage.get("cache_write_tokens", 0),
                    "input_cache_hit_rate": usage.get("input_cache_hit_rate", 0.0),
                }
            )
            return messages

        # ==================== Runtime 内部格式处理 ====================
        # 格式: {'delta': {'text': '...'}, 'data': '...', 'type': '...'}
        #
        # ❌ 移除早期返回逻辑，避免跳过后续的 <invoke> 标签处理
        # 原因：Runtime 返回的事件可能同时包含 delta 和 event 字段
        # 如果在这里早期返回，会导致工具调用标签被当做普通文本发送
        #
        # if "delta" in data and isinstance(data["delta"], dict):
        #     delta = data["delta"]
        #     if "text" in delta:
        #         return messages  # ❌ 会跳过工具调用解析

        # ==================== 标准 Bedrock 格式处理 ====================

        # 3. 初始化事件 → thinking
        # TODO: 后续扩展 - 替换为智能生成的思考步骤
        # 当前版本：固定文案"正在思考..."
        # Phase 1 改进：预生成结构化思考步骤（参考 Main 分支 StreamingAgentWrapper）
        # 参考文档: docs/thinking_process_2025_best_practices.md

        # 暂时注释掉，前端已隐藏思考过程显示
        # if "start" in data or "init_event_loop" in data or "start_event_loop" in data:
        #     messages.append({"type": "thinking", "content": "正在思考...", "timestamp": timestamp})

        # 2. 处理 event 字段
        if "event" in data:
            event_data = data["event"]

            # ✅ 记录接收到的事件类型
            event_types = list(event_data.keys())
            if event_types:
                logger.debug("[Parser] event: %s", event_types)

            # 2.1 消息开始
            if "messageStart" in event_data:
                messages.append(
                    {
                        "type": "message_start",
                        "role": event_data["messageStart"].get("role", "assistant"),
                        "timestamp": timestamp,
                    }
                )

            # 2.2 文本增量 → chunk
            if "contentBlockDelta" in event_data:
                delta = event_data["contentBlockDelta"].get("delta", {})
                content_block_index = event_data["contentBlockDelta"].get("contentBlockIndex")

                # ✅ NEW: 处理工具参数增量（toolUse.input）
                if "toolUse" in delta:
                    tool_delta = delta["toolUse"]
                    input_str = tool_delta.get("input", "")

                    # 根据 contentBlockIndex 找到对应的待处理工具调用
                    matching_tool_id = None
                    for tool_id, tool_info in self.pending_tool_calls.items():
                        if tool_info.get("content_block_index") == content_block_index:
                            matching_tool_id = tool_id
                            break

                    if matching_tool_id:
                        # 累积参数字符串
                        self.pending_tool_calls[matching_tool_id]["args_buffer"] += input_str
                        logger.debug(
                            f"🔍 [Parser] 累积工具参数 - tool_id: {matching_tool_id}, "
                            f"新增: {len(input_str)} 字符, "
                            f"总计: {len(self.pending_tool_calls[matching_tool_id]['args_buffer'])} 字符"
                        )

                if "text" in delta:
                    text = delta["text"]
                    self.buffer += text

                    # ✅ 详细日志：检查buffer中是否包含invoke标签
                    if "<invoke" in self.buffer:
                        logger.info(
                            f"🔍 [Parser] Buffer包含<invoke>标签，buffer长度: {len(self.buffer)}, 预览: {self.buffer[:200]}"
                        )

                    # ✅ 首先处理并移除 <function_calls> 和 </function_calls> 标签
                    self.buffer = re.sub(r"<function_calls>\s*", "", self.buffer)
                    self.buffer = re.sub(r"\s*</function_calls>", "", self.buffer)

                    # ✅ 处理 <result> 标签（AgentCore Runtime 使用 <result> 而不是 <function_result>）
                    func_result_match = re.search(r"<result>(.*?)</result>", self.buffer, re.DOTALL)
                    if func_result_match:
                        result_json = func_result_match.group(1).strip()
                        try:
                            result = json.loads(result_json)

                            # 关联到最近的工具调用
                            tool_id = None
                            if hasattr(self, "tool_id_map") and self.tool_id_map:
                                tool_name = list(self.tool_id_map.keys())[-1]
                                tool_id = self.tool_id_map[tool_name]

                            if tool_id:
                                messages.append(
                                    {
                                        "type": "tool_call_result",
                                        "tool_use_id": tool_id,
                                        "result": result,
                                        "status": "success",
                                        "timestamp": timestamp,
                                    }
                                )
                                logger.info(
                                    f"✅ 解析到工具结果 - tool_id: {tool_id}, 结果长度: {len(result_json)}"
                                )

                        except Exception as e:
                            logger.error("解析失败: %s, 内容: %s", e, result_json[:200])

                        # ✅ 从buffer中移除整个 <result> 块
                        self.buffer = self.buffer.replace(func_result_match.group(0), "")

                    # 处理 <invoke> 标签
                    while True:
                        # 查找完整的 <invoke>...</invoke> 块
                        match = re.search(
                            r'(.*?)<invoke name="(.*?)">(.*?)</invoke>(.*)', self.buffer, re.DOTALL
                        )
                        if match:
                            pre_text = match.group(1)
                            tool_name = match.group(2)
                            params_xml = match.group(3)
                            post_text = match.group(4)

                            # 发送 <invoke> 之前的文本
                            if pre_text:
                                messages.append(
                                    {"type": "chunk", "content": pre_text, "timestamp": timestamp}
                                )

                            # 解析参数
                            args = {}
                            param_matches = re.finditer(
                                r'<parameter name="(.*?)">(.*?)</parameter>', params_xml, re.DOTALL
                            )
                            param_count = 0
                            for pm in param_matches:
                                param_count += 1
                                p_name = pm.group(1)
                                p_value = pm.group(2)
                                try:
                                    args[p_name] = json.loads(p_value)
                                except (json.JSONDecodeError, ValueError):
                                    args[p_name] = p_value

                            # ✅ 详细日志：记录参数解析结果
                            logger.info(
                                f"🔍 [Parser] <invoke>标签解析 - tool: {tool_name}, 参数数量: {param_count}, args: {args}"
                            )

                            # ✅ 生成唯一工具ID（基于工具名+参数hash）
                            import hashlib

                            args_str = json.dumps(args, sort_keys=True)
                            args_hash = hashlib.md5(args_str.encode()).hexdigest()[:8]
                            tool_id = f"tool_{tool_name}_{args_hash}_{int(timestamp * 1000)}"

                            # ✅ 去重检查：如果已发送过，跳过
                            if tool_id in self.sent_tool_ids:
                                logger.warning(
                                    f"⚠️  检测到重复工具调用，已忽略 - tool_id: {tool_id}"
                                )
                                # 更新缓冲区为剩余文本，继续循环
                                self.buffer = post_text
                                continue

                            # ✅ 记录已发送的工具ID
                            self.sent_tool_ids.add(tool_id)

                            # 存储 tool_id 映射，以便后续关联结果
                            self.tool_id_map[tool_name] = tool_id

                            messages.append(
                                {
                                    "type": "tool_call_start",
                                    "tool_id": tool_id,
                                    "tool_name": tool_name,
                                    "args": args,
                                    "timestamp": timestamp,
                                }
                            )

                            # ✅ 添加详细日志
                            logger.info(
                                f"📤 [Parser] 生成 tool_call_start 事件 - "
                                f"tool_id: {tool_id}, tool_name: {tool_name}, "
                                f"args: {args}"
                            )

                            # TODO: 后续扩展 - 发送更智能的思考步骤
                            # 当前版本：固定文案"正在调用工具: xxx"
                            # Phase 1 改进：显示工具参数和预期用途
                            # Phase 2 改进：集成四阶段架构（理解、收集、分析、生成）
                            # 参考文档: docs/thinking_process_2025_best_practices.md

                            # 暂时注释掉，前端已隐藏思考过程显示
                            # messages.append(
                            #     {
                            #         "type": "thinking_step",
                            #         "content": f"正在调用工具: {tool_name}",
                            #         "timestamp": timestamp,
                            #     }
                            # )

                            # ✅ 更新缓冲区为剩余文本
                            self.buffer = post_text

                            # ✅ 处理 AgentCore Runtime 的格式错误：解析 </invoke> 后的额外 <parameter> 标签
                            # 这些参数应该在 </invoke> 之前，但由于格式错误，它们出现在后面
                            # 我们需要解析它们并合并到 args 中，然后从buffer中移除
                            extra_params_found = False
                            while True:
                                orphan_param_match = re.search(
                                    r'<parameter name="(.*?)">(.*?)</parameter>',
                                    self.buffer,
                                    re.DOTALL,
                                )
                                if orphan_param_match:
                                    param_name = orphan_param_match.group(1)
                                    param_value = orphan_param_match.group(2)

                                    # 将额外的参数添加到 args 中
                                    try:
                                        args[param_name] = json.loads(param_value)
                                    except (json.JSONDecodeError, ValueError):
                                        args[param_name] = param_value

                                    logger.warning("</invoke> : %s", param_name)
                                    extra_params_found = True

                                    # 从buffer中移除这个参数标签
                                    self.buffer = self.buffer.replace(
                                        orphan_param_match.group(0), ""
                                    )
                                else:
                                    break

                            # 如果发现了额外的参数，需要更新之前发送的 tool_call_start 事件
                            if extra_params_found:
                                # 重新发送包含完整参数的工具调用信息
                                messages.append(
                                    {
                                        "type": "tool_call_start",
                                        "tool_id": tool_id,
                                        "tool_name": tool_name,
                                        "args": args,  # 现在包含了所有参数
                                        "timestamp": timestamp,
                                        "update": True,  # 标记这是一个更新，前端应该合并参数
                                    }
                                )
                                logger.info("✅ 更新工具调用参数 - 包含了 </invoke> 后的额外参数")

                            # ✅ 移除多余的 </invoke> 标签
                            self.buffer = re.sub(r"</invoke>\s*", "", self.buffer)

                            # ✅ 关键修复：如果剩余文本不包含更多 <invoke> 标签，立即发送
                            # 这样可以确保 </invoke> 后的实际结果文本被及时发送
                            if self.buffer and "<invoke" not in self.buffer:
                                logger.info(
                                    f"✅ 发送 </invoke> 后的文本 - 长度: {len(self.buffer)}, 预览: {self.buffer[:100]}"
                                )
                                messages.append(
                                    {
                                        "type": "chunk",
                                        "content": self.buffer,
                                        "timestamp": timestamp,
                                    }
                                )
                                self.buffer = ""
                                break
                            # 否则继续循环查找下一个 <invoke> 块
                        else:
                            # 没有找到完整的 invoke 块
                            # 检查是否有部分 invoke 标签
                            if "<invoke" in self.buffer:
                                # 如果 <invoke 不是在开头，发送前面的文本
                                split_idx = self.buffer.find("<invoke")
                                if split_idx > 0:
                                    to_emit = self.buffer[:split_idx]
                                    messages.append(
                                        {
                                            "type": "chunk",
                                            "content": to_emit,
                                            "timestamp": timestamp,
                                        }
                                    )
                                    self.buffer = self.buffer[split_idx:]
                                # 剩余部分保留在缓冲区等待后续数据
                                break
                            else:
                                # 没有 invoke 标签，发送所有缓冲区内容
                                if self.buffer:
                                    messages.append(
                                        {
                                            "type": "chunk",
                                            "content": self.buffer,
                                            "timestamp": timestamp,
                                        }
                                    )
                                    self.buffer = ""
                                break

            # 2.3 工具调用开始 → 记录待处理工具（参数将在 contentBlockDelta 中传递）
            if "contentBlockStart" in event_data:
                start = event_data["contentBlockStart"].get("start", {})
                content_block_index = event_data["contentBlockStart"].get("contentBlockIndex")
                logger.info("🔍 [Parser] contentBlockStart.start键: %s", list(start.keys()))

                if "toolUse" in start:
                    tool_use = start["toolUse"]
                    tool_id = tool_use.get("toolUseId")
                    tool_name = tool_use.get("name")

                    # ✅ 记录工具调用开始，但不发送事件（等待 contentBlockDelta 传递参数）
                    self.pending_tool_calls[tool_id] = {
                        "name": tool_name,
                        "args_buffer": "",  # 参数将在 contentBlockDelta 中累积
                        "content_block_index": content_block_index,
                    }

                    logger.info(
                        f"🔍 [Parser] 记录待处理工具调用 - "
                        f"tool_id: {tool_id}, tool_name: {tool_name}, "
                        f"content_block_index: {content_block_index}"
                    )

            # 2.4 内容块结束 → 发送完整的工具调用信息
            if "contentBlockStop" in event_data:
                content_block_index = event_data["contentBlockStop"].get("contentBlockIndex")

                # 查找对应的待处理工具调用
                matching_tool_id = None
                for tool_id, tool_info in self.pending_tool_calls.items():
                    if tool_info.get("content_block_index") == content_block_index:
                        matching_tool_id = tool_id
                        break

                if matching_tool_id:
                    tool_info = self.pending_tool_calls[matching_tool_id]
                    tool_name = tool_info["name"]
                    args_str = tool_info["args_buffer"]

                    # 解析完整的参数
                    try:
                        args = json.loads(args_str) if args_str else {}
                    except json.JSONDecodeError:
                        logger.error(": %s", args_str)
                        args = {}

                    # ✅ 去重检查：如果已发送过，跳过
                    if matching_tool_id not in self.sent_tool_ids:
                        # 发送完整的 tool_call_start 事件
                        messages.append(
                            {
                                "type": "tool_call_start",
                                "tool_id": matching_tool_id,
                                "tool_name": tool_name,
                                "description": f"调用工具: {tool_name}",
                                "args": args,
                                "timestamp": timestamp,
                            }
                        )

                        # 记录已发送
                        self.sent_tool_ids.add(matching_tool_id)

                        logger.info(
                            f"📤 [Parser] 生成 tool_call_start 事件 (contentBlockStop) - "
                            f"tool_id: {matching_tool_id}, tool_name: {tool_name}, "
                            f"args: {args}"
                        )

                    # 清理已处理的工具调用
                    del self.pending_tool_calls[matching_tool_id]

            # 2.5 消息结束 → complete
            if "messageStop" in event_data:
                stop_reason = event_data["messageStop"].get("stopReason")

                # 发送缓冲区剩余内容
                if self.buffer:
                    logger.info(
                        f"✅ messageStop: 发送buffer剩余内容 - 长度: {len(self.buffer)}, 预览: {self.buffer[:100]}"
                    )
                    messages.append(
                        {"type": "chunk", "content": self.buffer, "timestamp": timestamp}
                    )
                    self.buffer = ""
                else:
                    logger.info("ℹ️  messageStop: buffer已清空，无剩余内容")

                # ✅ 工具结果暂时不在这里处理
                # AgentCore 会在后续的 message 事件中包含 toolResult
                # 清空工具ID映射将在处理完所有 toolResult 后进行
                pass

                # ✅ 根据 stopReason 决定是否发送 complete
                # AgentCore stopReason 类型：
                # - "end_turn": 对话真正结束（应该发送 complete）
                # - "tool_use": 工具调用后继续（不应该发送 complete）
                # - "max_tokens": 超出 token 限制（应该发送 complete）
                # - "stop_sequence": 遇到停止序列（应该发送 complete）

                # ✅ 修复：不在这里发送 complete 事件，让外层的 agent_provider.py 统一发送
                # 这样可以确保 complete 事件包含完整的 token_usage 数据
                # if stop_reason in ["end_turn", "max_tokens", "stop_sequence"]:
                #     messages.append(
                #         {
                #             "type": "complete",
                #             "stop_reason": stop_reason,
                #             "timestamp": timestamp,
                #             "success": True,
                #         }
                #     )
                #     logger.info("complete - stopReason: %s", stop_reason)

                # ✅ 只记录日志，complete 事件由外层发送
                if stop_reason in ["end_turn", "max_tokens", "stop_sequence"]:
                    logger.info("messageStop - stopReason: %s (complete 事件将由外层发送)", stop_reason)
                elif stop_reason == "tool_use":
                    logger.info(
                        f"ℹ️  工具调用完成，等待 Agent 继续生成响应 - stopReason: {stop_reason}"
                    )
                else:
                    # 未知的 stopReason，保守处理，记录日志但不发送 complete
                    logger.warning(
                        f"⚠️  未知的 stopReason: {stop_reason}，不发送 complete 事件"
                    )

        # 3. 工具结果 → tool_result
        # AgentCore 在最终的 message 事件中包含 toolResult（role=assistant）
        if "message" in data:
            message = data["message"]
            role = message.get("role")

            # 处理 assistant 角色的消息（包含工具结果）
            if role == "assistant":
                for content in message.get("content", []):
                    # 处理 toolResult
                    if isinstance(content, dict) and "toolResult" in content:
                        tool_result = content["toolResult"]
                        tool_use_id = tool_result.get("toolUseId")

                        # 提取结果内容（可能是JSON字符串或对象）
                        result_content = tool_result.get("content", [])
                        result_data = {}

                        # 解析 content 数组
                        for item in result_content:
                            if isinstance(item, dict):
                                if "json" in item:
                                    # JSON 格式的结果
                                    try:
                                        result_data = (
                                            json.loads(item["json"])
                                            if isinstance(item["json"], str)
                                            else item["json"]
                                        )
                                    except Exception as e:
                                        logger.warning("JSON: %s, ", e)
                                        result_data = item["json"]
                                elif "text" in item:
                                    # 文本格式的结果
                                    result_data = {"text": item["text"]}

                        messages.append(
                            {
                                "type": "tool_call_result",
                                "tool_use_id": tool_use_id,
                                "result": result_data,
                                "status": tool_result.get("status", "success"),
                                "timestamp": timestamp,
                            }
                        )
                        logger.info(
                            f"✅ 从message事件中提取工具结果 - tool_id: {tool_use_id}, 结果: {str(result_data)[:200]}"
                        )

                        # 从 tool_id_map 中移除已处理的工具
                        if hasattr(self, "tool_id_map"):
                            for tool_name, tid in list(self.tool_id_map.items()):
                                if tid == tool_use_id:
                                    del self.tool_id_map[tool_name]
                                    logger.debug(": %s -> %s", tool_name, tool_use_id)
                                    break

            # ⭐ 处理 user 角色的消息（Strands Agent 将工具结果放在这里！）
            elif role == "user":
                for content in message.get("content", []):
                    if isinstance(content, dict) and "toolResult" in content:
                        tool_result = content["toolResult"]
                        tool_use_id = tool_result.get("toolUseId")

                        # 提取结果内容（与 assistant 分支相同的解析逻辑）
                        result_content = tool_result.get("content", [])
                        result_data = {}

                        # 解析 content 数组
                        for item in result_content:
                            if isinstance(item, dict):
                                if "json" in item:
                                    # JSON 格式的结果
                                    try:
                                        json_content = item["json"]
                                        result_data = (
                                            json.loads(json_content)
                                            if isinstance(json_content, str)
                                            else json_content
                                        )
                                    except Exception as e:
                                        logger.warning("JSON: %s, ", e)
                                        result_data = item["json"]
                                elif "text" in item:
                                    # 文本格式的结果
                                    result_data = {"text": item["text"]}

                        messages.append(
                            {
                                "type": "tool_call_result",
                                "tool_use_id": tool_use_id,
                                "result": result_data,
                                "status": tool_result.get("status", "success"),
                                "timestamp": timestamp,
                            }
                        )
                        logger.info(
                            f"✅ 从message(user)事件中提取工具结果 - tool_id: {tool_use_id}, 结果: {str(result_data)[:200]}"
                        )

                        # 从 tool_id_map 中移除已处理的工具
                        if hasattr(self, "tool_id_map"):
                            for tool_name, tid in list(self.tool_id_map.items()):
                                if tid == tool_use_id:
                                    del self.tool_id_map[tool_name]
                                    logger.debug(": %s -> %s", tool_name, tool_use_id)
                                    break

        return messages
