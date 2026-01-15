"""Database connection models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from ..core.constants import Validation
from ..lib.json_encoder import CamelModel
from .metadata import TableMetadata, ViewMetadata


class DatabaseCreateRequest(CamelModel):
    """Request to create a new database connection."""

    name: str = Field(
        ...,
        min_length=Validation.DATABASE_NAME_MIN_LENGTH,
        max_length=Validation.DATABASE_NAME_MAX_LENGTH,
        description="User-friendly name, must be unique",
    )
    url: str = Field(
        ...,
        min_length=Validation.DATABASE_URL_MIN_LENGTH,
        max_length=Validation.DATABASE_URL_MAX_LENGTH,
        description="Full connection string",
    )


class DatabaseUpdateRequest(CamelModel):
    """Request to update a database connection."""

    name: str | None = Field(
        None,
        min_length=Validation.DATABASE_NAME_MIN_LENGTH,
        max_length=Validation.DATABASE_NAME_MAX_LENGTH,
        description="New user-friendly name",
    )
    url: str | None = Field(
        None,
        min_length=Validation.DATABASE_URL_MIN_LENGTH,
        max_length=Validation.DATABASE_URL_MAX_LENGTH,
        description="New connection string",
    )


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
    original: str | None = None  # Store original URL for correct redaction

    def redact(self) -> str:
        """Return a redacted version of the connection string."""
        # For SQLite, return original URL if available (preserves correct slash count)
        if self.scheme == "sqlite" and self.original:
            return self.original
        # For other databases, redact credentials
        if self.username:
            host_port = f"{self.host}:{self.port}" if self.port is not None else self.host
            return f"{self.scheme}://***:***@{host_port}/{self.database}"
        # Fallback for SQLite without original
        if self.scheme == "sqlite":
            # Determine if path is absolute (starts with / on Unix or drive letter on Windows)
            is_absolute = self.database and (
                self.database.startswith("/") or
                (len(self.database) >= 2 and self.database[0].isalpha() and self.database[1] == ":")
            )
            if is_absolute:
                return f"{self.scheme}////{self.database}"  # 4 slashes for absolute
            return f"{self.scheme}///{self.database}"  # 3 slashes for relative
        return f"{self.scheme}://{self.database}"
