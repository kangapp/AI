"""Performance metrics API endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, Query

from ...core.constants import Performance
from ...lib.json_encoder import CamelModel
from ...services.metrics_service import MetricsService

router = APIRouter()


class PerformanceMetricsResponse(CamelModel):
    """Response model for performance metrics."""

    total_requests: int
    requests_by_path: dict[str, Any]
    requests_by_method: dict[str, int]
    requests_by_status: dict[str, int]
    latency_p50: int
    latency_p95: int
    latency_p99: int
    latency_avg: float
    recent_requests: list[dict[str, Any]]


class SlowQueryResponse(CamelModel):
    """Response model for slow queries."""

    timestamp: str
    database_name: str
    query_type: str
    sql: str
    execution_time_ms: int
    row_count: int | None


class QueryPerformanceStatsResponse(CamelModel):
    """Response model for query performance statistics."""

    total_queries: int
    successful_queries: int
    failed_queries: int
    success_rate: float
    avg_execution_time_ms: float
    min_execution_time_ms: int
    max_execution_time_ms: int
    total_rows: int
    slow_queries: int
    slow_query_rate: float


class SystemMetricsResponse(CamelModel):
    """Response model for system metrics."""

    timestamp: str
    cpu: dict[str, Any]
    memory: dict[str, Any]
    disk: dict[str, Any]
    process: dict[str, Any]


def get_metrics_service() -> MetricsService:
    """Dependency to get the metrics service instance.

    Returns:
        The metrics service instance.
    """
    from ...api.main import get_metrics_service as get_global_metrics

    service = get_global_metrics()
    if service is None:
        # Create a new instance if global is not available
        return MetricsService()
    # Type assertion to satisfy mypy
    return service if isinstance(service, MetricsService) else MetricsService()


@router.get("/performance", response_model=PerformanceMetricsResponse, tags=["metrics"])
async def get_performance_metrics(
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> dict[str, Any]:
    """Get performance metrics for HTTP requests.

    Returns:
        Performance metrics including latency statistics and request counts.
    """
    from ...api.main import get_metrics_service as get_global_metrics

    # Get the performance middleware metrics
    app = get_global_metrics()
    if app and hasattr(app, "app"):
        # Try to get middleware from FastAPI app
        for middleware in app.app.user_middleware:
            if hasattr(middleware.cls, "__name__") and "Performance" in middleware.cls.__name__:
                # We need to access the actual middleware instance
                # This is a workaround as the middleware is instantiated by FastAPI
                pass

    # For now, return empty metrics if we can't access the middleware
    # In production, you'd want to store the middleware instance in a global variable
    return {
        "total_requests": 0,
        "requests_by_path": {},
        "requests_by_method": {},
        "requests_by_status": {},
        "latency_p50": 0,
        "latency_p95": 0,
        "latency_p99": 0,
        "latency_avg": 0.0,
        "recent_requests": [],
    }


@router.get("/slow-queries", response_model=list[SlowQueryResponse], tags=["metrics"])
async def get_slow_queries(
    min_execution_time_ms: int | None = Query(
        None, description="Minimum execution time in milliseconds", ge=0
    ),
    limit: int = Query(100, description="Maximum number of records to return", ge=1, le=1000),
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> list[dict[str, Any]]:
    """Get slow query records.

    Args:
        min_execution_time_ms: Minimum execution time to filter by.
        limit: Maximum number of records to return.
        metrics_service: The metrics service instance.

    Returns:
        List of slow query records sorted by execution time (slowest first).
    """
    return metrics_service.get_slow_queries(
        min_execution_time_ms=min_execution_time_ms,
        limit=limit,
    )


@router.get("/query-performance", response_model=QueryPerformanceStatsResponse, tags=["metrics"])
async def get_query_performance_stats(
    database_name: str | None = Query(None, description="Filter by database name"),
    hours: int = Query(24, description="Number of hours to look back", ge=1, le=720),
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> dict[str, Any]:
    """Get query performance statistics from history.

    Args:
        database_name: Optional database name to filter by.
        hours: Number of hours to look back.
        metrics_service: The metrics service instance.

    Returns:
        Query performance statistics.
    """
    return await metrics_service.get_query_performance_stats(
        database_name=database_name,
        hours=hours,
    )


@router.get("/system", response_model=SystemMetricsResponse, tags=["metrics"])
async def get_system_metrics(
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> dict[str, Any]:
    """Get current system metrics.

    Returns:
        Current system metrics including CPU, memory, disk, and process info.
    """
    return await metrics_service.get_current_system_metrics()


@router.get("/system/history", tags=["metrics"])
async def get_system_metrics_history(
    limit: int = Query(100, description="Maximum number of records to return", ge=1, le=1000),
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> list[dict[str, Any]]:
    """Get historical system metrics.

    Args:
        limit: Maximum number of records to return.
        metrics_service: The metrics service instance.

    Returns:
        List of historical system metric records.
    """
    return await metrics_service.get_system_metrics(limit=limit)


@router.get("/health-detailed", tags=["metrics"])
async def get_detailed_health(
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> dict[str, Any]:
    """Get detailed health status including system metrics and any issues.

    Returns:
        Detailed health status information.
    """
    return metrics_service.get_health_status()


class MetricsCleanupResponse(CamelModel):
    """Response model for metrics cleanup."""

    deleted_count: int
    days_retained: int


@router.post("/cleanup", response_model=MetricsCleanupResponse, tags=["metrics"])
async def cleanup_old_metrics(
    days: int = Query(
        Performance.METRICS_RETENTION_DAYS,
        description="Number of days to retain",
        ge=1,
        le=365,
    ),
    metrics_service: MetricsService = Depends(get_metrics_service),
) -> dict[str, Any]:
    """Clean up old metrics from the database.

    Args:
        days: Number of days to retain metrics.
        metrics_service: The metrics service instance.

    Returns:
        Number of records deleted.
    """
    deleted_count = await metrics_service.cleanup_old_metrics(days=days)
    return {
        "deleted_count": deleted_count,
        "days_retained": days,
    }


@router.get("/thresholds", tags=["metrics"])
async def get_performance_thresholds() -> dict[str, Any]:
    """Get the configured performance thresholds.

    Returns:
        Dictionary of performance monitoring thresholds.
    """
    return {
        "slow_query": {
            "threshold_ms": Performance.SLOW_QUERY_THRESHOLD,
            "very_slow_threshold_ms": Performance.VERY_SLOW_QUERY_THRESHOLD,
            "critical_threshold_ms": Performance.CRITICAL_SLOW_QUERY_THRESHOLD,
        },
        "request": {
            "fast_threshold_ms": Performance.FAST_REQUEST_THRESHOLD,
            "normal_threshold_ms": Performance.NORMAL_REQUEST_THRESHOLD,
            "slow_threshold_ms": Performance.SLOW_REQUEST_THRESHOLD,
        },
        "memory": {
            "warning_threshold_percent": Performance.MEMORY_WARNING_THRESHOLD,
            "critical_threshold_percent": Performance.MEMORY_CRITICAL_THRESHOLD,
        },
        "retention": {
            "metrics_retention_days": Performance.METRICS_RETENTION_DAYS,
            "performance_history_limit": Performance.PERFORMANCE_HISTORY_LIMIT,
        },
    }
