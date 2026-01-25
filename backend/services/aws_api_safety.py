"""AWS API MCP 安全检查器

职责:
- 判断操作类型（读/写/删/创建）
- 确定是否需要用户确认
- 生成风险提示信息

安全策略:
- 只读操作（Describe*, List*, Get*）：默认允许，直接执行 ✅
- 修改操作（Update*, Modify*, Put*, Start*, Stop*）：需要用户确认 ⚠️
- 删除操作（Delete*, Terminate*, Remove*）：需要用户确认（高风险）🚨
- 创建操作（Create*, Launch*, Run*）：需要用户确认 ⚠️

确认超时: 5 分钟（300 秒）
"""

import logging

logger = logging.getLogger(__name__)


class AWSAPISafetyChecker:
    """AWS API 安全检查器"""

    # 只读操作关键词（默认允许）
    READ_KEYWORDS = [
        "describe",
        "list",
        "get",
        "show",
        "view",
        "read",
        "select",
        "query",
        "search",
        "lookup",
        "fetch",
    ]

    # 修改操作关键词（需要确认）
    MODIFY_KEYWORDS = [
        "update",
        "modify",
        "put",
        "patch",
        "start",
        "stop",
        "reboot",
        "restart",
        "enable",
        "disable",
        "attach",
        "detach",
        "associate",
        "disassociate",
        "register",
        "deregister",
        "tag",
        "untag",
    ]

    # 删除操作关键词（需要确认，高风险）
    DELETE_KEYWORDS = ["delete", "remove", "terminate", "destroy", "drop", "purge", "revoke"]

    # 创建操作关键词（需要确认）
    CREATE_KEYWORDS = ["create", "launch", "run", "invoke", "build", "deploy", "provision"]

    def classify_operation(self, tool_name: str) -> str:
        """分类操作类型

        Args:
            tool_name: 工具名称（如 "aws_ec2_describe_instances"）

        Returns:
            操作类型: "read" | "modify" | "delete" | "create"
        """
        tool_lower = tool_name.lower()

        # 1. 检查删除操作（优先级最高）
        for keyword in self.DELETE_KEYWORDS:
            if keyword in tool_lower:
                logger.debug(": %s (: %s)", tool_name, keyword)
                return "delete"

        # 2. 检查创建操作
        for keyword in self.CREATE_KEYWORDS:
            if keyword in tool_lower:
                # 排除 describe-create-* 这类只读操作
                if not any(read_kw in tool_lower for read_kw in self.READ_KEYWORDS):
                    logger.debug(": %s (: %s)", tool_name, keyword)
                    return "create"

        # 3. 检查修改操作
        for keyword in self.MODIFY_KEYWORDS:
            if keyword in tool_lower:
                logger.debug(": %s (: %s)", tool_name, keyword)
                return "modify"

        # 4. 默认为只读
        logger.debug(": %s", tool_name)
        return "read"

    def requires_confirmation(self, tool_name: str, arguments: dict) -> bool:
        """判断是否需要用户确认

        Args:
            tool_name: 工具名称
            arguments: 工具参数

        Returns:
            是否需要确认
        """
        operation_type = self.classify_operation(tool_name)

        # 只读操作不需要确认
        if operation_type == "read":
            return False

        # 其他操作都需要确认
        logger.info("- Tool: %s, Type: %s", tool_name, operation_type)
        return True

    def get_risk_level(self, tool_name: str, arguments: dict) -> str:
        """获取操作风险等级

        Args:
            tool_name: 工具名称
            arguments: 工具参数

        Returns:
            风险等级: "low" | "medium" | "high"
        """
        operation_type = self.classify_operation(tool_name)

        # 删除操作 = 高风险
        if operation_type == "delete":
            return "high"

        # 修改/创建操作 = 中风险
        if operation_type in ["modify", "create"]:
            return "medium"

        # 只读操作 = 低风险
        return "low"

    def get_confirmation_message(self, tool_name: str, arguments: dict) -> tuple[str, str, str]:
        """生成确认消息

        Args:
            tool_name: 工具名称
            arguments: 工具参数

        Returns:
            (标题, 描述, 风险提示)
        """
        operation_type = self.classify_operation(tool_name)

        # 根据操作类型生成消息
        if operation_type == "delete":
            title = "🚨 删除操作确认"
            description = f"您即将执行删除操作: {tool_name}"
            warning = "此操作可能无法撤销，请仔细确认参数！"

        elif operation_type == "create":
            title = "⚡ 创建资源确认"
            description = f"您即将创建新资源: {tool_name}"
            warning = "新资源可能产生费用，请确认配置正确。"

        elif operation_type == "modify":
            title = "⚠️ 修改操作确认"
            description = f"您即将修改资源配置: {tool_name}"
            warning = "修改可能影响现有服务，请谨慎操作。"

        else:
            title = "ℹ️ 操作确认"
            description = f"您即将执行: {tool_name}"
            warning = "请确认操作参数正确。"

        return (title, description, warning)

    def format_arguments_for_display(self, arguments: dict) -> str:
        """格式化参数用于显示

        Args:
            arguments: 工具参数

        Returns:
            格式化的参数字符串
        """
        import json

        try:
            return json.dumps(arguments, indent=2, ensure_ascii=False)
        except Exception:
            return str(arguments)


# 全局单例
_safety_checker = None


def get_safety_checker() -> AWSAPISafetyChecker:
    """获取安全检查器单例"""
    global _safety_checker
    if _safety_checker is None:
        _safety_checker = AWSAPISafetyChecker()
        logger.info("✅ AWS API 安全检查器已初始化")
    return _safety_checker
