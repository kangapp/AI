"""Database metadata models."""

from typing import Any

from pydantic import BaseModel, Field

from ..lib.json_encoder import CamelModel


class ColumnMetadata(CamelModel):
    """Column metadata."""

    name: str = Field(..., description="Column name")
    data_type: str = Field(..., description="Native database type (VARCHAR, INTEGER, etc.)")
    is_nullable: bool = Field(..., description="Whether column allows NULL values")
    default_value: str | None = Field(None, description="Default value")
    is_primary_key: bool = Field(default=False, description="Whether column is a primary key")


class TableMetadata(CamelModel):
    """Table metadata."""

    name: str = Field(..., description="Table name")
    schema: str | None = Field(None, description="Schema name (for PostgreSQL)")
    columns: list[ColumnMetadata] = Field(..., description="List of columns")
    row_count_estimate: int | None = Field(None, description="Estimated row count")
    description: str | None = Field(None, description="Table description")


class ViewMetadata(CamelModel):
    """View metadata."""

    name: str = Field(..., description="View name")
    schema: str | None = Field(None, description="Schema name (for PostgreSQL)")
    columns: list[ColumnMetadata] = Field(..., description="List of columns")
    definition: str | None = Field(None, description="View definition SQL")
    description: str | None = Field(None, description="View description")


class MetadataResponse(CamelModel):
    """Response with database metadata."""

    database_name: str = Field(..., description="Database name")
    db_type: str = Field(..., description="Database type (mysql, postgresql, sqlite)")
    tables: list[TableMetadata] = Field(..., description="List of tables")
    views: list[ViewMetadata] = Field(..., description="List of views")
    updated_at: Any = Field(..., description="Last metadata update timestamp")
