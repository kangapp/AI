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
