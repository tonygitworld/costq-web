"""Prompt Template 数据模型

提示词模板功能的 Pydantic 数据模型定义
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, validator

# ========== 变量定义 ==========


class PromptTemplateVariable(BaseModel):
    """模板变量定义

    用于定义模板中的动态参数，支持多种类型的输入
    """

    name: str = Field(..., description="变量名称（不含 {{}}）", min_length=1, max_length=50)
    label: str = Field(
        ..., description="显示标签（用户看到的字段名）", min_length=1, max_length=100
    )
    type: Literal["text", "number", "select", "date"] = Field(..., description="变量类型")
    options: list[str] | None = Field(None, description="下拉选项（type=select 时必填）")
    default: str | int | None = Field(None, description="默认值")
    required: bool = Field(True, description="是否必填")
    placeholder: str | None = Field(None, description="占位符文本")

    @validator("options")
    def validate_options(cls, v, values):
        """验证：type=select 时必须提供 options"""
        if values.get("type") == "select" and not v:
            raise ValueError("type='select' 时必须提供 options 列表")
        return v

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "name": "days",
                    "label": "天数",
                    "type": "number",
                    "default": 7,
                    "required": True,
                    "placeholder": "请输入天数",
                },
                {
                    "name": "service",
                    "label": "AWS 服务",
                    "type": "select",
                    "options": ["EC2", "S3", "RDS", "Lambda"],
                    "required": True,
                },
            ]
        }


# ========== 系统预设模板 ==========


class PromptTemplate(BaseModel):
    """系统预设模板（完整数据）

    从数据库读取的完整模板对象
    """

    id: str
    title: str
    description: str | None = None
    prompt_text: str
    category: Literal["cost", "security", "inventory", "onboarding", "custom"]
    icon: str | None = None
    cloud_provider: Literal["aws", "gcp", "both"] | None = None
    variables: list[PromptTemplateVariable] | None = None
    usage_count: int = 0
    is_active: bool = True
    display_order: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # 支持从 SQLAlchemy 对象转换
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "查看本月成本趋势",
                "description": "显示当前月份的 AWS 成本趋势图表",
                "prompt_text": "帮我查看本月的 AWS 成本趋势，包括每日支出明细和环比变化",
                "category": "cost",
                "icon": "LineChartOutlined",
                "cloud_provider": "aws",
                "variables": None,
                "usage_count": 256,
                "is_active": True,
                "display_order": 1,
                "created_at": "2025-10-15T10:00:00Z",
                "updated_at": "2025-10-15T10:00:00Z",
            }
        }


class PromptTemplateCreate(BaseModel):
    """创建系统模板请求（仅管理员）

    普通用户不能创建系统模板，仅通过数据库迁移脚本创建
    """

    title: str = Field(..., min_length=1, max_length=100, description="模板标题")
    description: str | None = Field(None, description="详细描述")
    prompt_text: str = Field(..., min_length=1, description="模板内容（支持 {{变量}} 语法）")
    category: Literal["cost", "security", "inventory", "onboarding", "custom"]
    icon: str | None = Field(None, description="Ant Design 图标名称")
    cloud_provider: Literal["aws", "gcp", "both"] | None = None
    variables: list[PromptTemplateVariable] | None = None
    display_order: int = Field(0, ge=0, description="显示顺序（数字越小越靠前）")


# ========== 用户自定义模板 ==========


class UserPromptTemplate(BaseModel):
    """用户自定义模板（完整数据）

    用户可以创建、编辑、删除自己的模板
    """

    id: str
    user_id: str
    title: str
    description: str | None = None
    prompt_text: str
    category: str = "custom"
    variables: list[PromptTemplateVariable] | None = None
    is_favorite: bool = False
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "user_id": "770e8400-e29b-41d4-a716-446655440002",
                "title": "我的每日成本报告",
                "description": "自定义的每日成本分析报告",
                "prompt_text": "查看最近 {{days}} 天的 {{service}} 成本，重点关注 {{region}} 区域",
                "category": "custom",
                "variables": [
                    {"name": "days", "label": "天数", "type": "number", "default": 7},
                    {
                        "name": "service",
                        "label": "服务",
                        "type": "select",
                        "options": ["EC2", "S3"],
                    },
                    {"name": "region", "label": "区域", "type": "text", "default": "us-east-1"},
                ],
                "is_favorite": True,
                "usage_count": 45,
                "created_at": "2025-10-10T10:00:00Z",
                "updated_at": "2025-10-15T10:00:00Z",
            }
        }


class UserPromptTemplateCreate(BaseModel):
    """创建用户模板请求"""

    title: str = Field(..., min_length=1, max_length=100, description="模板标题")
    description: str | None = Field(None, max_length=500, description="描述")
    prompt_text: str = Field(..., min_length=1, max_length=5000, description="模板内容")
    category: str = Field("custom", description="分类")
    variables: list[PromptTemplateVariable] | None = Field(None, description="变量定义")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "我的成本报告",
                "description": "每日成本分析",
                "prompt_text": "查看最近 {{days}} 天的成本",
                "category": "custom",
                "variables": [{"name": "days", "label": "天数", "type": "number", "default": 7}],
            }
        }


class UserPromptTemplateUpdate(BaseModel):
    """更新用户模板请求

    所有字段都是可选的，仅更新提供的字段
    """

    title: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    prompt_text: str | None = Field(None, min_length=1, max_length=5000)
    category: str | None = None
    variables: list[PromptTemplateVariable] | None = None


# ========== 斜杠命令 ==========


class SlashCommand(BaseModel):
    """斜杠命令

    将简短的命令（如 /cost-trend）映射到系统模板
    """

    command: str = Field(..., description="命令名称（不含 /）")
    template_id: str = Field(..., description="关联的模板 ID")
    description: str | None = Field(None, description="命令描述（显示在自动补全）")
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "command": "cost-trend",
                "template_id": "550e8400-e29b-41d4-a716-446655440000",
                "description": "💰 显示本月 AWS 成本趋势",
                "is_active": True,
                "created_at": "2025-10-15T10:00:00Z",
            }
        }


# ========== 执行模板 ==========


class TemplateExecuteRequest(BaseModel):
    """执行模板请求

    前端提交变量值，后端渲染模板并返回
    """

    variables: dict | None = Field(None, description="变量值映射 {变量名: 值}")

    class Config:
        json_schema_extra = {
            "example": {"variables": {"days": 7, "service": "EC2", "region": "us-east-1"}}
        }


class TemplateExecuteResponse(BaseModel):
    """执行模板响应

    返回渲染后的 Prompt 和更新后的使用计数
    """

    template_id: str
    rendered_prompt: str = Field(..., description="渲染后的 Prompt（变量已替换）")
    usage_count: int = Field(..., description="更新后的使用计数")

    class Config:
        json_schema_extra = {
            "example": {
                "template_id": "550e8400-e29b-41d4-a716-446655440000",
                "rendered_prompt": "查看最近 7 天的 EC2 成本，重点关注 us-east-1 区域",
                "usage_count": 46,
            }
        }
