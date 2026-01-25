"""告警定时调度服务

职责：
1. 每天上午 9:00 (Asia/Shanghai) 自动扫描并执行告警
2. 批量并发执行，控制并发数（默认10个）
3. 异常处理和指数退避重试（最多3次）
4. 记录详细的执行日志
5. 提供调度器状态查询

设计原则：
- 单例模式：确保全局只有一个调度器实例
- 线程安全：使用 BackgroundScheduler 在后台线程运行
- 容错性：失败重试 + 详细日志记录
- 可观测性：提供状态查询接口
- 资源控制：并发限制 + 智能去重

作者：25年经验全栈工程师
日期：2025-11-19
"""

import asyncio
import logging
import os
import random
from datetime import UTC, datetime
from typing import Any, Optional

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pytz import timezone as pytz_timezone

from backend.database import get_db
from backend.models.alert_execution_log import AlertExecutionLog
from backend.models.monitoring import MonitoringConfig
from backend.services.alert_service import AlertService

logger = logging.getLogger(__name__)


class AlertScheduler:
    """告警定时调度器（单例模式）

    核心功能：
    1. 定时扫描：每天 7:00 AM (Asia/Tokyo) 触发
    2. 智能筛选：基于日期判断是否需要执行（确保每天执行一次）
    3. 批量执行：并发执行多个告警，最多5个同时，带随机抖动
    4. 失败重试：指数退避重试3次
    5. 详细日志：记录每个告警的执行状态

    单例实现：
    - 使用 __new__ 确保全局只有一个实例
    - 使用 _initialized 标志避免重复初始化
    """

    _instance: Optional["AlertScheduler"] = None

    def __new__(cls) -> "AlertScheduler":
        """单例模式：确保全局只有一个调度器实例"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化调度器（只执行一次）"""
        # 避免重复初始化
        if hasattr(self, "_initialized") and self._initialized:
            return

        self._initialized = True

        # ============ 配置项 ============
        # 1. 时区优化：默认 Asia/Tokyo (UTC+9)
        self.timezone_str = os.getenv("ALERT_SCHEDULER_TIMEZONE", "Asia/Tokyo")
        try:
            self.tz = pytz_timezone(self.timezone_str)
        except Exception:
            logger.warning("'%s'UTC", self.timezone_str)
            self.tz = pytz_timezone("UTC")
            self.timezone_str = "UTC"

        # 2. 执行时间：默认 07:00 (用户上班前)
        self.execution_hour = int(os.getenv("ALERT_SCHEDULER_HOUR", 7))
        self.execution_minute = int(os.getenv("ALERT_SCHEDULER_MINUTE", 0))

        # 3. 并发控制：降低并发数，避免限流
        self.max_concurrent_alerts = int(os.getenv("ALERT_SCHEDULER_MAX_CONCURRENT", 5))
        self.max_retries = int(os.getenv("ALERT_SCHEDULER_MAX_RETRIES", 3))

        # 4. 逻辑修复：不再使用间隔小时，改用日期判断
        # 保留此变量仅作兼容，实际逻辑已修改
        self.check_interval_hours = int(
            os.getenv("ALERT_SCHEDULER_CHECK_INTERVAL_HOURS", 24)
        )

        # ============ 核心组件 ============
        self.scheduler = BackgroundScheduler(
            timezone=self.tz,
            job_defaults={
                "coalesce": True,  # 合并错过的任务
                "max_instances": 1,  # 同一时间只运行一个实例
                "misfire_grace_time": 300,  # 错过任务的宽限时间（5分钟）
            },
        )

        self.is_running = False

        # ============ 监听调度器事件 ============
        self.scheduler.add_listener(
            self._job_executed_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR
        )

        logger.info("📅 AlertScheduler 初始化完成")
        logger.info("   - : %s", self.timezone_str)
        logger.info(
            f"   - 执行时间: 每天 {self.execution_hour:02d}:{self.execution_minute:02d}"
        )
        logger.info("   - : %s", self.max_concurrent_alerts)
        logger.info("   - : %s", self.max_retries)
        logger.info("   - : %s", self.check_interval_hours)

    def start(self) -> None:
        """启动调度器

        Raises:
            RuntimeError: 如果调度器已在运行
        """
        if self.is_running:
            logger.warning("⚠️  AlertScheduler 已在运行中，跳过启动")
            return

        try:
            # 添加定时任务
            self.scheduler.add_job(
                func=self._daily_scan_job,
                trigger=CronTrigger(
                    hour=self.execution_hour,
                    minute=self.execution_minute,
                    second=0,
                    timezone=self.tz,
                ),
                id="daily_alert_scan",
                name="每日告警扫描任务",
                replace_existing=True,
            )

            # 启动调度器
            self.scheduler.start()
            self.is_running = True

            # 获取下次执行时间
            job = self.scheduler.get_job("daily_alert_scan")
            next_run = job.next_run_time if job else None

            logger.info("=" * 60)
            logger.info("✅ AlertScheduler 已启动")
            logger.info(
                f"📅 定时任务: 每天 {self.execution_hour:02d}:{self.execution_minute:02d} ({self.timezone_str})"
            )
            if next_run:
                logger.info("⏰ 下次执行: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            logger.info("=" * 60)

        except Exception as e:
            logger.error("❌ AlertScheduler 启动失败: %s", e, exc_info=True)
            raise RuntimeError(f"AlertScheduler 启动失败: {e}") from e

    def stop(self) -> None:
        """停止调度器"""
        if not self.is_running:
            logger.info("ℹ️  AlertScheduler 未运行，无需停止")
            return

        try:
            self.scheduler.shutdown(wait=True)
            self.is_running = False
            logger.info("🛑 AlertScheduler 已停止")
        except Exception as e:
            logger.error("❌ AlertScheduler 停止失败: %s", e, exc_info=True)

    def _job_executed_listener(self, event) -> None:
        """监听任务执行事件（用于日志记录）"""
        if event.exception:
            logger.error(
                f"❌ 调度任务执行失败: {event.job_id}",
                exc_info=(event.exception.__class__, event.exception, event.traceback),
            )
        else:
            logger.info(": %s", event.job_id)

    def _daily_scan_job(self) -> None:
        """每日扫描任务（由调度器在后台线程调用）

        注意：这是同步函数，在后台线程运行
        需要使用 asyncio.run() 来执行异步任务
        """
        logger.info("=" * 80)
        logger.info("🔔 开始每日告警扫描")
        logger.info(
            f"⏰ 执行时间: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        logger.info("=" * 80)

        try:
            # 在后台线程中运行异步任务
            # 注意：需要创建新的事件循环（后台线程没有默认事件循环）
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(self.scan_and_execute_alerts())
            finally:
                loop.close()

        except Exception as e:
            logger.error("❌ 每日扫描任务执行失败: %s", e, exc_info=True)

    async def scan_and_execute_alerts(self) -> dict[str, Any]:
        """扫描并执行告警（核心业务逻辑）

        工作流程：
        1. 查询所有启用的告警 (is_active=True)
        2. 筛选需要执行的告警 (last_checked_at >= 20小时 或 从未执行)
        3. 批量并发执行 (最多10个同时)
        4. 记录执行结果

        Returns:
            Dict[str, Any]: 执行摘要
        """
        start_time = datetime.now(UTC)

        # 3. 性能优化：使用 asyncio.to_thread 封装数据库查询
        # 注意：这里为了简单起见，仍然使用同步查询，因为查询本身很快
        # 真正的瓶颈在 execute_single_alert 中的 API 调用
        db = next(get_db())
        try:
            # ============ 1️⃣ 查询所有启用的告警 ============
            alerts = (
                db.query(MonitoringConfig)
                .filter(MonitoringConfig.is_active == True)
                .all()
            )

            total_alerts = len(alerts)
            logger.info("%s ", total_alerts)

            if not alerts:
                logger.info("📭 没有启用的告警，任务结束")
                return {
                    "total_alerts": 0,
                    "executed": 0,
                    "skipped": 0,
                    "success": 0,
                    "failed": 0,
                    "duration_seconds": 0,
                }

            # ============ 2️⃣ 筛选需要执行的告警 ============
            now = datetime.now(UTC)
            alerts_to_execute: list[MonitoringConfig] = []
            skipped_count = 0

            for alert in alerts:
                should_execute = self._should_execute_alert(alert, now)

                if should_execute:
                    alerts_to_execute.append(alert)
                    logger.info(
                        f"✅ 告警将执行: {alert.display_name} (ID: {str(alert.id)[:8]}...)"
                    )
                else:
                    skipped_count += 1
                    if alert.last_checked_at:
                        hours_ago = (now - alert.last_checked_at).total_seconds() / 3600
                        remaining_hours = self.check_interval_hours - hours_ago
                        skip_msg = (
                            f"⏭️  告警跳过: {alert.display_name} "
                            f"(上次检查: {hours_ago:.1f}小时前, "
                            f"还需等待: {remaining_hours:.1f}小时)"
                        )
                        print(skip_msg)
                        logger.info(skip_msg)

            executed_count = len(alerts_to_execute)
            summary_executed = f"🎯 需要执行的告警: {executed_count} 个"
            summary_skipped = f"⏭️  跳过的告警: {skipped_count} 个"
            print(summary_executed)
            print(summary_skipped)
            logger.info(summary_executed)
            logger.info(summary_skipped)

            if not alerts_to_execute:
                duration = (datetime.now(UTC) - start_time).total_seconds()

                # ============ 输出详细的跳过信息（同时用print和logger） ============
                print("=" * 80)
                print("📊 每日告警扫描完成（所有告警均已跳过）")
                print(f"   总告警数: {total_alerts}")
                print("   已执行: 0")
                print(f"   ⏭️  跳过: {skipped_count}")
                print("   原因: 所有告警今天已经执行过")
                print(f"   ⏱️  总耗时: {duration:.2f}秒")

                logger.info("=" * 80)
                logger.info("📊 每日告警扫描完成（所有告警均已跳过）")
                logger.info("   : %s", total_alerts)
                logger.info("   已执行: 0")
                logger.info("   : %s", skipped_count)
                logger.info("   原因: 所有告警今天已经执行过")
                logger.info("   ⏱️  总耗时: {duration:.2f}秒")

                # ============ 列出每个被跳过的告警 ============
                if alerts:
                    print("   被跳过的告警详情:")
                    logger.info("   被跳过的告警详情:")
                    for alert in alerts:
                        if alert.last_checked_at:
                            last_check_local = alert.last_checked_at.astimezone(self.tz)
                            detail_line = (
                                f"     • {alert.display_name}: "
                                f"上次检查 {last_check_local.strftime('%Y-%m-%d %H:%M:%S %Z')}"
                            )
                            print(detail_line)
                            logger.info(detail_line)

                print("=" * 80)
                logger.info("=" * 80)

                return {
                    "total_alerts": total_alerts,
                    "executed": 0,
                    "skipped": skipped_count,
                    "success": 0,
                    "failed": 0,
                    "duration_seconds": duration,
                }

            # ============ 3️⃣ 批量并发执行告警 ============
            results = await self._batch_execute_alerts(alerts_to_execute)

            # ============ 4️⃣ 统计结果 ============
            success_count = sum(1 for r in results if r.get("success"))
            failed_count = executed_count - success_count
            duration = (datetime.now(UTC) - start_time).total_seconds()

            logger.info("=" * 80)
            logger.info("📊 每日告警扫描完成")
            logger.info("   : %s", total_alerts)
            logger.info("   : %s", executed_count)
            logger.info("   : %s", skipped_count)
            logger.info("   : %s", success_count)
            logger.info("   : %s", failed_count)
            logger.info("   ⏱️  总耗时: {duration:.2f}秒")
            logger.info("=" * 80)

            return {
                "total_alerts": total_alerts,
                "executed": executed_count,
                "skipped": skipped_count,
                "success": success_count,
                "failed": failed_count,
                "duration_seconds": duration,
            }

        except Exception as e:
            logger.error("❌ 扫描和执行告警失败: %s", e, exc_info=True)
            raise
        finally:
            db.close()

    def _should_execute_alert(
        self, alert: MonitoringConfig, current_time: datetime
    ) -> bool:
        """判断告警是否需要执行

        判断逻辑（优化版）：
        1. 如果从未执行过 (last_checked_at is None)，则执行
        2. 检查上次执行日期 vs 当前日期（基于目标时区）
        3. 只要今天（当地时间）没有执行过，就执行

        Args:
            alert: 告警配置对象
            current_time: 当前UTC时间

        Returns:
            bool: True表示需要执行，False表示跳过
        """
        if alert.last_checked_at is None:
            # 新创建的告警，立即执行
            logger.debug("(): %s", alert.display_name)
            return True

        # 将时间转换为目标时区（如 Asia/Tokyo）
        last_check_local = alert.last_checked_at.astimezone(self.tz)
        current_time_local = current_time.astimezone(self.tz)

        # 比较日期
        if last_check_local.date() < current_time_local.date():
            logger.debug(
                f"⏰ 告警需要执行: {alert.display_name} "
                f"(上次检查: {last_check_local.date()}, 今天: {current_time_local.date()})"
            )
            return True
        else:
            # 今天已经执行过了
            return False

    async def _batch_execute_alerts(
        self, alerts: list[MonitoringConfig]
    ) -> list[dict[str, Any]]:
        """批量并发执行告警

        使用 asyncio.Semaphore 限制并发数，避免资源耗尽
        增加随机抖动 (Jitter) 避免瞬间并发刺穿

        Args:
            alerts: 需要执行的告警列表

        Returns:
            List[Dict[str, Any]]: 执行结果列表
        """
        # 创建信号量，限制并发数
        semaphore = asyncio.Semaphore(self.max_concurrent_alerts)

        async def execute_with_limit(alert: MonitoringConfig) -> dict[str, Any]:
            """带并发限制的执行函数"""
            # 随机延迟 0.5-3.0 秒，打散请求，避免瞬间并发
            await asyncio.sleep(random.uniform(0.5, 3.0))

            async with semaphore:
                return await self._execute_single_alert(alert)

        # 创建所有任务
        tasks = [execute_with_limit(alert) for alert in alerts]

        logger.info(
            f"🚀 开始批量执行 {len(tasks)} 个告警 "
            f"(最多 {self.max_concurrent_alerts} 个并发, 带随机抖动)"
        )

        # 并发执行，捕获所有异常
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理异常结果
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(
                    f"❌ 告警执行出现未捕获异常: {alerts[i].display_name}",
                    exc_info=result,
                )
                processed_results.append(
                    {"success": False, "alert_id": alerts[i].id, "error": str(result)}
                )
            else:
                processed_results.append(result)

        return processed_results

    def _update_alert_status_sync(self, alert_id: str, result: dict[str, Any]) -> None:
        """同步更新告警状态（在线程池中运行）

        将数据库写操作封装在此函数中，通过 asyncio.to_thread 调用，
        避免阻塞 asyncio 事件循环。

        注意：
        - 只更新 last_checked_at，不创建执行日志
        - 执行日志已由 AlertService.execute_alert_check() 内部创建和更新
        - 避免重复创建日志记录（修复 #2）
        """
        db = next(get_db())
        try:
            # 重新查询对象（因为跨线程/会话）
            alert = (
                db.query(MonitoringConfig)
                .filter(MonitoringConfig.id == alert_id)
                .first()
            )
            if not alert:
                logger.warning(": %s", alert_id)
                return

            # ✅ 只更新最后检查时间
            alert.last_checked_at = datetime.now(UTC)
            db.commit()

            logger.debug("✅ 已更新 last_checked_at: Alert {str(alert_id)[:8]}...")

        except Exception:
            logger.error("❌ 更新告警状态失败: Alert ID %s", alert_id, exc_info=True)
        finally:
            db.close()

    def _log_failure_sync(self, alert_id: str, error_message: str) -> None:
        """同步记录失败日志（在线程池中运行）"""
        db = next(get_db())
        try:
            # 需要查询 org_id
            alert = (
                db.query(MonitoringConfig)
                .filter(MonitoringConfig.id == alert_id)
                .first()
            )
            if not alert:
                logger.warning(": %s", alert_id)
                return

            log = AlertExecutionLog(
                alert_id=alert_id,
                org_id=alert.org_id,  # ✅ 必须字段
                execution_type="scheduled",
                triggered=False,
                email_sent=False,
                error_message=error_message,
            )
            db.add(log)
            db.commit()
            logger.info(": Alert ID %s", alert_id)
        except Exception:
            logger.error("❌ 记录失败日志时出错: Alert ID %s", alert_id, exc_info=True)
        finally:
            db.close()

    async def _execute_single_alert(self, alert: MonitoringConfig) -> dict[str, Any]:
        """执行单个告警（带指数退避重试）

        工作流程：
        1. 尝试执行告警（最多3次）
        2. 失败时指数退避：1秒、2秒、4秒
        3. 记录执行日志（使用 asyncio.to_thread 避免阻塞）
        4. 更新 last_checked_at

        Args:
            alert: 告警配置对象

        Returns:
            Dict[str, Any]: 执行结果
        """
        logger.info(
            f"⚡ 开始执行告警: {alert.display_name} (ID: {str(alert.id)[:8]}...)"
        )

        # 注意：这里不创建 db session，因为数据库操作已移至 _update_alert_status_sync

        try:
            # ============ 指数退避重试 ============
            last_error = None

            for attempt in range(self.max_retries):
                try:
                    result = await AlertService.execute_alert_check(
                        alert_id=alert.id,
                        alert_name=alert.display_name,
                        query_description=alert.query_description,
                        org_id=alert.org_id,
                        account_id=alert.account_id,
                        account_type=alert.account_type or "aws",
                        user_id=alert.user_id,
                        is_test=False,  # 定时任务，不是测试
                    )

                    # ============ 更新状态（异步非阻塞） ============
                    # 使用 asyncio.to_thread 将同步数据库操作放入线程池
                    await asyncio.to_thread(
                        self._update_alert_status_sync, alert.id, result
                    )

                    logger.info(
                        f"✅ 告警执行成功: {alert.display_name} | "
                        f"触发: {result.get('triggered', False)} | "
                        f"邮件: {result.get('email_sent', False)} | "
                        f"耗时: {result.get('execution_duration_ms', 0)}ms"
                    )

                    return {
                        "success": True,
                        "alert_id": alert.id,
                        "triggered": result.get("triggered", False),
                        "email_sent": result.get("email_sent", False),
                        "current_value": result.get("current_value"),
                        "execution_duration_ms": result.get("execution_duration_ms"),
                    }

                except Exception as e:
                    last_error = e
                    logger.error("❌ 详细错误堆栈: {traceback.format_exc()}")

                    if attempt < self.max_retries - 1:
                        # 指数退避：1秒、2秒、4秒
                        wait_time = 2**attempt
                        logger.warning(
                            f"⚠️  告警执行失败，{wait_time}秒后重试 "
                            f"(尝试 {attempt + 1}/{self.max_retries}): "
                            f"{alert.display_name} | 错误: {str(e)}"
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        # 最后一次重试也失败了
                        logger.error(
                            f"❌ 告警执行失败（重试{self.max_retries}次后）: {alert.display_name}",
                            exc_info=True,
                        )

            # ============ 所有重试都失败，记录失败日志 ============
            error_message = str(last_error) if last_error else "未知错误"

            # 异步记录失败日志
            await asyncio.to_thread(self._log_failure_sync, alert.id, error_message)

            return {"success": False, "alert_id": alert.id, "error": error_message}

        except Exception as e:
            # 捕获外层异常（不应该发生）
            logger.error(
                f"❌ 告警执行出现未预期错误: {alert.display_name}", exc_info=True
            )
            return {
                "success": False,
                "alert_id": alert.id,
                "error": f"未预期错误: {str(e)}",
            }

    def get_status(self) -> dict[str, Any]:
        """获取调度器状态

        Returns:
            Dict[str, Any]: 调度器状态信息
        """
        status = {
            "running": self.is_running,
            "timezone": self.timezone_str,
            "execution_time": f"{self.execution_hour:02d}:{self.execution_minute:02d}",
            "max_concurrent": self.max_concurrent_alerts,
            "check_interval_hours": self.check_interval_hours,
            "max_retries": self.max_retries,
            "jobs": [],
        }

        if self.is_running:
            try:
                job = self.scheduler.get_job("daily_alert_scan")
                if job and job.next_run_time:
                    status["next_run_time"] = job.next_run_time.isoformat()
                    status["jobs"].append(
                        {
                            "id": job.id,
                            "name": job.name,
                            "next_run": job.next_run_time.isoformat(),
                        }
                    )
            except Exception as e:
                logger.warning(": %s", e)

        return status


# ============ 全局单例实例 ============
alert_scheduler = AlertScheduler()
