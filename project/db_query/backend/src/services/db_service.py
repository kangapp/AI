"""Database connection management service."""

import asyncio
import time
from datetime import datetime
from typing import Any, Literal
from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from ..core.constants import Database
from ..core.logging import get_logger
from ..core.sqlite_db import get_db
from ..models.database import (
    ConnectionString,
    DatabaseConnection,
    DatabaseCreateRequest,
    DatabaseDetail,
    DatabaseUpdateRequest,
)


class DatabaseService:
    """Service for managing database connections."""

    def __init__(self) -> None:
        """Initialize the database service."""
        self.logger = get_logger(__name__)
        self.db = get_db()
        self._engines: dict[int, Engine] = {}
        self._engine_last_used: dict[int, float] = {}
        # Start background task to clean up idle engines
        self._cleanup_task: asyncio.Task[None] | None = None

    async def _start_cleanup_task(self) -> None:
        """Start background task to clean up idle engines."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_idle_engines())

    async def _cleanup_idle_engines(self) -> None:
        """Background task to clean up idle engines."""
        self.logger.info("engine_cleanup_started")
        while True:
            try:
                await asyncio.sleep(Database.CLEANUP_INTERVAL)  # Check every 5 minutes
                now = time.time()
                idle_engines = [
                    db_id
                    for db_id, last_used in self._engine_last_used.items()
                    if now - last_used > Database.ENGINE_IDLE_TIMEOUT
                ]
                if idle_engines:
                    self.logger.info("cleaning_idle_engines", count=len(idle_engines))
                for db_id in idle_engines:
                    await self._dispose_engine(db_id)
            except asyncio.CancelledError:
                self.logger.info("engine_cleanup_cancelled")
                break
            except Exception as e:
                # Log but don't stop the cleanup task
                self.logger.error("engine_cleanup_error", error=str(e))

    async def _dispose_engine(self, database_id: int) -> None:
        """Dispose of a database engine.

        Args:
            database_id: The database ID.
        """
        if database_id in self._engines:
            try:
                self._engines[database_id].dispose()
                del self._engines[database_id]
                del self._engine_last_used[database_id]
                self.logger.debug("engine_disposed", database_id=database_id)
            except Exception as e:
                self.logger.warning("engine_dispose_failed", database_id=database_id, error=str(e))

    async def dispose_all(self) -> None:
        """Dispose of all database engines."""
        for db_id in list(self._engines.keys()):
            await self._dispose_engine(db_id)

    async def close(self) -> None:
        """Close the service and cleanup resources."""
        # Cancel cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        # Dispose all engines
        await self.dispose_all()

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

        # Handle sqlite: URLs
        # For sqlite, we need to extract the actual file path
        # Formats: sqlite:///path/to/db.db (3 slashes for relative), sqlite:////path/to/db.db (4 slashes for absolute)
        if parsed.scheme == "sqlite":
            # Extract path after sqlite:/ or sqlite:///
            # Remove sqlite:/ prefix and get the actual path
            path = url
            if path.startswith("sqlite:////"):
                # Absolute path format: sqlite:////Users/path/to/db.db
                path = path[11:]  # Remove "sqlite:////" (length is 11)
            elif path.startswith("sqlite:///"):
                # Relative path format: sqlite:///path/to/db.db
                path = path[10:]  # Remove "sqlite:///" (length is 10)
            elif path.startswith("sqlite://"):
                # Two slash format
                path = path[9:]  # Remove "sqlite://" (length is 9)
            elif path.startswith("sqlite:/"):
                # Single slash format
                path = path[8:]  # Remove "sqlite:/" (length is 8)
            return ConnectionString(
                scheme="sqlite",
                database=path,
                original=url,  # Store original URL for correct redaction
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
        if db_type == "mysql" and "+" not in url:
            # Replace mysql:// with mysql+pymysql://
            return url.replace("mysql://", "mysql+pymysql://", 1)
        # For PostgreSQL, use psycopg2 if available
        if db_type == "postgresql" and "+" not in url:
            # Try postgresql+psycopg2://
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        # For SQLite, ensure proper format for absolute paths
        if db_type == "sqlite":
            # sqlite:///path (3 slashes) is relative, sqlite:////path (4 slashes) is absolute
            # If the path starts with /, it's an absolute path and needs 4 slashes
            if url.startswith("sqlite:///") and len(url) > 11 and url[11] == "/":
                # This is sqlite:///Users/... format (3 slashes but absolute path)
                # Convert to sqlite:////Users/... format (4 slashes for absolute path)
                return "sqlite:////" + url[11:]
            # For relative paths or already correct formats, return as-is
            # sqlite:////path (4 slashes) - absolute path (correct)
            # sqlite:///path (3 slashes, path doesn't start with /) - relative path (correct)
            return url
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
        self.logger.info("creating_database", name=request.name)
        # Check for duplicate name (only active databases)
        existing = await self.db.fetch_one(
            "SELECT id FROM databases WHERE name = :name AND is_active = 1", {"name": request.name}
        )
        if existing:
            raise ValueError(f"Database with name '{request.name}' already exists")

        # Detect database type
        db_type = self._detect_db_type(request.url)
        self.logger.debug("database_type_detected", name=request.name, db_type=db_type)

        # Convert connection URL to use appropriate driver
        connection_url = self._add_driver_to_url(request.url, db_type)

        # Test connection
        try:
            await asyncio.to_thread(self._test_connection, connection_url)
            self.logger.info("connection_test_success", name=request.name)
        except SQLAlchemyError as e:
            self.logger.error("connection_test_failed", name=request.name, error=str(e))
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
        self.logger.info("database_created", name=request.name, id=db_id)
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
        await self.db.execute("DELETE FROM databases WHERE name = :name", {"name": name})

    async def update_database(self, name: str, request: DatabaseUpdateRequest) -> DatabaseDetail:
        """Update a database connection.

        Args:
            name: The current database name.
            request: The update request.

        Returns:
            The updated database connection.

        Raises:
            ValueError: If the database is not found or new name already exists.
        """
        # Check existence
        await self.get_database_by_name(name)

        # Build update query dynamically
        updates: list[str] = []
        params: dict[str, Any] = {"name": name}

        if request.name is not None and request.name != name:
            # Check if new name already exists
            existing = await self.db.fetch_one(
                "SELECT id FROM databases WHERE name = :new_name AND is_active = 1",
                {"new_name": request.name},
            )
            if existing:
                raise ValueError(f"Database with name '{request.name}' already exists")
            updates.append("name = :new_name")
            params["new_name"] = request.name

        if request.url is not None:
            # Detect database type and test connection
            db_type = self._detect_db_type(request.url)
            connection_url = self._add_driver_to_url(request.url, db_type)

            try:
                await asyncio.to_thread(self._test_connection, connection_url)
            except SQLAlchemyError as e:
                raise ValueError(f"Failed to connect to database: {e}") from e

            updates.append("url = :url")
            updates.append("db_type = :db_type")
            updates.append("last_connected_at = :last_connected_at")
            params["url"] = request.url
            params["db_type"] = db_type
            params["last_connected_at"] = datetime.now()

        if not updates:
            # No updates, return current database
            return await self.get_database_by_name(name)

        # Execute update
        await self.db.execute(
            f"UPDATE databases SET {', '.join(updates)} WHERE name = :name", params
        )

        # Return updated database (use new name if changed)
        new_name = request.name if request.name is not None else name
        return await self.get_database_by_name(new_name)

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
            # Start cleanup task on first engine creation
            asyncio.create_task(self._start_cleanup_task())
        # Update last used time
        self._engine_last_used[db_id] = time.time()
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
            "SELECT url, db_type FROM databases WHERE name = :name AND is_active = 1",
            {"name": name},
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
