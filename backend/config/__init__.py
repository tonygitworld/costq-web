"""配置管理模块

提供统一的配置管理接口，支持：
- 环境变量自动加载
- 类型验证
- 默认值管理
- 多环境配置
"""

from .settings import get_settings, settings

__all__ = ["settings", "get_settings"]
