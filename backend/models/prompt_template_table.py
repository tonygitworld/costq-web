"""Prompt Template SQLAlchemy 模型"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from backend.models.base import Base


class PromptTemplateTable(Base):
    """系统预设模板表"""

    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(Text)
    prompt_text = Column(Text, nullable=False)
    category = Column(String(20), nullable=False, index=True)
    icon = Column(String(50))
    cloud_provider = Column(String(10), index=True)
    variables = Column(Text)  # JSON string
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, index=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class UserPromptTemplateTable(Base):
    """用户自定义模板表"""

    __tablename__ = "user_prompt_templates"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(100), nullable=False)
    description = Column(Text)
    prompt_text = Column(Text, nullable=False)
    category = Column(String(20), default="custom")
    variables = Column(Text)  # JSON string
    is_favorite = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class SlashCommandTable(Base):
    """斜杠命令表"""

    __tablename__ = "slash_commands"

    command = Column(String(50), primary_key=True)
    template_id = Column(String(36), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
