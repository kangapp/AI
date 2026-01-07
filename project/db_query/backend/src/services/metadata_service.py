"""Metadata extraction and caching service."""

from datetime import datetime
from typing import Any

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from ..core.sqlite_db import get_db
from ..models.database import DatabaseDetail
from ..models.metadata import (
    ColumnMetadata,
    MetadataResponse,
    TableMetadata,
    ViewMetadata,
)


class MetadataService:
    """Service for extracting and caching database metadata."""

    def __init__(self) -> None:
        """Initialize the metadata service."""
        self.db = get_db()

    async def fetch_metadata(
        self, database: DatabaseDetail, engine: Engine, force_refresh: bool = False
    ) -> MetadataResponse:
        """Fetch metadata for a database.

        Args:
            database: The database connection details.
            engine: The SQLAlchemy engine for the database.
            force_refresh: If True, refresh metadata even if cached.

        Returns:
            The metadata response.
        """
        # Check if we have cached metadata
        if not force_refresh and database.metadata_updated_at:
            # Return cached metadata from database
            if database.metadata_json:
                import json

                cached = json.loads(database.metadata_json)
                return MetadataResponse(
                    database_name=database.name,
                    db_type=database.db_type,
                    tables=[TableMetadata(**t) for t in cached.get("tables", [])],
                    views=[ViewMetadata(**v) for v in cached.get("views", [])],
                    updated_at=database.metadata_updated_at,
                )

        # Fetch fresh metadata
        tables = await self._fetch_tables(engine, database.db_type)
        views = await self._fetch_views(engine, database.db_type)

        # Cache in database
        import json

        metadata_json = json.dumps(
            {
                "tables": [t.model_dump(mode="json") for t in tables],
                "views": [v.model_dump(mode="json") for v in views],
            }
        )

        await self.db.execute(
            """
            UPDATE databases
            SET metadata_json = :metadata_json,
                last_connected_at = :now
            WHERE id = :id
            """,
            {
                "id": database.id,
                "metadata_json": metadata_json,
                "now": datetime.now(),
            },
        )

        return MetadataResponse(
            database_name=database.name,
            db_type=database.db_type,
            tables=tables,
            views=views,
            updated_at=datetime.now(),
        )

    async def _fetch_tables(self, engine: Engine, db_type: str) -> list[TableMetadata]:
        """Fetch table metadata from the database.

        Args:
            engine: The SQLAlchemy engine.
            db_type: The database type.

        Returns:
            List of table metadata.
        """
        tables = []

        try:
            with engine.connect() as conn:
                # Query for tables
                if db_type == "sqlite":
                    result = conn.execute(
                        text(
                            """
                            SELECT name as table_name, '' as table_schema
                            FROM sqlite_master
                            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                            ORDER BY name
                            """
                        )
                    )
                else:  # MySQL and PostgreSQL use Information Schema
                    result = conn.execute(
                        text(
                            """
                            SELECT table_name, table_schema
                            FROM information_schema.tables
                            WHERE table_type = 'BASE TABLE'
                            AND table_schema NOT IN ('pg_catalog', 'information_schema', 'mysql', 'performance_schema', 'sys')
                            ORDER BY table_name
                            """
                        )
                    )

                for row in result:
                    table_name = row[0]
                    schema_name = row[1] if row[1] else None

                    # Fetch columns for this table
                    columns = await self._fetch_columns(conn, table_name, schema_name, db_type)

                    tables.append(
                        TableMetadata(
                            name=table_name,
                            schema=schema_name,
                            columns=columns,
                        )
                    )
        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to fetch table metadata: {e}") from e

        return tables

    async def _fetch_views(self, engine: Engine, db_type: str) -> list[ViewMetadata]:
        """Fetch view metadata from the database.

        Args:
            engine: The SQLAlchemy engine.
            db_type: The database type.

        Returns:
            List of view metadata.
        """
        views = []

        try:
            with engine.connect() as conn:
                # Query for views
                if db_type == "sqlite":
                    result = conn.execute(
                        text(
                            """
                            SELECT name as view_name, sql as view_definition, '' as view_schema
                            FROM sqlite_master
                            WHERE type = 'view'
                            ORDER BY name
                            """
                        )
                    )
                else:
                    result = conn.execute(
                        text(
                            """
                            SELECT table_name as view_name, '' as view_definition, table_schema as view_schema
                            FROM information_schema.views
                            WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'mysql', 'performance_schema', 'sys')
                            ORDER BY table_name
                            """
                        )
                    )

                for row in result:
                    view_name = row[0]
                    view_definition = row[1] if row[1] else None
                    schema_name = row[2] if row[2] else None

                    # Fetch columns for this view
                    columns = await self._fetch_columns(conn, view_name, schema_name, db_type)

                    views.append(
                        ViewMetadata(
                            name=view_name,
                            schema=schema_name,
                            columns=columns,
                            definition=view_definition,
                        )
                    )
        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to fetch view metadata: {e}") from e

        return views

    async def _fetch_columns(
        self, conn: Any, table_name: str, schema_name: str | None, db_type: str
    ) -> list[ColumnMetadata]:
        """Fetch column metadata for a table or view.

        Args:
            conn: The SQLAlchemy connection.
            table_name: The table or view name.
            schema_name: The schema name.
            db_type: The database type.

        Returns:
            List of column metadata.
        """
        columns = []

        if db_type == "sqlite":
            result = conn.execute(
                text(f"PRAGMA table_info('{table_name}')"),
            )
            for row in result:
                # PRAGMA table_info returns: cid, name, type, notnull, default_value, pk
                columns.append(
                    ColumnMetadata(
                        name=row[1],
                        data_type=row[2] or "ANY",
                        is_nullable=not row[3],
                        default_value=row[4],
                        is_primary_key=row[5] > 0,
                    )
                )
        else:
            # MySQL and PostgreSQL use Information Schema
            schema_filter = f"AND table_schema = '{schema_name}'" if schema_name else ""

            result = conn.execute(
                text(
                    f"""
                    SELECT
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        CASE
                            WHEN EXISTS (
                                SELECT 1 FROM information_schema.key_column_usage kcu
                                WHERE kcu.table_name = :table_name
                                AND kcu.column_name = columns.column_name
                                {"AND kcu.table_schema = '" + schema_name + "'" if schema_name else ""}
                                AND kcu.constraint_type = 'PRIMARY KEY'
                            ) THEN 1
                            ELSE 0
                        END as is_primary_key
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                    {schema_filter}
                    ORDER BY ordinal_position
                    """
                ),
                {"table_name": table_name},
            )

            for row in result:
                columns.append(
                    ColumnMetadata(
                        name=row[0],
                        data_type=row[1],
                        is_nullable=row[2].upper() == "YES",
                        default_value=row[3],
                        is_primary_key=bool(row[4]),
                    )
                )

        return columns
