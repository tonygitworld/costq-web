"""数据库配置和会话管理"""

import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from backend.config.settings import settings
from backend.models.base import Base

logger = logging.getLogger(__name__)


def get_database_url() -> str:
    """
    获取数据库连接字符串

    Returns:
        PostgreSQL 连接字符串（从环境变量或 Secrets Manager 获取）
    """
    try:
        # 1. 优先检查环境变量
        env_db_url = os.getenv("DATABASE_URL")
        if env_db_url:
            # 隐藏密码部分用于日志
            safe_url = env_db_url.split("@")[-1] if "@" in env_db_url else "******"
            logger.info("使用环境变量配置的数据库: PostgreSQL, Host: %s", safe_url.split("/")[0])
            return env_db_url

        # 2. 从AWS Secrets Manager获取云数据库连接
        database_url = settings.get_database_url()

        # 隐藏密码部分用于日志
        safe_url = database_url.split("@")[-1] if "@" in database_url else "******"
        logger.info(
            "从Secrets Manager获取数据库配置: PostgreSQL, Host: %s", safe_url.split("/")[0]
        )

        return database_url
    except Exception as e:
        logger.error("获取数据库连接字符串失败: %s", e, exc_info=True)
        raise


# 延迟初始化，避免导入时阻塞
_engine = None
_SessionLocal = None
_ScopedSession = None


def _init_engine():
    """延迟初始化数据库引擎"""
    global _engine, _SessionLocal, _ScopedSession

    if _engine is not None:
        return

    DATABASE_URL = get_database_url()

    # 创建引擎（PostgreSQL 配置）
    engine_kwargs = {
        "echo": False,  # 生产环境设为 False
        "pool_pre_ping": True,  # 连接池健康检查
    }

    # 仅当不是 SQLite 时添加连接池参数（为了兼容测试时的内存数据库）
    if "sqlite" not in DATABASE_URL:
        engine_kwargs.update(
            {
                "pool_size": 10,  # 连接池大小
                "max_overflow": 20,  # 最大溢出连接数
                "pool_timeout": 30,  # 连接超时（秒）
                "pool_recycle": 3600,  # 连接回收时间（秒）
            }
        )
    else:
        # SQLite 特殊配置（仅用于测试）
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    _engine = create_engine(DATABASE_URL, **engine_kwargs)
    logger.info("数据库引擎创建成功 - Environment: %s", settings.ENVIRONMENT)

    # 创建会话工厂
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

    # 创建线程安全的会话
    _ScopedSession = scoped_session(_SessionLocal)


# 为了向后兼容，提供函数访问
def get_engine():
    """获取数据库引擎（延迟初始化）"""
    _init_engine()
    return _engine


def get_session_local():
    """获取会话工厂（延迟初始化）"""
    _init_engine()
    return _SessionLocal


def get_scoped_session():
    """获取作用域会话（延迟初始化）"""
    _init_engine()
    return _ScopedSession


def get_db():
    """获取数据库会话（FastAPI依赖注入）"""
    _init_engine()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库（创建所有表）"""
    # 导入所有模型以确保它们被注册

    # 创建所有表
    Base.metadata.create_all(bind=get_engine())
    logger.info("数据库表创建成功")


def drop_all_tables():
    """删除所有表（仅用于开发/测试）"""
    Base.metadata.drop_all(bind=get_engine())
    logger.warning("所有数据库表已删除")
