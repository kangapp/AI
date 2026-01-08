"""Database connection management service."""

import asyncio
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from ..core.sqlite_db import get_db
from ..models.database import (
    ConnectionString,
    DatabaseConnection,
    DatabaseCreateRequest,
    DatabaseDetail,
)


class DatabaseService:
    """Service for managing database connections."""

    def __init__(self) -> None:
        """Initialize the database service."""
        self.db = get_db()
        self._engines: dict[int, Engine] = {}

    def _detect_db_type(self, url: str) -> Literal["mysql", "postgresql", "sqlite"]:
        """Detect the database type from connection string.

        Args:
            url: The connection string.

        Returns:
            The database type.
        """
        url_lower = url.lower()
        if url_lower.startswith("mysql://") or url_lower.startswith("mysql+"):
            return "mysql"
        if url_lower.startswith("postgres://") or url_lower.startswith("postgresql://"):
            return "postgresql"
        if url_lower.startswith("sqlite://") or url_lower.startswith("sqlite:///"):
            return "sqlite"
        # Default to postgresql for postgres://
        if url_lower.startswith("postgres://"):
            return "postgresql"
        raise ValueError(f"Unsupported database type in connection string: {url}")

    def _parse_connection_string(self, url: str) -> ConnectionString:
        """Parse a connection string into components.

        Args:
            url: The connection string.

        Returns:
            A ConnectionString object.
        """
        parsed = urlparse(url)

        # Handle sqlite:///path/to/file.db
        if parsed.scheme == "sqlite" or url.startswith("sqlite:///"):
            path = url.replace("sqlite:///", "").replace("sqlite://", "")
            return ConnectionString(
                scheme="sqlite",
                database=path,
            )

        return ConnectionString(
            scheme=parsed.scheme,
            username=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path.lstrip("/") if parsed.path else None,
        )

    def _add_driver_to_url(self, url: str, db_type: str) -> str:
        """Add appropriate SQLAlchemy driver to the connection URL.

        Args:
            url: The connection URL.
            db_type: The database type.

        Returns:
            The connection URL with the appropriate driver.
        """
        # For MySQL, use pymysql driver
        if db_type == "mysql" and not "+" in url:
            # Replace mysql:// with mysql+pymysql://
            return url.replace("mysql://", "mysql+pymysql://", 1)
        # For PostgreSQL, use psycopg2 if available
        if db_type == "postgresql" and not "+" in url:
            # Try postgresql+psycopg2://
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        # For SQLite, no driver needed
        return url

    def _test_connection(self, url: str) -> bool:
        """Test a database connection.

        Args:
            url: The connection string.

        Returns:
            True if connection succeeds.

        Raises:
            SQLAlchemyError: If connection fails.
        """
        engine = create_engine(url)
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        finally:
            engine.dispose()

    async def create_database(self, request: DatabaseCreateRequest) -> DatabaseDetail:
        """Create a new database connection.

        Args:
            request: The database creation request.

        Returns:
            The created database connection.

        Raises:
            ValueError: If the name already exists or connection fails.
        """
        # Check for duplicate name (only active databases)
        existing = await self.db.fetch_one(
            "SELECT id FROM databases WHERE name = :name AND is_active = 1", {"name": request.name}
        )
        if existing:
            raise ValueError(f"Database with name '{request.name}' already exists")

        # Detect database type
        db_type = self._detect_db_type(request.url)

        # Convert connection URL to use appropriate driver
        connection_url = self._add_driver_to_url(request.url, db_type)

        # Test connection
        try:
            await asyncio.to_thread(self._test_connection, connection_url)
        except SQLAlchemyError as e:
            raise ValueError(f"Failed to connect to database: {e}") from e

        # Insert into database (store original URL, not the one with driver)
        now = datetime.now()
        cursor = await self.db.execute(
            """
            INSERT INTO databases (name, url, db_type, last_connected_at)
            VALUES (:name, :url, :db_type, :last_connected_at)
            """,
            {
                "name": request.name,
                "url": request.url,
                "db_type": db_type,
                "last_connected_at": now,
            },
        )

        db_id = cursor.lastrowid or 0
        return await self.get_database_by_id(db_id)

    async def list_databases(self) -> list[DatabaseConnection]:
        """List all database connections.

        Returns:
            List of all database connections.
        """
        rows = await self.db.fetch_all(
            "SELECT * FROM databases WHERE is_active = 1 ORDER BY created_at"
        )
        result = []
        for row in rows:
            # Parse connection string for redaction
            parsed = self._parse_connection_string(row["url"])
            row["url"] = parsed.redact()

            # Convert SQLite strings to proper types
            row["created_at"] = datetime.fromisoformat(row["created_at"])
            if row["last_connected_at"]:
                row["last_connected_at"] = datetime.fromisoformat(row["last_connected_at"])
            row["is_active"] = bool(row["is_active"])

            result.append(DatabaseConnection(**row))
        return result

    async def get_database_by_id(self, db_id: int) -> DatabaseDetail:
        """Get a database by ID.

        Args:
            db_id: The database ID.

        Returns:
            The database connection.

        Raises:
            ValueError: If the database is not found.
        """
        row = await self.db.fetch_one("SELECT * FROM databases WHERE id = :id", {"id": db_id})
        if not row:
            raise ValueError(f"Database with id {db_id} not found")

        # Parse connection string for redaction
        parsed = self._parse_connection_string(row["url"])
        row["url"] = parsed.redact()

        # Convert SQLite strings to proper types
        row["created_at"] = datetime.fromisoformat(row["created_at"])
        if row["last_connected_at"]:
            row["last_connected_at"] = datetime.fromisoformat(row["last_connected_at"])
        row["is_active"] = bool(row["is_active"])

        return DatabaseDetail(**row)

    async def get_database_by_name(self, name: str) -> DatabaseDetail:
        """Get a database by name.

        Args:
            name: The database name.

        Returns:
            The database connection.

        Raises:
            ValueError: If the database is not found.
        """
        row = await self.db.fetch_one("SELECT * FROM databases WHERE name = :name", {"name": name})
        if not row:
            raise ValueError(f"Database '{name}' not found")

        # Parse connection string for redaction
        parsed = self._parse_connection_string(row["url"])
        row["url"] = parsed.redact()

        # Convert SQLite strings to proper types
        row["created_at"] = datetime.fromisoformat(row["created_at"])
        if row["last_connected_at"]:
            row["last_connected_at"] = datetime.fromisoformat(row["last_connected_at"])
        row["is_active"] = bool(row["is_active"])

        return DatabaseDetail(**row)

    async def delete_database(self, name: str) -> None:
        """Delete a database connection.

        Args:
            name: The database name.

        Raises:
            ValueError: If the database is not found.
        """
        # Check existence
        await self.get_database_by_name(name)

        # Hard delete (remove the record entirely)
        await self.db.execute(
            "DELETE FROM databases WHERE name = :name", {"name": name}
        )

    def get_engine(self, db_id: int, url: str) -> Engine:
        """Get or create a SQLAlchemy engine for the database.

        Args:
            db_id: The database ID.
            url: The connection string (should include driver).

        Returns:
            A SQLAlchemy engine.
        """
        if db_id not in self._engines:
            self._engines[db_id] = create_engine(url)
        return self._engines[db_id]

    async def get_connection_url_with_driver(self, name: str) -> str:
        """Get the connection string with the appropriate driver.

        Args:
            name: The database name.

        Returns:
            The connection string with driver.

        Raises:
            ValueError: If the database is not found.
        """
        row = await self.db.fetch_one(
            "SELECT url, db_type FROM databases WHERE name = :name AND is_active = 1", {"name": name}
        )
        if not row:
            raise ValueError(f"Database '{name}' not found")
        url = row["url"] if isinstance(row["url"], str) else str(row["url"])
        db_type = row["db_type"]
        return self._add_driver_to_url(url, db_type)

    async def get_original_url(self, name: str) -> str:
        """Get the original (non-redacted) connection string.

        Args:
            name: The database name.

        Returns:
            The original connection string.

        Raises:
            ValueError: If the database is not found.
        """
        row = await self.db.fetch_one(
            "SELECT url FROM databases WHERE name = :name AND is_active = 1", {"name": name}
        )
        if not row:
            raise ValueError(f"Database '{name}' not found")
        url = row["url"]
        return url if isinstance(url, str) else str(url)
