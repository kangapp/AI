"""Performance metrics collection and aggregation service."""

import asyncio
import os
import psutil
from collections import deque
from datetime import datetime, timedelta
from typing import Any

from ..core.constants import Performance
from ..core.logging import get_logger
from ..core.sqlite_db import get_db


class MetricsService:
    """Service for collecting and aggregating performance metrics."""

    def __init__(self) -> None:
        """Initialize the metrics service."""
        self.logger = get_logger(__name__)
        self.db = get_db()

        # In-memory storage for system metrics (circular buffer)
        self._system_metrics: deque[dict[str, Any]] = deque(
            maxlen=Performance.PERFORMANCE_HISTORY_LIMIT
        )

        # Background task for collecting system metrics
        self._collection_task: asyncio.Task[None] | None = None

        # Track slow queries
        self._slow_queries: deque[dict[str, Any]] = deque(maxlen=1000)

    async def start_collection(self) -> None:
        """Start the background metrics collection task."""
        if self._collection_task is None or self._collection_task.done():
            self._collection_task = asyncio.create_task(self._collect_system_metrics())
            self.logger.info("metrics_collection_started")

    async def stop_collection(self) -> None:
        """Stop the background metrics collection task."""
        if self._collection_task and not self._collection_task.done():
            self._collection_task.cancel()
            try:
                await self._collection_task
            except asyncio.CancelledError:
                pass
            self.logger.info("metrics_collection_stopped")

    async def _collect_system_metrics(self) -> None:
        """Background task to collect system metrics periodically."""
        while True:
            try:
                await asyncio.sleep(Performance.SYSTEM_METRICS_INTERVAL)
                metrics = await self._get_current_system_metrics()
                self._system_metrics.append(metrics)

                # Log warnings if thresholds exceeded
                memory_percent = metrics["memory"]["percent"]
                if memory_percent >= Performance.MEMORY_CRITICAL_THRESHOLD:
                    self.logger.error(
                        "memory_critical",
                        memory_percent=memory_percent,
                        available_mb=metrics["memory"]["available_mb"],
                    )
                elif memory_percent >= Performance.MEMORY_WARNING_THRESHOLD:
                    self.logger.warning(
                        "memory_warning",
                        memory_percent=memory_percent,
                        available_mb=metrics["memory"]["available_mb"],
                    )

                cpu_percent = metrics["cpu"]["percent"]
                if cpu_percent > 90:
                    self.logger.warning("cpu_high", cpu_percent=cpu_percent)

            except asyncio.CancelledError:
                self.logger.info("system_metrics_collection_cancelled")
                break
            except Exception as e:
                self.logger.error("system_metrics_collection_error", error=str(e))

    async def _get_current_system_metrics(self) -> dict[str, Any]:
        """Get current system metrics.

        Returns:
            Dictionary containing current system metrics.
        """
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()

        # Memory metrics
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()

        # Disk metrics (root partition)
        disk = psutil.disk_usage("/")

        # Process metrics
        process = psutil.Process()
        process_memory = process.memory_info()

        return {
            "timestamp": datetime.now().isoformat(),
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
            },
            "memory": {
                "percent": memory.percent,
                "total_mb": round(memory.total / 1024 / 1024, 2),
                "available_mb": round(memory.available / 1024 / 1024, 2),
                "used_mb": round(memory.used / 1024 / 1024, 2),
                "swap_percent": swap.percent,
                "swap_total_mb": round(swap.total / 1024 / 1024, 2),
                "swap_used_mb": round(swap.used / 1024 / 1024, 2),
            },
            "disk": {
                "percent": disk.percent,
                "total_gb": round(disk.total / 1024 / 1024 / 1024, 2),
                "used_gb": round(disk.used / 1024 / 1024 / 1024, 2),
                "free_gb": round(disk.free / 1024 / 1024 / 1024, 2),
            },
            "process": {
                "pid": process.pid,
                "memory_mb": round(process_memory.rss / 1024 / 1024, 2),
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "num_fds": process.num_fds() if hasattr(process, "num_fds") else 0,
            },
        }

    async def get_system_metrics(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get recent system metrics.

        Args:
            limit: Maximum number of metrics to return.

        Returns:
            List of system metric records.
        """
        return list(self._system_metrics)[-limit:]

    async def get_current_system_metrics(self) -> dict[str, Any]:
        """Get the current system metrics.

        Returns:
            Dictionary containing current system metrics.
        """
        return await self._get_current_system_metrics()

    async def record_slow_query(
        self,
        database_name: str,
        query_type: str,
        sql: str,
        execution_time_ms: int,
        row_count: int | None,
    ) -> None:
        """Record a slow query for monitoring.

        Args:
            database_name: The database name.
            query_type: The query type (sql or natural).
            sql: The executed SQL.
            execution_time_ms: The execution time in milliseconds.
            row_count: The number of rows returned.
        """
        slow_query_record = {
            "timestamp": datetime.now().isoformat(),
            "database_name": database_name,
            "query_type": query_type,
            "sql": sql[:500] if len(sql) > 500 else sql,  # Truncate long queries
            "execution_time_ms": execution_time_ms,
            "row_count": row_count,
        }

        self._slow_queries.append(slow_query_record)

        # Log based on severity
        if execution_time_ms >= Performance.CRITICAL_SLOW_QUERY_THRESHOLD:
            self.logger.error(
                "critical_slow_query",
                database=database_name,
                query_type=query_type,
                execution_time_ms=execution_time_ms,
            )
        elif execution_time_ms >= Performance.VERY_SLOW_QUERY_THRESHOLD:
            self.logger.warning(
                "very_slow_query",
                database=database_name,
                query_type=query_type,
                execution_time_ms=execution_time_ms,
            )
        else:
            self.logger.info(
                "slow_query",
                database=database_name,
                query_type=query_type,
                execution_time_ms=execution_time_ms,
            )

    def get_slow_queries(
        self,
        min_execution_time_ms: int | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get slow query records.

        Args:
            min_execution_time_ms: Minimum execution time to filter by.
            limit: Maximum number of records to return.

        Returns:
            List of slow query records.
        """
        queries = list(self._slow_queries)

        if min_execution_time_ms is not None:
            queries = [
                q
                for q in queries
                if q["execution_time_ms"] >= min_execution_time_ms
            ]

        # Sort by execution time (slowest first) and limit
        queries.sort(key=lambda x: x["execution_time_ms"], reverse=True)
        return queries[:limit]

    async def get_query_performance_stats(
        self,
        database_name: str | None = None,
        hours: int = 24,
    ) -> dict[str, Any]:
        """Get query performance statistics from history.

        Args:
            database_name: Optional database name to filter by.
            hours: Number of hours to look back.

        Returns:
            Dictionary containing query performance statistics.
        """
        since = datetime.now() - timedelta(hours=hours)

        if database_name:
            rows = await self.db.fetch_all(
                """
                SELECT
                    COUNT(*) as total_queries,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_queries,
                    COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_queries,
                    AVG(execution_time_ms) as avg_execution_time_ms,
                    MIN(execution_time_ms) as min_execution_time_ms,
                    MAX(execution_time_ms) as max_execution_time_ms,
                    SUM(row_count) as total_rows,
                    COUNT(CASE WHEN execution_time_ms >= :slow_threshold THEN 1 END) as slow_queries
                FROM query_history
                WHERE database_name = :database_name
                    AND created_at >= :since
                """,
                {
                    "database_name": database_name,
                    "since": since,
                    "slow_threshold": Performance.SLOW_QUERY_THRESHOLD,
                },
            )
        else:
            rows = await self.db.fetch_all(
                """
                SELECT
                    COUNT(*) as total_queries,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_queries,
                    COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_queries,
                    AVG(execution_time_ms) as avg_execution_time_ms,
                    MIN(execution_time_ms) as min_execution_time_ms,
                    MAX(execution_time_ms) as max_execution_time_ms,
                    SUM(row_count) as total_rows,
                    COUNT(CASE WHEN execution_time_ms >= :slow_threshold THEN 1 END) as slow_queries
                FROM query_history
                WHERE created_at >= :since
                """,
                {
                    "since": since,
                    "slow_threshold": Performance.SLOW_QUERY_THRESHOLD,
                },
            )

        if not rows or not rows[0]:
            return {
                "total_queries": 0,
                "successful_queries": 0,
                "failed_queries": 0,
                "success_rate": 0.0,
                "avg_execution_time_ms": 0,
                "min_execution_time_ms": 0,
                "max_execution_time_ms": 0,
                "total_rows": 0,
                "slow_queries": 0,
                "slow_query_rate": 0.0,
            }

        row = rows[0]
        total_queries = row["total_queries"] or 0

        return {
            "total_queries": total_queries,
            "successful_queries": row["successful_queries"] or 0,
            "failed_queries": row["failed_queries"] or 0,
            "success_rate": round(
                (row["successful_queries"] or 0) / total_queries * 100, 2
            ) if total_queries > 0 else 0.0,
            "avg_execution_time_ms": round(row["avg_execution_time_ms"] or 0, 2),
            "min_execution_time_ms": row["min_execution_time_ms"] or 0,
            "max_execution_time_ms": row["max_execution_time_ms"] or 0,
            "total_rows": row["total_rows"] or 0,
            "slow_queries": row["slow_queries"] or 0,
            "slow_query_rate": round(
                (row["slow_queries"] or 0) / total_queries * 100, 2
            ) if total_queries > 0 else 0.0,
        }

    async def cleanup_old_metrics(self, days: int = Performance.METRICS_RETENTION_DAYS) -> int:
        """Clean up old metrics from the database.

        Args:
            days: Number of days to retain metrics.

        Returns:
            Number of records deleted.
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Clean up old query history
        cursor = await self.db.execute(
            """
            DELETE FROM query_history
            WHERE created_at < :cutoff
            """,
            {"cutoff": cutoff},
        )

        # Get rowcount from cursor
        deleted_count = cursor.rowcount if hasattr(cursor, 'rowcount') else 0

        self.logger.info(
            "old_metrics_cleaned",
            days=days,
            deleted_count=deleted_count,
        )
        return deleted_count

    def get_health_status(self) -> dict[str, Any]:
        """Get the current health status of the application.

        Returns:
            Dictionary containing health status information.
        """
        # Get latest system metrics
        latest_metrics = (
            self._system_metrics[-1] if self._system_metrics else None
        )

        status = "healthy"
        issues = []

        if latest_metrics:
            # Check memory
            memory_percent = latest_metrics["memory"]["percent"]
            if memory_percent >= Performance.MEMORY_CRITICAL_THRESHOLD:
                status = "critical"
                issues.append({
                    "type": "memory_critical",
                    "message": f"Memory usage is at {memory_percent}%",
                })
            elif memory_percent >= Performance.MEMORY_WARNING_THRESHOLD:
                if status != "critical":
                    status = "warning"
                issues.append({
                    "type": "memory_warning",
                    "message": f"Memory usage is at {memory_percent}%",
                })

            # Check CPU
            cpu_percent = latest_metrics["cpu"]["percent"]
            if cpu_percent > 90:
                if status != "critical":
                    status = "warning"
                issues.append({
                    "type": "cpu_high",
                    "message": f"CPU usage is at {cpu_percent}%",
                })

            # Check disk
            disk_percent = latest_metrics["disk"]["percent"]
            if disk_percent > 90:
                if status != "critical":
                    status = "warning"
                issues.append({
                    "type": "disk_full",
                    "message": f"Disk usage is at {disk_percent}%",
                })

        return {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "issues": issues,
            "system_metrics": latest_metrics,
            "slow_query_count": len(self._slow_queries),
        }
