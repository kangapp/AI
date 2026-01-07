"""Database metadata models."""

from typing import Any

from pydantic import Field

from ..lib.json_encoder import CamelModel


class ColumnMetadata(CamelModel):
    """Column metadata."""

    name: str
    data_type: str = Field(..., description="Native database type (VARCHAR, INTEGER, etc.)")
    is_nullable: bool
    default_value: str | None = None
    is_primary_key: bool = False


class TableMetadata(CamelModel):
    """Table metadata."""

    name: str
    schema: str | None = Field(default=None)  # type: ignore[assignment]
    columns: list[ColumnMetadata]
    row_count_estimate: int | None = Field(default=None)
    description: str | None = Field(default=None)


class ViewMetadata(CamelModel):
    """View metadata."""

    name: str
    schema: str | None = Field(default=None)  # type: ignore[assignment]
    columns: list[ColumnMetadata]
    definition: str | None = Field(default=None)
    description: str | None = Field(default=None)


class MetadataResponse(CamelModel):
    """Response with database metadata."""

    database_name: str
    db_type: str
    tables: list[TableMetadata]
    views: list[ViewMetadata]
    updated_at: Any  # datetime from SQLite
