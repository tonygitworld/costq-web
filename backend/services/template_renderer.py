"""模板渲染服务

负责将模板中的变量（{{变量名}}）替换为实际值
"""

import re
from typing import Any


def render_template(prompt_text: str, variables: dict[str, Any]) -> str:
    """渲染模板，将 {{变量名}} 替换为实际值

    Args:
        prompt_text: 模板文本，如 "查看最近 {{days}} 天的 {{service}} 成本"
        variables: 变量值映射，如 {"days": 7, "service": "EC2"}

    Returns:
        渲染后的文本，如 "查看最近 7 天的 EC2 成本"

    Raises:
        ValueError: 如果缺少必需的变量

    Examples:
        >>> render_template("查看 {{days}} 天的成本", {"days": 7})
        '查看 7 天的成本'

        >>> render_template("分析 {{service}} 和 {{metric}}", {"service": "EC2", "metric": "CPU"})
        '分析 EC2 和 CPU'
    """
    # 提取所有变量名（使用正则表达式）
    pattern = r"\{\{(\w+)\}\}"
    required_vars: set[str] = set(re.findall(pattern, prompt_text))

    # 检查缺失的变量
    provided_vars = set(variables.keys())
    missing_vars = required_vars - provided_vars

    if missing_vars:
        missing_list = ", ".join(sorted(missing_vars))
        raise ValueError(
            f"缺少必需的变量: {missing_list}。"
            f"模板需要: {', '.join(sorted(required_vars))}，"
            f"提供了: {', '.join(sorted(provided_vars)) if provided_vars else '无'}"
        )

    # 替换变量
    rendered = prompt_text
    for var_name, var_value in variables.items():
        placeholder = f"{{{{{var_name}}}}}"
        # 转换为字符串（处理数字、布尔值等）
        str_value = str(var_value)
        rendered = rendered.replace(placeholder, str_value)

    return rendered


def extract_variables(prompt_text: str) -> set[str]:
    """从模板文本中提取所有变量名

    Args:
        prompt_text: 模板文本

    Returns:
        变量名集合

    Examples:
        >>> extract_variables("查看 {{days}} 天的 {{service}} 成本")
        {'days', 'service'}
    """
    pattern = r"\{\{(\w+)\}\}"
    return set(re.findall(pattern, prompt_text))


def validate_template(prompt_text: str) -> bool:
    """验证模板语法是否正确

    检查：
    1. 变量格式是否正确（{{变量名}}）
    2. 是否有未闭合的大括号

    Args:
        prompt_text: 模板文本

    Returns:
        True 如果语法正确

    Raises:
        ValueError: 如果语法错误

    Examples:
        >>> validate_template("查看 {{days}} 天的成本")
        True

        >>> validate_template("查看 {{days 天的成本")
        Traceback (most recent call last):
        ValueError: 模板语法错误：未闭合的大括号
    """
    # 检查未闭合的大括号
    open_count = prompt_text.count("{{")
    close_count = prompt_text.count("}}")

    if open_count != close_count:
        raise ValueError(
            f"模板语法错误：未闭合的大括号（找到 {open_count} 个开括号，{close_count} 个闭括号）"
        )

    # 检查变量名格式（只能包含字母、数字、下划线）
    pattern = r"\{\{(\w+)\}\}"
    invalid_pattern = r"\{\{([^}]*)\}\}"

    all_placeholders = re.findall(invalid_pattern, prompt_text)
    valid_placeholders = re.findall(pattern, prompt_text)

    if len(all_placeholders) != len(valid_placeholders):
        invalid = set(all_placeholders) - set(valid_placeholders)
        raise ValueError(
            f"模板语法错误：变量名只能包含字母、数字、下划线。无效的变量: {', '.join(invalid)}"
        )

    return True


# ========== 测试用例（仅开发时运行）==========


def _run_tests():
    """运行单元测试"""
    print("🧪 开始测试模板渲染服务...")

    # 测试 1: 基本替换
    template1 = "查看最近 {{days}} 天的 {{service}} 成本"
    variables1 = {"days": 7, "service": "EC2"}
    result1 = render_template(template1, variables1)
    expected1 = "查看最近 7 天的 EC2 成本"
    assert result1 == expected1, f"测试 1 失败：期望 '{expected1}'，实际 '{result1}'"
    print("✅ 测试 1 通过：基本变量替换")

    # 测试 2: 数字类型变量
    template2 = "Top {{count}} 消费项目"
    variables2 = {"count": 5}
    result2 = render_template(template2, variables2)
    expected2 = "Top 5 消费项目"
    assert result2 == expected2, f"测试 2 失败：期望 '{expected2}'，实际 '{result2}'"
    print("✅ 测试 2 通过：数字类型变量")

    # 测试 3: 多个相同变量
    template3 = "{{service}} 成本是 {{service}} 的主要支出"
    variables3 = {"service": "EC2"}
    result3 = render_template(template3, variables3)
    expected3 = "EC2 成本是 EC2 的主要支出"
    assert result3 == expected3, f"测试 3 失败：期望 '{expected3}'，实际 '{result3}'"
    print("✅ 测试 3 通过：多个相同变量")

    # 测试 4: 缺少变量（应该抛出异常）
    template4 = "查看 {{days}} 天的 {{service}} 成本"
    variables4 = {"days": 7}  # 缺少 service
    try:
        render_template(template4, variables4)
        assert False, "测试 4 失败：应该抛出 ValueError"
    except ValueError as e:
        assert "service" in str(e), f"测试 4 失败：错误消息应包含 'service'，实际: {e}"
        print("✅ 测试 4 通过：缺少变量时抛出异常")

    # 测试 5: 无变量模板
    template5 = "查看本月的 AWS 成本趋势"
    variables5 = {}
    result5 = render_template(template5, variables5)
    expected5 = "查看本月的 AWS 成本趋势"
    assert result5 == expected5, f"测试 5 失败：期望 '{expected5}'，实际 '{result5}'"
    print("✅ 测试 5 通过：无变量模板")

    # 测试 6: 提取变量
    template6 = "分析 {{service}} 的 {{metric}} 指标"
    extracted = extract_variables(template6)
    assert extracted == {"service", "metric"}, (
        f"测试 6 失败：期望 {{'service', 'metric'}}，实际 {extracted}"
    )
    print("✅ 测试 6 通过：提取变量")

    # 测试 7: 验证模板（正确）
    template7 = "查看 {{days}} 天的成本"
    assert validate_template(template7) == True
    print("✅ 测试 7 通过：验证正确的模板")

    # 测试 8: 验证模板（未闭合大括号）
    template8 = "查看 {{days 天的成本"
    try:
        validate_template(template8)
        assert False, "测试 8 失败：应该抛出 ValueError"
    except ValueError as e:
        assert "未闭合" in str(e)
        print("✅ 测试 8 通过：检测未闭合大括号")

    # 测试 9: 验证模板（无效变量名）
    template9 = "查看 {{days-count}} 天的成本"  # 变量名包含连字符
    try:
        validate_template(template9)
        assert False, "测试 9 失败：应该抛出 ValueError"
    except ValueError as e:
        assert "变量名只能包含" in str(e)
        print("✅ 测试 9 通过：检测无效变量名")

    print("\n🎉 所有测试通过！模板渲染服务工作正常。\n")


if __name__ == "__main__":
    # 仅在直接运行此文件时执行测试
    _run_tests()
