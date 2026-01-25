"""监控 API 端点（简化版）

新架构说明：
- 无MCP客户端缓存，不再提供MCP状态统计
- 保留性能指标查询接口
- 保留健康检查接口
"""

import time

from fastapi import APIRouter, HTTPException

from ..utils.metrics import get_metrics

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/metrics")
async def get_performance_metrics():
    """获取性能统计指标

    返回整体查询性能统计，包括：
    - 总查询数
    - 账号数
    - 平均查询时间
    - P50/P90/P95/P99 百分位数
    - 运行时长

    用途：
    - 日志分析
    - 性能监控
    - 趋势分析
    """
    try:
        metrics = get_metrics()
        stats = metrics.get_stats()

        logger.debug("📊 查询性能指标 - 总查询数: {stats.get('total_queries', 0)}")

        return {
            "status": "success",
            "data": stats,
            "architecture": "simplified",
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"获取性能指标失败: {str(e)}")


@router.get("/metrics/by-account")
async def get_metrics_by_account():
    """获取分账号性能指标

    返回每个账号的查询性能统计
    """
    try:
        metrics = get_metrics()
        account_stats = metrics.get_account_stats()

        logger.debug("📊 分账号性能指标 - 账号数: {len(account_stats)}")

        return {
            "status": "success",
            "data": account_stats,
            "architecture": "simplified",
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"获取分账号性能指标失败: {str(e)}")


@router.get("/health")
async def health_check():
    """健康检查（简化版）

    返回系统健康状态，包括：
    - 服务状态
    - 性能指标概览

    注意：新架构无MCP客户端缓存，不再提供MCP状态统计
    """
    try:
        # 获取性能指标
        metrics = get_metrics()
        perf_stats = metrics.get_stats()

        # 判断健康状态
        status = "healthy"
        issues = []

        # 检查性能指标
        if perf_stats.get("total_queries", 0) > 0:
            p90 = perf_stats.get("p90", 0)
            if p90 > 3.0:
                issues.append(f"P90 查询时间过高: {p90:.2f}秒")
                status = "warning"

        return {
            "status": status,
            "issues": issues,
            "architecture": "simplified",
            "note": "新架构无MCP客户端缓存，每次查询创建新客户端",
            "performance": {
                "total_queries": perf_stats.get("total_queries", 0),
                "avg_time": perf_stats.get("avg_time", 0),
                "p90": perf_stats.get("p90", 0),
            },
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error(": %s", e)
        return {"status": "error", "error": str(e), "timestamp": time.time()}


@router.get("/mcp-status")
async def get_mcp_status():
    """获取 MCP 客户端状态（新架构已简化）

    注意：新架构无MCP客户端缓存，此接口返回简化信息
    """
    try:
        return {
            "status": "success",
            "architecture": "simplified",
            "message": "新架构无MCP客户端缓存，每次查询创建新客户端",
            "note": "MCP通过STDio方式启动，无需缓存管理",
            "details": {
                "design": "无状态",
                "cache": "无缓存",
                "mcp_creation": "按需创建（STDio）",
                "lifecycle": "随查询结束自动清理",
            },
            "timestamp": time.time(),
        }

    except Exception as e:
        logger.error("MCP : %s", e)
        raise HTTPException(status_code=500, detail=f"获取 MCP 状态失败: {str(e)}")
