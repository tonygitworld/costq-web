"""AlertScheduler 单元测试

验证告警调度器的核心逻辑：
- 频率判断 (_should_execute_alert)
- 限流错误识别 (_is_throttling_error)
- 分批提交 + 批内并发 (_batch_execute_alerts)
- Advisory lock 获取/释放
"""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# NOTE: 直接 import AlertScheduler 会触发单例初始化和数据库连接，
# 所以在每个测试中通过 mock 绕过
def _create_scheduler():
    """创建一个干净的 AlertScheduler 实例，绕过单例和数据库初始化。"""
    with patch("backend.services.alert_scheduler.get_db"):
        from backend.services.alert_scheduler import AlertScheduler

        # 绕过单例
        AlertScheduler._instance = None
        scheduler = object.__new__(AlertScheduler)
        scheduler._initialized = False
        scheduler.__init__()
        return scheduler


def _make_alert(
    alert_id: str = "test-id",
    display_name: str = "test-alert",
    last_checked_at: datetime | None = None,
    check_frequency: str = "daily",
) -> MagicMock:
    """构造 mock 的 MonitoringConfig 对象。"""
    alert = MagicMock()
    alert.id = alert_id
    alert.display_name = display_name
    alert.last_checked_at = last_checked_at
    alert.check_frequency = check_frequency
    alert.query_description = "test query"
    alert.org_id = "org-1"
    alert.account_id = "acc-1"
    alert.account_type = "aws"
    alert.user_id = "user-1"
    return alert


# ============================================================
# 1. _should_execute_alert 频率判断
# ============================================================
class TestShouldExecuteAlert:
    """验证不同频率下的执行判断逻辑。"""

    def setup_method(self) -> None:
        self.scheduler = _create_scheduler()

    def test_never_executed_returns_true(self) -> None:
        """从未执行过的告警应该执行。"""
        alert = _make_alert(last_checked_at=None)
        assert self.scheduler._should_execute_alert(alert, datetime.now(UTC)) is True

    def test_daily_same_day_returns_false(self) -> None:
        """daily 频率，当天已执行过应跳过。"""
        now = datetime.now(UTC)
        alert = _make_alert(last_checked_at=now - timedelta(hours=1))
        assert self.scheduler._should_execute_alert(alert, now) is False

    def test_daily_previous_day_returns_true(self) -> None:
        """daily 频率，上次执行在昨天应执行。"""
        now = datetime.now(UTC)
        alert = _make_alert(last_checked_at=now - timedelta(days=1))
        assert self.scheduler._should_execute_alert(alert, now) is True

    def test_weekly_3_days_ago_returns_false(self) -> None:
        """weekly 频率，3天前执行过应跳过。"""
        now = datetime.now(UTC)
        alert = _make_alert(
            last_checked_at=now - timedelta(days=3),
            check_frequency="weekly",
        )
        assert self.scheduler._should_execute_alert(alert, now) is False

    def test_weekly_8_days_ago_returns_true(self) -> None:
        """weekly 频率，8天前执行过应执行。"""
        now = datetime.now(UTC)
        alert = _make_alert(
            last_checked_at=now - timedelta(days=8),
            check_frequency="weekly",
        )
        assert self.scheduler._should_execute_alert(alert, now) is True

    def test_monthly_15_days_ago_returns_false(self) -> None:
        """monthly 频率，15天前执行过应跳过。"""
        now = datetime.now(UTC)
        alert = _make_alert(
            last_checked_at=now - timedelta(days=15),
            check_frequency="monthly",
        )
        assert self.scheduler._should_execute_alert(alert, now) is False

    def test_monthly_31_days_ago_returns_true(self) -> None:
        """monthly 频率，31天前执行过应执行。"""
        now = datetime.now(UTC)
        alert = _make_alert(
            last_checked_at=now - timedelta(days=31),
            check_frequency="monthly",
        )
        assert self.scheduler._should_execute_alert(alert, now) is True

    def test_null_frequency_treated_as_daily(self) -> None:
        """check_frequency 为 None 时按 daily 处理（向后兼容）。"""
        now = datetime.now(UTC)
        alert = _make_alert(
            last_checked_at=now - timedelta(days=1),
            check_frequency=None,
        )
        assert self.scheduler._should_execute_alert(alert, now) is True

    def test_empty_frequency_treated_as_daily(self) -> None:
        """check_frequency 为空字符串时按 daily 处理（向后兼容）。"""
        now = datetime.now(UTC)
        alert = _make_alert(
            last_checked_at=now - timedelta(days=1),
            check_frequency="",
        )
        assert self.scheduler._should_execute_alert(alert, now) is True


