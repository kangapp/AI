"""Database connection models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from ..lib.json_encoder import CamelModel
from .metadata import TableMetadata, ViewMetadata


class DatabaseCreateRequest(CamelModel):
    """Request to create a new database connection."""

    name: str = Field(..., description="User-friendly name, must be unique")
    url: str = Field(..., description="Full connection string")


class DatabaseConnection(CamelModel):
    """A database connection configuration."""

    id: int
    name: str
    url: str = Field(
        ..., description="Connection string (credentials partially redacted in responses)"
    )
    db_type: Literal["mysql", "postgresql", "sqlite"]
    created_at: datetime
    last_connected_at: datetime | None = None
    is_active: bool = True


class DatabaseDetail(DatabaseConnection):
    """Database connection with cached metadata."""

    tables: list[TableMetadata] = []
    views: list[ViewMetadata] = []
    metadata_updated_at: datetime | None = None
    metadata_json: str | None = None


class DatabaseListResponse(CamelModel):
    """Response containing all database connections."""

    databases: list[DatabaseConnection]
    total_count: int


class ConnectionString(BaseModel):
    """Parsed connection string."""

    scheme: str
    username: str | None = None
    password: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None

    def redact(self) -> str:
        """Return a redacted version of the connection string."""
        if self.username:
            return f"{self.scheme}://***:***@{self.host}:{self.port}/{self.database}"
        return f"{self.scheme}://{self.database}"
