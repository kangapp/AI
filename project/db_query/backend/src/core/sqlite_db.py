"""SQLite database layer for storing metadata and connections."""

import os
from pathlib import Path
from typing import Any

import aiosqlite

from .config import get_config


class SQLiteDB:
    """SQLite database connection and schema management."""

    def __init__(self, db_path: Path | None = None) -> None:
        """Initialize the SQLite database connection.

        Args:
            db_path: Path to the SQLite database file. If None, uses config default.
        """
        if db_path is None:
            # Check if DB_PATH is set in environment (for testing)
            env_path = os.environ.get("DB_PATH")
            if env_path and env_path != ":memory:":  # Use env path if set and not :memory:
                db_path = Path(env_path)
            else:
                db_path = get_config().get_resolved_db_path()

        self.db_path = db_path

    async def connect(self) -> aiosqlite.Connection:
        """Create a new database connection.

        Returns:
            An aiosqlite connection object.
        """
        conn = await aiosqlite.connect(self.db_path)
        # Enable foreign keys
        await conn.execute("PRAGMA foreign_keys = ON")
        # Return rows as dictionaries
        conn.row_factory = aiosqlite.Row
        return conn

    async def initialize_schema(self) -> None:
        """Initialize the database schema if it doesn't exist."""
        conn = await self.connect()
        try:
            await self._create_tables(conn)
            await conn.commit()
        finally:
            await conn.close()

    async def _create_tables(self, conn: aiosqlite.Connection) -> None:
        """Create all database tables.

        Args:
            conn: The database connection.
        """
        # Databases table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS databases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                url TEXT NOT NULL,
                db_type TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_connected_at TIMESTAMP,
                metadata_json TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1
            )
        """)

        # Query history table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS query_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                database_id INTEGER NOT NULL,
                database_name TEXT NOT NULL,
                query_type TEXT NOT NULL,
                input_text TEXT NOT NULL,
                generated_sql TEXT,
                executed_sql TEXT,
                row_count INTEGER,
                execution_time_ms INTEGER,
                status TEXT NOT NULL,
                error_message TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
            )
        """)

        # Indexes
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_query_history_db_id
            ON query_history(database_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_query_history_created_at
            ON query_history(created_at DESC)
        """)

    async def execute(self, sql: str, params: dict[str, Any] | None = None) -> aiosqlite.Cursor:
        """Execute a SQL query with optional parameters.

        Args:
            sql: The SQL query to execute.
            params: Optional parameters for the query.

        Returns:
            The cursor object.
        """
        conn = await self.connect()
        try:
            if params:
                cursor = await conn.execute(sql, params)
            else:
                cursor = await conn.execute(sql)
            await conn.commit()
            return cursor
        finally:
            await conn.close()

    async def fetch_one(
        self, sql: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        """Fetch a single row from the database.

        Args:
            sql: The SQL query to execute.
            params: Optional parameters for the query.

        Returns:
            The row as a dictionary, or None if no row is found.
        """
        conn = await self.connect()
        try:
            if params:
                cursor = await conn.execute(sql, params)
            else:
                cursor = await conn.execute(sql)
            row = await cursor.fetchone()
            return dict(row) if row else None
        finally:
            await conn.close()

    async def fetch_all(
        self, sql: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Fetch all rows from the database.

        Args:
            sql: The SQL query to execute.
            params: Optional parameters for the query.

        Returns:
            A list of rows as dictionaries.
        """
        conn = await self.connect()
        try:
            if params:
                cursor = await conn.execute(sql, params)
            else:
                cursor = await conn.execute(sql)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            await conn.close()


# Global database instance
_db: SQLiteDB | None = None


def get_db() -> SQLiteDB:
    """Get the global database instance."""
    global _db
    if _db is None:
        _db = SQLiteDB()
    return _db


async def initialize_database() -> None:
    """Initialize the database schema."""
    db = get_db()
    await db.initialize_schema()
