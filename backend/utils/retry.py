"""
重试工具函数 - Phase 2.3
提供指数退避重试策略
"""

import asyncio
import time
from collections.abc import Callable
from functools import wraps
from typing import TypeVar

import logging

logger = logging.getLogger(__name__)


T = TypeVar("T")


def exponential_backoff_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    exceptions: tuple = (Exception,),
):
    """
    指数退避重试装饰器（同步版本）

    Args:
        max_retries: 最大重试次数
        base_delay: 基础延迟时间（秒）
        max_delay: 最大延迟时间（秒）
        exponential_base: 指数基数
        jitter: 是否添加随机抖动（避免雪崩）
        exceptions: 需要重试的异常类型元组

    Returns:
        装饰器函数
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt >= max_retries:
                        logger.error(f"❌ {func.__name__} 失败，已重试 {max_retries} 次: {e}")
                        raise

                    # 计算延迟时间（指数退避）
                    delay = min(base_delay * (exponential_base**attempt), max_delay)

                    # 添加随机抖动
                    if jitter:
                        import random

                        delay = delay * (0.5 + random.random())

                    logger.warning(
                        f"⚠️  {func.__name__} 失败 (尝试 {attempt + 1}/{max_retries + 1}): {e}, "
                        f"{delay:.2f}秒后重试..."
                    )

                    time.sleep(delay)

            # 理论上不会到达这里
            raise last_exception

        return wrapper

    return decorator


def async_exponential_backoff_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    exceptions: tuple = (Exception,),
):
    """
    指数退避重试装饰器（异步版本）

    Args:
        max_retries: 最大重试次数
        base_delay: 基础延迟时间（秒）
        max_delay: 最大延迟时间（秒）
        exponential_base: 指数基数
        jitter: 是否添加随机抖动
        exceptions: 需要重试的异常类型元组

    Returns:
        装饰器函数
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt >= max_retries:
                        logger.error(f"❌ {func.__name__} 失败，已重试 {max_retries} 次: {e}")
                        raise

                    # 计算延迟时间（指数退避）
                    delay = min(base_delay * (exponential_base**attempt), max_delay)

                    # 添加随机抖动
                    if jitter:
                        import random

                        delay = delay * (0.5 + random.random())

                    logger.warning(
                        f"⚠️  {func.__name__} 失败 (尝试 {attempt + 1}/{max_retries + 1}): {e}, "
                        f"{delay:.2f}秒后重试..."
                    )

                    await asyncio.sleep(delay)

            # 理论上不会到达这里
            raise last_exception

        return wrapper

    return decorator


def retry_with_fallback(
    func: Callable[..., T],
    fallback_value: T,
    max_retries: int = 3,
    base_delay: float = 1.0,
    exceptions: tuple = (Exception,),
) -> T:
    """
    重试函数，失败后返回fallback值（非装饰器版本）

    Args:
        func: 要执行的函数
        fallback_value: 失败时返回的默认值
        max_retries: 最大重试次数
        base_delay: 基础延迟时间
        exceptions: 需要捕获的异常类型

    Returns:
        函数执行结果或fallback值
    """
    for attempt in range(max_retries + 1):
        try:
            return func()
        except exceptions as e:
            if attempt >= max_retries:
                logger.error(f"❌ 函数执行失败（已重试{max_retries}次），返回fallback值: {e}")
                return fallback_value

            delay = base_delay * (2**attempt)
            logger.warning(f"⚠️  尝试 {attempt + 1}/{max_retries + 1} 失败: {e}, {delay}秒后重试...")
            time.sleep(delay)

    return fallback_value


class RetryStatistics:
    """重试统计器"""

    def __init__(self):
        self.total_attempts = 0
        self.total_retries = 0
        self.total_failures = 0
        self.retry_counts = {}  # {function_name: count}
        self.failure_reasons = {}  # {exception_type: count}

    def record_attempt(self, func_name: str):
        """记录一次尝试"""
        self.total_attempts += 1

    def record_retry(self, func_name: str, reason: str):
        """记录一次重试"""
        self.total_retries += 1
        self.retry_counts[func_name] = self.retry_counts.get(func_name, 0) + 1

        # 记录失败原因
        exception_type = reason.split(":")[0] if ":" in reason else reason
        self.failure_reasons[exception_type] = self.failure_reasons.get(exception_type, 0) + 1

    def record_failure(self, func_name: str):
        """记录最终失败"""
        self.total_failures += 1

    def get_stats(self) -> dict:
        """获取统计信息"""
        return {
            "total_attempts": self.total_attempts,
            "total_retries": self.total_retries,
            "total_failures": self.total_failures,
            "success_rate": (
                (self.total_attempts - self.total_failures) / self.total_attempts
                if self.total_attempts > 0
                else 0
            ),
            "retry_counts_by_function": self.retry_counts,
            "failure_reasons": self.failure_reasons,
        }

    def reset(self):
        """重置统计"""
        self.total_attempts = 0
        self.total_retries = 0
        self.total_failures = 0
        self.retry_counts = {}
        self.failure_reasons = {}


# 全局重试统计器
_retry_stats = RetryStatistics()


def get_retry_stats() -> RetryStatistics:
    """获取全局重试统计器"""
    return _retry_stats
