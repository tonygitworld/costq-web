"""模型管理 API

提供可用 AI 模型列表的查询接口。
"""

from fastapi import APIRouter, Depends

from ..config.model_config import AVAILABLE_MODELS
from ..utils.auth import get_current_user

router = APIRouter()


@router.get("/api/models")
async def get_available_models(
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    """返回可用模型列表

    Returns:
        list[dict]: 模型配置列表，每个模型包含：
            - model_id: Bedrock 模型 ID
            - name: i18n 翻译 key
            - description: i18n 翻译 key
            - is_default: 是否为默认模型
    """
    return [m.model_dump() for m in AVAILABLE_MODELS]