# ============================================================
# 2. _is_throttling_error 限流错误识别
# ============================================================
class TestIsThrottlingError:
    """验证限流错误与普通错误的区分。"""

    def setup_method(self) -> None:
        self.scheduler = _create_scheduler()

    def test_429_detected(self) -> None:
        assert self.scheduler._is_throttling_error(Exception("HTTP 429")) is True

    def test_throttling_keyword(self) -> None:
        assert self.scheduler._is_throttling_error(
            Exception("ThrottlingException: rate exceeded")
        ) is True

    def test_too_many_requests(self) -> None:
        assert self.scheduler._is_throttling_error(
            Exception("Too Many Requests")
        ) is True

    def test_normal_error_not_throttling(self) -> None:
        assert self.scheduler._is_throttling_error(
            ValueError("invalid input")
        ) is False

    def test_connection_error_not_throttling(self) -> None:
        assert self.scheduler._is_throttling_error(
            ConnectionError("connection refused")
        ) is False


# ============================================================
# 3. _batch_execute_alerts 分批提交 + 批内并发
# ============================================================
class TestBatchExecution:
    """验证分批提交节奏和并发控制。"""

    def setup_method(self) -> None:
        self.scheduler = _create_scheduler()
        self.scheduler.batch_size = 2
        self.scheduler.inter_batch_delay = 0.05  # 加速测试

    @pytest.mark.asyncio
    async def test_all_alerts_executed(self) -> None:
        """所有告警都应被执行并返回结果。"""
        alerts = [_make_alert(alert_id=f"a-{i}") for i in range(5)]

        async def mock_execute(alert: MagicMock) -> dict:
            return {"success": True, "alert_id": alert.id}

        with patch.object(
            self.scheduler, "_execute_single_alert", side_effect=mock_execute
        ):
            results = await self.scheduler._batch_execute_alerts(alerts)

        assert len(results) == 5
        assert all(r["success"] for r in results)

    @pytest.mark.asyncio
    async def test_batch_count_correct(self) -> None:
        """5 个告警、batch_size=2 应产生 3 个批次。"""
        batch_indices: list[int] = []
        alerts = [_make_alert(alert_id=f"a-{i}") for i in range(5)]

        original_gather = asyncio.gather

        async def tracking_gather(*coros, **kwargs):
            batch_indices.append(len(coros))
            return await original_gather(*coros, **kwargs)

        async def mock_execute(alert: MagicMock) -> dict:
            return {"success": True, "alert_id": alert.id}

        with (
            patch.object(
                self.scheduler, "_execute_single_alert", side_effect=mock_execute
            ),
            patch("asyncio.gather", side_effect=tracking_gather),
        ):
            await self.scheduler._batch_execute_alerts(alerts)

        # 批次: [2, 2, 1]
        assert batch_indices == [2, 2, 1]

    @pytest.mark.asyncio
    async def test_exception_in_batch_captured(self) -> None:
        """单个告警异常不应影响同批次其他告警。"""
        alerts = [_make_alert(alert_id=f"a-{i}") for i in range(3)]

        call_count = 0

        async def mock_execute(alert: MagicMock) -> dict:
            nonlocal call_count
            call_count += 1
            if alert.id == "a-1":
                raise RuntimeError("boom")
            return {"success": True, "alert_id": alert.id}

        with patch.object(
            self.scheduler, "_execute_single_alert", side_effect=mock_execute
        ):
            results = await self.scheduler._batch_execute_alerts(alerts)

        assert len(results) == 3
        failed = [r for r in results if not r["success"]]
        assert len(failed) == 1
        assert "boom" in failed[0]["error"]


