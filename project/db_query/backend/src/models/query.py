"""Query and error models."""

from datetime import datetime
from typing import Any

from pydantic import Field

from ..lib.json_encoder import CamelModel
from .metadata import ColumnMetadata


class ErrorDetail(CamelModel):
    """Error detail."""

    code: str = Field(..., description="Error code (e.g., SQL_SYNTAX_ERROR, CONNECTION_FAILED)")
    message: str = Field(..., description="Human-readable error message")
    details: str | None = Field(None, description="Additional error details")


class ErrorResponse(CamelModel):
    """Error response."""

    success: bool = False
    error: ErrorDetail


class QueryRequest(CamelModel):
    """Request to execute a SQL query."""

    sql: str = Field(..., description="SQL query to execute")


class NaturalQueryRequest(CamelModel):
    """Request to generate SQL from natural language."""

    prompt: str = Field(..., description="Natural language query description")
    execute_immediately: bool = Field(
        default=False, description="If true, execute without confirmation"
    )


class NaturalQueryResponse(CamelModel):
    """Response from natural language to SQL generation."""

    success: bool
    generated_sql: str = Field(..., description="The generated SQL query")
    explanation: str | None = Field(None, description="Optional explanation of the query")
    is_valid: bool = Field(..., description="Whether the SQL is syntactically valid")
    validation_message: str | None = Field(None, description="Validation error if invalid")
    # Optional query result data when execute_immediately is true
    row_count: int | None = Field(None, description="Number of rows returned if executed")
    execution_time_ms: int | None = Field(None, description="Execution time in ms if executed")
    columns: list[ColumnMetadata] | None = Field(None, description="Column metadata if executed")
    rows: list[dict[str, Any]] | None = Field(None, description="Query results if executed")


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


class ExportRequest(CamelModel):
    """Request to export query results."""

    sql: str = Field(..., description="SQL query to execute")
    format: str = Field(..., description="Export format: 'csv' or 'json'")
    include_headers: bool = Field(default=True, description="Include column headers")


class ExportResponse(CamelModel):
    """Response with exported data."""

    content: str = Field(..., description="Exported data as string")
    content_type: str = Field(..., description="MIME type for download")
    filename: str = Field(..., description="Suggested filename")
