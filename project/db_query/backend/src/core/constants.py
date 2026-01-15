"""Application constants."""

from datetime import timedelta


class Database:
    """Database-related constants."""

    ENGINE_IDLE_TIMEOUT = 3600  # seconds (1 hour)
    CLEANUP_INTERVAL = 300  # seconds (5 minutes)


class Query:
    """Query-related constants."""

    DEFAULT_LIMIT = 1000
    QUERY_TIMEOUT = 30  # seconds
    TYPE_INFERENCE_SAMPLE_ROWS = 100  # rows to check for type inference


class Pagination:
    """Pagination-related constants."""

    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100


class Metadata:
    """Metadata-related constants."""

    CACHE_TTL = timedelta(hours=1)  # metadata cache time-to-live


class Validation:
    """Validation-related constants."""

    # Database name
    DATABASE_NAME_MIN_LENGTH = 1
    DATABASE_NAME_MAX_LENGTH = 100

    # Connection URL
    DATABASE_URL_MIN_LENGTH = 10
    DATABASE_URL_MAX_LENGTH = 2000

    # SQL query
    SQL_QUERY_MIN_LENGTH = 1
    SQL_QUERY_MAX_LENGTH = 100_000

    # Natural language prompt
    PROMPT_MIN_LENGTH = 1
    PROMPT_MAX_LENGTH = 5_000


class Performance:
    """Performance monitoring-related constants."""

    # Slow query thresholds (in milliseconds)
    SLOW_QUERY_THRESHOLD = 1000  # 1 second
    VERY_SLOW_QUERY_THRESHOLD = 5000  # 5 seconds
    CRITICAL_SLOW_QUERY_THRESHOLD = 10000  # 10 seconds

    # Request performance thresholds (in milliseconds)
    FAST_REQUEST_THRESHOLD = 100  # < 100ms is fast
    NORMAL_REQUEST_THRESHOLD = 500  # < 500ms is normal
    SLOW_REQUEST_THRESHOLD = 1000  # >= 1s is slow

    # Memory monitoring
    MEMORY_WARNING_THRESHOLD = 80  # 80% memory usage
    MEMORY_CRITICAL_THRESHOLD = 90  # 90% memory usage

    # Performance metrics retention
    METRICS_RETENTION_DAYS = 30  # Keep metrics for 30 days
    PERFORMANCE_HISTORY_LIMIT = 1000  # Max records to keep in memory

    # Alert thresholds
    HIGH_ERROR_RATE_THRESHOLD = 0.05  # 5% error rate
    HIGH_LATENCY_P95_THRESHOLD = 2000  # P95 latency > 2s

    # Monitoring intervals
    SYSTEM_METRICS_INTERVAL = 60  # Collect system metrics every 60 seconds
    PERFORMANCE_STATS_INTERVAL = 300  # Calculate performance stats every 5 minutes
