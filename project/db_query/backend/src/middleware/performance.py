"""Performance monitoring middleware for tracking request metrics."""

import time
from collections import deque
from datetime import datetime
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..core.constants import Performance
from ..core.logging import get_logger


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware to track performance metrics for all HTTP requests."""

    def __init__(self, app: ASGIApp) -> None:
        """Initialize the performance middleware.

        Args:
            app: The ASGI application.
        """
        super().__init__(app)
        self.logger = get_logger(__name__)
        # In-memory storage for recent request metrics (circular buffer)
        self._request_history: deque[dict[str, Any]] = deque(
            maxlen=Performance.PERFORMANCE_HISTORY_LIMIT
        )
        # Aggregated metrics
        self._metrics: dict[str, Any] = {
            "total_requests": 0,
            "requests_by_path": {},
            "requests_by_method": {},
            "requests_by_status": {},
            "latency_ms": [],
            "errors": 0,
        }

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process request and track performance metrics.

        Args:
            request: The incoming request.
            call_next: The next middleware or route handler.

        Returns:
            The response from the next handler.
        """
        # Start timing
        start_time = time.time()

        # Get client info
        client_host = request.client.host if request.client else "unknown"

        # Process request and get response
        response: Response = await call_next(request)
        status_code = response.status_code
        error = None

        # Calculate elapsed time
        elapsed_ms = int((time.time() - start_time) * 1000)

        # Determine performance category
        if elapsed_ms < Performance.FAST_REQUEST_THRESHOLD:
            performance_category = "fast"
        elif elapsed_ms < Performance.NORMAL_REQUEST_THRESHOLD:
            performance_category = "normal"
        elif elapsed_ms < Performance.SLOW_REQUEST_THRESHOLD:
            performance_category = "slow"
        else:
            performance_category = "very_slow"

        # Create metric record
        metric = {
            "timestamp": datetime.now().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client_host": client_host,
            "status_code": status_code,
            "elapsed_ms": elapsed_ms,
            "performance_category": performance_category,
            "error": error,
        }

        # Store in history
        self._request_history.append(metric)

        # Update aggregated metrics
        self._update_aggregated_metrics(metric)

        # Log based on performance
        if performance_category == "very_slow":
            self.logger.warning(
                "slow_request_detected",
                method=request.method,
                path=request.url.path,
                elapsed_ms=elapsed_ms,
                status_code=status_code,
            )
        elif status_code >= 400:
            self.logger.warning(
                "request_error",
                method=request.method,
                path=request.url.path,
                elapsed_ms=elapsed_ms,
                status_code=status_code,
                error=error,
            )
        else:
            self.logger.debug(
                "request_completed",
                method=request.method,
                path=request.url.path,
                elapsed_ms=elapsed_ms,
                status_code=status_code,
            )

        return response

    def _update_aggregated_metrics(self, metric: dict[str, Any]) -> None:
        """Update aggregated metrics with a new metric record.

        Args:
            metric: The metric record to add.
        """
        self._metrics["total_requests"] += 1

        # Track by path
        path = metric["path"]
        if path not in self._metrics["requests_by_path"]:
            self._metrics["requests_by_path"][path] = {
                "count": 0,
                "total_latency_ms": 0,
                "errors": 0,
            }
        self._metrics["requests_by_path"][path]["count"] += 1
        self._metrics["requests_by_path"][path]["total_latency_ms"] += metric["elapsed_ms"]
        if metric["status_code"] >= 400:
            self._metrics["requests_by_path"][path]["errors"] += 1

        # Track by method
        method = metric["method"]
        self._metrics["requests_by_method"][method] = (
            self._metrics["requests_by_method"].get(method, 0) + 1
        )

        # Track by status
        status = metric["status_code"]
        self._metrics["requests_by_status"][status] = (
            self._metrics["requests_by_status"].get(status, 0) + 1
        )

        # Track latency values (keep last 1000 for percentile calculation)
        self._metrics["latency_ms"].append(metric["elapsed_ms"])
        if len(self._metrics["latency_ms"]) > 1000:
            self._metrics["latency_ms"].pop(0)

        # Track errors
        if metric["status_code"] >= 400:
            self._metrics["errors"] += 1

    def get_metrics(self) -> dict[str, Any]:
        """Get the current performance metrics.

        Returns:
            A dictionary containing aggregated metrics.
        """
        import copy

        metrics_copy = copy.deepcopy(self._metrics)

        # Calculate percentiles if we have latency data
        if metrics_copy["latency_ms"]:
            sorted_latencies = sorted(metrics_copy["latency_ms"])
            length = len(sorted_latencies)
            metrics_copy["latency_p50"] = sorted_latencies[int(length * 0.5)]
            metrics_copy["latency_p95"] = sorted_latencies[int(length * 0.95)]
            metrics_copy["latency_p99"] = sorted_latencies[int(length * 0.99)]
            metrics_copy["latency_avg"] = sum(sorted_latencies) / length

        # Remove raw latency data to reduce response size
        del metrics_copy["latency_ms"]

        # Calculate average latency per path
        for path_data in metrics_copy["requests_by_path"].values():
            if path_data["count"] > 0:
                path_data["avg_latency_ms"] = (
                    path_data["total_latency_ms"] / path_data["count"]
                )

        # Add recent request history (last 100)
        metrics_copy["recent_requests"] = list(self._request_history)[-100:]

        return metrics_copy

    def get_recent_slow_requests(self, threshold_ms: int | None = None) -> list[dict[str, Any]]:
        """Get recent slow requests.

        Args:
            threshold_ms: Optional threshold in milliseconds. Defaults to SLOW_REQUEST_THRESHOLD.

        Returns:
            List of slow request metrics.
        """
        if threshold_ms is None:
            threshold_ms = Performance.SLOW_REQUEST_THRESHOLD

        return [
            req
            for req in self._request_history
            if req["elapsed_ms"] >= threshold_ms
        ]

    def reset_metrics(self) -> None:
        """Reset all metrics (useful for testing or manual cleanup)."""
        self._request_history.clear()
        self._metrics = {
            "total_requests": 0,
            "requests_by_path": {},
            "requests_by_method": {},
            "requests_by_status": {},
            "latency_ms": [],
            "errors": 0,
        }
        self.logger.info("performance_metrics_reset")
