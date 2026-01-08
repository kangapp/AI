"""Query and error models."""

from datetime import datetime
from typing import Any

from pydantic import Field

from ..lib.json_encoder import CamelModel
from .metadata import ColumnMetadata


class ErrorDetail:
    """Error detail (using dataclass to avoid camelCase on error codes)."""

    code: str
    message: str
    details: str | None = None


class ErrorResponse:
    """Error response."""

    success: bool = False
    error: ErrorDetail


class QueryRequest(CamelModel):
    """Request to execute a SQL query."""

    sql: str = Field(..., description="SQL query to execute")


class QueryResponse(CamelModel):
    """Response from executing a SQL query."""

    success: bool
    executed_sql: str = Field(..., description="The SQL that was executed (may have LIMIT added)")
    row_count: int = Field(..., description="Number of rows returned")
    execution_time_ms: int = Field(..., description="Query execution time in milliseconds")
    columns: list[ColumnMetadata]
    rows: list[dict[str, Any]]
    has_limit: bool = Field(..., description="True if LIMIT was present or added")
    limit_value: int | None = Field(None, description="LIMIT value if present")


class QueryHistoryItem(CamelModel):
    """A query history item."""

    id: int
    database_id: int
    database_name: str
    query_type: str
    input_text: str
    executed_sql: str
    row_count: int | None
    execution_time_ms: int | None
    status: str
    error_message: str | None
    created_at: datetime


class QueryHistoryResponse(CamelModel):
    """Response containing query history."""

    items: list[QueryHistoryItem]
    total_count: int
    page: int
    page_size: int
