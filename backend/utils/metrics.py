"""性能指标收集器

Phase 4: 监控与优化
- 收集查询性能数据
- 计算统计指标（平均值、P50、P90、P99）
- 只保留最近100次记录，避免内存泄漏
- 预留扩展接口（Prometheus、CloudWatch）

P1-1 修复: 并发安全
- 添加 threading.Lock 保护共享数据
- 确保多线程环境下数据一致性
"""

import threading
from collections import defaultdict
from datetime import datetime, timezone

import logging

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """返回当前 UTC 时间"""
    return datetime.now(timezone.utc)



class PerformanceMetrics:
    """性能指标收集器

    功能：
    1. 记录查询时间
    2. 记录 MCP 加载时间
    3. 计算统计指标
    4. 按账号隔离统计

    P1-1 修复：线程安全
    - 使用 threading.Lock 保护所有共享数据操作
    - 防止并发访问导致的数据竞争

    P1-2 修复：内存泄漏防护
    - 限制最大账号数量（MAX_ACCOUNTS = 50）
    - 使用 LRU 策略清理最旧账号
    - 防止多租户场景下内存无限增长
    """

    # P1-2: 资源限制配置
    MAX_ACCOUNTS = 50  # 最大账号数量
    MAX_RECORDS_PER_ACCOUNT = 100  # 每个账号最多保留的记录数

    def __init__(self):
        """初始化指标收集器"""
        # 查询时间记录：account_id -> [duration1, duration2, ...]
        self.query_times: dict[str, list[float]] = defaultdict(list)

        # MCP 加载时间记录：account_id -> {server_type: [duration1, duration2, ...]}
        self.mcp_load_times: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )

        # P1-2: 账号访问时间记录（用于 LRU 清理）
        self._account_access_time: dict[str, datetime] = {}

        # 记录开始时间
        self.start_time = _utc_now()

        # P1-1: 添加线程锁保护并发访问
        self._lock = threading.Lock()

        # P2-2: 汇总日志计数器
        self._query_count_since_last_summary = 0
        self._summary_interval = 10  # 每 10 次查询输出一次汇总

        logger.info("✅ Phase 4: 性能指标收集器已初始化（线程安全 + 内存保护）")

    def record_query_time(self, account_id: str, duration: float):
        """记录查询时间（线程安全 + 内存保护）

        Args:
            account_id: 账号ID
            duration: 查询耗时（秒）
        """
        try:
            # P1-1: 使用锁保护共享数据
            with self._lock:
                # P1-2: 检查账号数量限制
                if account_id not in self.query_times:
                    if len(self.query_times) >= self.MAX_ACCOUNTS:
                        self._cleanup_oldest_account()

                self.query_times[account_id].append(duration)

                # 只保留最近100次记录，避免内存泄漏
                if len(self.query_times[account_id]) > self.MAX_RECORDS_PER_ACCOUNT:
                    self.query_times[account_id] = self.query_times[account_id][
                        -self.MAX_RECORDS_PER_ACCOUNT :
                    ]

                # P1-2: 更新访问时间（LRU）
                self._account_access_time[account_id] = _utc_now()

                query_count = len(self.query_times[account_id])

                # P2-2: 增加汇总计数器
                self._query_count_since_last_summary += 1

            # P2-2: 日志级别从 info 改为 debug（减少日志量）
            logger.debug(
                f"📊 查询性能 - 账号: {account_id}, 耗时: {duration:.2f}秒, 总查询数: {query_count}"
            )

            # P2-2: 每 N 次查询输出一次汇总（减少日志量 90%）
            if self._query_count_since_last_summary >= self._summary_interval:
                self._output_summary_log()
                with self._lock:
                    self._query_count_since_last_summary = 0

        except Exception as e:
            # 指标收集失败不影响业务
            logger.warning(": %s", e)

    def record_mcp_load_time(self, account_id: str, server_type: str, duration: float):
        """记录 MCP 客户端加载时间（线程安全 + 内存保护）

        Args:
            account_id: 账号ID
            server_type: MCP 服务器类型
            duration: 加载耗时（秒）
        """
        try:
            # P1-1: 使用锁保护共享数据
            with self._lock:
                # P1-2: 检查账号数量限制
                if account_id not in self.mcp_load_times:
                    if len(self.mcp_load_times) >= self.MAX_ACCOUNTS:
                        self._cleanup_oldest_account()

                self.mcp_load_times[account_id][server_type].append(duration)

                # 只保留最近100次记录
                if len(self.mcp_load_times[account_id][server_type]) > self.MAX_RECORDS_PER_ACCOUNT:
                    self.mcp_load_times[account_id][server_type] = self.mcp_load_times[account_id][
                        server_type
                    ][-self.MAX_RECORDS_PER_ACCOUNT :]

                # P1-2: 更新访问时间（LRU）
                self._account_access_time[account_id] = _utc_now()

            # 记录到日志（已经是 debug 级别）
            logger.debug(
                f"📊 MCP加载 - 账号: {account_id}, 类型: {server_type}, 耗时: {duration:.2f}秒"
            )

        except Exception as e:
            logger.warning("MCP: %s", e)

    def get_stats(self) -> dict:
        """获取整体统计信息（线程安全）

        Returns:
            统计信息字典，包含：
            - total_queries: 总查询数
            - total_accounts: 账号数
            - avg_time: 平均查询时间
            - p50: 50分位数
            - p90: 90分位数
            - p99: 99分位数
            - uptime_seconds: 运行时长
        """
        try:
            # P1-1: 使用锁保护读取操作
            with self._lock:
                # 收集所有查询时间（创建副本避免长时间持锁）
                all_times = []
                for times in self.query_times.values():
                    all_times.extend(times)

                total_accounts = len(self.query_times)

            if not all_times:
                return {
                    "total_queries": 0,
                    "total_accounts": 0,
                    "uptime_seconds": (_utc_now() - self.start_time).total_seconds(),
                }

            # 排序用于计算百分位数（在锁外执行，避免阻塞）
            all_times.sort()
            total = len(all_times)

            return {
                "total_queries": total,
                "total_accounts": total_accounts,
                "avg_time": sum(all_times) / total,
                "min_time": all_times[0],
                "max_time": all_times[-1],
                "p50": all_times[int(total * 0.50)],
                "p90": all_times[int(total * 0.90)],
                "p95": all_times[int(total * 0.95)],
                "p99": all_times[min(int(total * 0.99), total - 1)],
                "uptime_seconds": (_utc_now() - self.start_time).total_seconds(),
            }

        except Exception as e:
            logger.warning(": %s", e)
            return {"error": str(e)}

    def get_account_stats(self, account_id: str) -> dict:
        """获取指定账号的统计信息（线程安全）

        Args:
            account_id: 账号ID

        Returns:
            账号统计信息
        """
        try:
            # P1-1: 使用锁保护读取操作
            with self._lock:
                times = list(self.query_times.get(account_id, []))  # 创建副本

            if not times:
                return {"account_id": account_id, "total_queries": 0}

            times_sorted = sorted(times)
            total = len(times_sorted)

            return {
                "account_id": account_id,
                "total_queries": total,
                "avg_time": sum(times_sorted) / total,
                "min_time": times_sorted[0],
                "max_time": times_sorted[-1],
                "p50": times_sorted[int(total * 0.50)],
                "p90": times_sorted[int(total * 0.90)],
                "p99": times_sorted[min(int(total * 0.99), total - 1)],
            }

        except Exception as e:
            logger.warning(": %s", e)
            return {"error": str(e)}

    def get_mcp_stats(self) -> dict:
        """获取 MCP 加载统计信息（线程安全）

        Returns:
            MCP 加载统计
        """
        try:
            # P1-1: 使用锁保护读取操作
            with self._lock:
                # 创建深拷贝避免长时间持锁
                mcp_load_times_copy = {}
                for account_id, server_times in self.mcp_load_times.items():
                    mcp_load_times_copy[account_id] = {}
                    for server_type, times in server_times.items():
                        mcp_load_times_copy[account_id][server_type] = list(times)

            stats = {}
            for account_id, server_times in mcp_load_times_copy.items():
                stats[account_id] = {}

                for server_type, times in server_times.items():
                    if times:
                        stats[account_id][server_type] = {
                            "count": len(times),
                            "avg_time": sum(times) / len(times),
                            "min_time": min(times),
                            "max_time": max(times),
                        }

            return stats

        except Exception as e:
            logger.warning("MCP: %s", e)
            return {"error": str(e)}

    def _output_summary_log(self):
        """输出简短的汇总日志（P2-2: 每 N 次查询调用一次）

        用于减少日志量，同时保持可观测性
        """
        try:
            stats = self.get_stats()

            if stats.get("total_queries", 0) == 0:
                return

            # 简短的汇总日志（单行）
            logger.info(
                f"📊 查询汇总 - "
                f"总数: {stats['total_queries']}, "
                f"账号: {stats['total_accounts']}, "
                f"平均: {stats['avg_time']:.2f}s, "
                f"P90: {stats['p90']:.2f}s, "
                f"P99: {stats['p99']:.2f}s"
            )

        except Exception as e:
            logger.debug(": %s", e)

    def log_summary(self):
        """输出详细的统计摘要到日志

        用于定期输出性能摘要，方便日志分析
        """
        try:
            stats = self.get_stats()

            if stats.get("total_queries", 0) == 0:
                logger.info("📊 性能摘要 - 暂无查询数据")
                return

            logger.info("=" * 60)
            logger.info("📊 性能统计摘要")
            logger.info("=" * 60)
            logger.info(": %s", stats['total_queries'])
            logger.info(": %s", stats['total_accounts'])
            logger.info("运行时长: {stats['uptime_seconds']:.0f}秒")
            logger.info("平均查询时间: {stats['avg_time']:.2f}秒")
            logger.info("最快查询: {stats['min_time']:.2f}秒")
            logger.info("最慢查询: {stats['max_time']:.2f}秒")
            logger.info("P50 (中位数): {stats['p50']:.2f}秒")
            logger.info("P90: {stats['p90']:.2f}秒")
            logger.info("P95: {stats['p95']:.2f}秒")
            logger.info("P99: {stats['p99']:.2f}秒")
            logger.info("=" * 60)

            # 性能评估
            p90 = stats["p90"]
            if p90 < 1.0:
                logger.info("✅ 性能评估: 优秀 (P90 < 1秒)")
            elif p90 < 2.0:
                logger.info("✅ 性能评估: 良好 (P90 < 2秒)")
            elif p90 < 3.0:
                logger.info("⚠️ 性能评估: 可接受 (P90 < 3秒)")
            else:
                logger.info("❌ 性能评估: 需优化 (P90 >= 3秒)")

        except Exception as e:
            logger.warning(": %s", e)

    def _cleanup_oldest_account(self):
        """清理最久未使用的账号（LRU策略）

        P1-2: 防止内存泄漏
        - 当账号数量达到上限时触发
        - 清理最久未访问的账号数据
        - 释放内存空间

        注意：此方法必须在持有 self._lock 的情况下调用
        """
        if not self._account_access_time:
            logger.warning("⚠️ [Metrics] 无可清理的账号")
            return

        # 找到最旧的账号
        oldest_account = min(self._account_access_time.items(), key=lambda x: x[1])[0]

        # 清理账号数据
        if oldest_account in self.query_times:
            del self.query_times[oldest_account]
        if oldest_account in self.mcp_load_times:
            del self.mcp_load_times[oldest_account]
        if oldest_account in self._account_access_time:
            del self._account_access_time[oldest_account]

        logger.info("[Metrics] : %s (LRU)", oldest_account)


# 全局单例
_metrics: PerformanceMetrics = None


def get_metrics() -> PerformanceMetrics:
    """获取全局指标收集器单例

    Returns:
        PerformanceMetrics 实例
    """
    global _metrics
    if _metrics is None:
        _metrics = PerformanceMetrics()
    return _metrics
