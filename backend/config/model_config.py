"""AI 模型配置

集中管理可用的 AI 模型列表。
新增模型时需同步更新前端 i18n 翻译文件。
"""

from pydantic import BaseModel


class ModelConfig(BaseModel):
    """AI 模型配置"""

    model_id: str  # Bedrock 模型 ID
    name: str  # i18n 翻译 key
    description: str  # i18n 翻译 key
    is_default: bool = False


# 可用模型列表（集中配置）
AVAILABLE_MODELS: list[ModelConfig] = [
    ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        name="sonnet45",
        description="sonnet45",
        is_default=True,
    ),
    ModelConfig(
        model_id="global.anthropic.claude-sonnet-4-20250514-v1:0",
        name="sonnet4",
        description="sonnet4",
    ),
    ModelConfig(
        model_id="global.anthropic.claude-3-5-sonnet-20241022-v2:0",
        name="sonnet35v2",
        description="sonnet35v2",
    ),
    ModelConfig(
        model_id="global.anthropic.claude-3-5-haiku-20241022-v1:0",
        name="haiku35",
        description="haiku35",
    ),
]