# ============================================================
# 4. Advisory lock 获取/释放
# ============================================================
class TestAdvisoryLock:
    """验证 advisory lock 的获取和释放逻辑。"""

    def setup_method(self) -> None:
        self.scheduler = _create_scheduler()

    @patch("backend.services.alert_scheduler.get_db")
    def test_acquire_lock_success(self, mock_get_db: MagicMock) -> None:
        """成功获取锁时返回 (True, db_session)。"""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = True
        mock_db.execute.return_value = mock_result
        mock_get_db.return_value = iter([mock_db])

        acquired, db = self.scheduler._try_acquire_advisory_lock()

        assert acquired is True
        assert db is mock_db
        mock_db.close.assert_not_called()  # 锁持有期间不关闭

    @patch("backend.services.alert_scheduler.get_db")
    def test_acquire_lock_failure(self, mock_get_db: MagicMock) -> None:
        """获取锁失败时返回 (False, None) 并关闭会话。"""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = False
        mock_db.execute.return_value = mock_result
        mock_get_db.return_value = iter([mock_db])

        acquired, db = self.scheduler._try_acquire_advisory_lock()

        assert acquired is False
        assert db is None
        mock_db.close.assert_called_once()

    def test_release_lock_closes_session(self) -> None:
        """释放锁后应关闭数据库会话。"""
        mock_db = MagicMock()
        self.scheduler._release_advisory_lock(mock_db)

        mock_db.execute.assert_called_once()
        mock_db.close.assert_called_once()

    def test_release_lock_exception_still_closes(self) -> None:
        """释放锁异常时仍应关闭会话。"""
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("db error")

        # 不应抛出异常
        self.scheduler._release_advisory_lock(mock_db)
        mock_db.close.assert_called_once()


# ============================================================
# 5. Throttling 退避策略
# ============================================================
class TestThrottlingBackoff:
    """验证限流错误和普通错误使用不同的退避时间。"""

    def setup_method(self) -> None:
        self.scheduler = _create_scheduler()

    @pytest.mark.asyncio
    async def test_throttling_uses_longer_backoff(self) -> None:
        """限流错误应使用 throttle_backoff (10/30/60s)。"""
        alert = _make_alert()
        sleep_times: list[float] = []

        original_sleep = asyncio.sleep

        async def mock_sleep(seconds: float) -> None:
            sleep_times.append(seconds)
            # 不真正等待

        call_count = 0

        async def mock_execute(**kwargs) -> dict:
            nonlocal call_count
            call_count += 1
            raise Exception("HTTP 429 Too Many Requests")

        with (
            patch(
                "backend.services.alert_scheduler.AlertService"
                ".execute_alert_check",
                side_effect=mock_execute,
            ),
            patch("asyncio.sleep", side_effect=mock_sleep),
            patch.object(self.scheduler, "_log_failure_sync"),
            patch("backend.services.alert_scheduler.asyncio.sleep",
                  side_effect=mock_sleep),
        ):
            result = await self.scheduler._execute_single_alert(alert)

        assert result["success"] is False
        # 前两次重试的退避: 10s, 30s
        throttle_sleeps = [s for s in sleep_times if s >= 10]
        assert 10 in throttle_sleeps
        assert 30 in throttle_sleeps

    @pytest.mark.asyncio
    async def test_normal_error_uses_standard_backoff(self) -> None:
        """普通错误应使用 standard_backoff (1/2/4s)。"""
        alert = _make_alert()
        sleep_times: list[float] = []

        async def mock_sleep(seconds: float) -> None:
            sleep_times.append(seconds)

        async def mock_execute(**kwargs) -> dict:
            raise ValueError("some business error")

        with (
            patch(
                "backend.services.alert_scheduler.AlertService"
                ".execute_alert_check",
                side_effect=mock_execute,
            ),
            patch("backend.services.alert_scheduler.asyncio.sleep",
                  side_effect=mock_sleep),
            patch.object(self.scheduler, "_log_failure_sync"),
        ):
            result = await self.scheduler._execute_single_alert(alert)

        assert result["success"] is False
        # standard_backoff_base=2: 2^0=1, 2^1=2
        backoff_sleeps = [s for s in sleep_times if s >= 1]
        assert 1 in backoff_sleeps
        assert 2 in backoff_sleeps
