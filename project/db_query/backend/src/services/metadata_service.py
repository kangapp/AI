"""Metadata extraction and caching service."""

import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from ..core.constants import Metadata
from ..core.logging import get_logger
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

    # SQL identifier pattern - only alphanumeric, underscore, and $ allowed
    _SQL_IDENTIFIER_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_$]*$")

    def __init__(self) -> None:
        """Initialize the metadata service."""
        self.logger = get_logger(__name__)
        self.db = get_db()

    @classmethod
    def _validate_identifier(cls, identifier: str | None) -> str | None:
        """Validate a SQL identifier to prevent injection.

        Args:
            identifier: The identifier to validate.

        Returns:
            The validated identifier, or None if invalid or empty.

        Raises:
            ValueError: If the identifier contains invalid characters.
        """
        if not identifier:
            return None
        if not cls._SQL_IDENTIFIER_PATTERN.match(identifier):
            raise ValueError(
                f"Invalid SQL identifier: '{identifier}'. "
                "Only alphanumeric characters, underscores, and $ are allowed."
            )
        return identifier

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
        self.logger.info("fetching_metadata", database=database.name, force_refresh=force_refresh)

        # Check if we have cached metadata and if it's still valid
        if not force_refresh and database.metadata_updated_at:
            # Convert metadata_updated_at to datetime if it's a string
            updated_at = database.metadata_updated_at
            if isinstance(updated_at, str):
                # Try to parse ISO format string
                try:
                    updated_at = datetime.fromisoformat(updated_at)
                except (ValueError, TypeError):
                    # If parsing fails, treat as no cache
                    updated_at = None

            if updated_at is not None:
                # Check if cache is still within TTL
                cache_age = datetime.now() - updated_at
                if cache_age < Metadata.CACHE_TTL and database.metadata_json:
                    # Return cached metadata from database
                    import json

                    self.logger.debug("using_cached_metadata", database=database.name, cache_age_seconds=int(cache_age.total_seconds()))
                    cached = json.loads(database.metadata_json)
                    return MetadataResponse(
                        database_name=database.name,
                        db_type=database.db_type,
                        tables=[TableMetadata(**t) for t in cached.get("tables", [])],
                        views=[ViewMetadata(**v) for v in cached.get("views", [])],
                        updated_at=updated_at,
                    )

        # Extract database name from connection URL
        # For MySQL/PostgreSQL, the database name is in the URL path
        # For SQLite, the database name is the file path
        database_schema = None
        if database.db_type in ("mysql", "postgresql"):
            try:
                # Parse the URL to get the database name
                # The URL stored in database is the original one without driver
                # We need to get it from the service
                from .db_service import DatabaseService

                db_svc = DatabaseService()
                original_url = await db_svc.get_original_url(database.name)
                parsed = urlparse(original_url)
                database_schema = parsed.path.lstrip("/") if parsed.path else None
            except Exception:
                # If we can't parse the URL, fall back to querying all schemas
                database_schema = None

        # Fetch fresh metadata
        tables = await self._fetch_tables(engine, database.db_type, database_schema)
        views = await self._fetch_views(engine, database.db_type, database_schema)

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

        self.logger.info(
            "metadata_fetched",
            database=database.name,
            tables_count=len(tables),
            views_count=len(views),
        )

        return MetadataResponse(
            database_name=database.name,
            db_type=database.db_type,
            tables=tables,
            views=views,
            updated_at=datetime.now(),
        )

    async def _fetch_tables(
        self, engine: Engine, db_type: str, database_schema: str | None = None
    ) -> list[TableMetadata]:
        """Fetch table metadata from the database.

        Args:
            engine: The SQLAlchemy engine.
            db_type: The database type.
            database_schema: The specific database/schema to query (for MySQL/PostgreSQL).

        Returns:
            List of table metadata.
        """
        tables = []

        # Validate schema name to prevent SQL injection
        database_schema = self._validate_identifier(database_schema)

        try:
            with engine.connect() as conn:
                # Query for all tables at once
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
                    # Build the query with optional database filter
                    if database_schema:
                        query = f"""
                            SELECT table_name, table_schema
                            FROM information_schema.tables
                            WHERE table_type = 'BASE TABLE'
                            AND table_schema = '{database_schema}'
                            ORDER BY table_name
                        """
                    else:
                        query = """
                            SELECT table_name, table_schema
                            FROM information_schema.tables
                            WHERE table_type = 'BASE TABLE'
                            AND table_schema NOT IN ('pg_catalog', 'information_schema', 'mysql', 'performance_schema', 'sys')
                            ORDER BY table_name
                        """
                    result = conn.execute(text(query))

                # Collect all table names and schemas
                table_list = []
                for row in result:
                    table_list.append((row[0], row[1] if row[1] else None))

                if not table_list:
                    return tables

                # Batch fetch columns for all tables at once
                columns_map = await self._fetch_all_columns(conn, table_list, db_type)

                # Build table metadata with columns
                for table_name, schema_name in table_list:
                    columns = columns_map.get((schema_name or "default", table_name), [])
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

    async def _fetch_all_columns(
        self, conn: Any, table_list: list[tuple[str, str | None]], db_type: str
    ) -> dict[tuple[str, str], list[ColumnMetadata]]:
        """Fetch columns for all tables at once.

        Args:
            conn: The SQLAlchemy connection.
            table_list: List of (table_name, schema_name) tuples.
            db_type: The database type.

        Returns:
            Dictionary mapping (schema, table_name) to list of columns.
        """
        columns_map: dict[tuple[str, str], list[ColumnMetadata]] = {}

        if db_type == "sqlite":
            # For SQLite, query each table's columns (no batch option)
            for table_name, _ in table_list:
                # Validate table name
                validated_name = self._validate_identifier(table_name)
                if not validated_name:
                    continue
                result = conn.execute(text(f"PRAGMA table_info('{validated_name}')"))
                columns = []
                for row in result:
                    columns.append(
                        ColumnMetadata(
                            name=row[1],
                            data_type=row[2] or "ANY",
                            is_nullable=not row[3],
                            default_value=row[4],
                            is_primary_key=row[5] > 0,
                        )
                    )
                columns_map[("default", table_name)] = columns
        else:
            # For MySQL and PostgreSQL, use a more efficient approach:
            # 1. Validate all identifiers first
            # 2. Build a set of unique schemas
            # 3. For each schema, fetch columns and primary keys separately
            unique_schemas = set()
            schema_tables: dict[str, list[str]] = {}
            for table_name, schema_name in table_list:
                # Validate identifiers
                validated_table = self._validate_identifier(table_name)
                validated_schema = self._validate_identifier(schema_name) or "default"

                if not validated_table:
                    continue

                unique_schemas.add(validated_schema)
                if validated_schema not in schema_tables:
                    schema_tables[validated_schema] = []
                schema_tables[validated_schema].append(validated_table)

            # Fetch columns grouped by schema (much faster)
            for schema, tables in schema_tables.items():
                # Double-validate schema to prevent injection (m-6)
                validated_schema = self._validate_identifier(schema) or "default"
                # Validate each table name and quote them properly
                validated_table_names = [f"'{self._validate_identifier(t)}'" for t in tables]
                tables_str = ", ".join(validated_table_names)

                # Get all columns for tables in this schema
                # Note: All identifiers are validated through _validate_identifier
                # which only allows alphanumeric, underscore, and $ characters
                columns_query = f"""
                    SELECT
                        c.table_name,
                        c.column_name,
                        c.data_type,
                        c.is_nullable,
                        c.column_default,
                        c.ordinal_position
                    FROM information_schema.columns c
                    WHERE c.table_schema = '{validated_schema}'
                    AND c.table_name IN ({tables_str})
                    ORDER BY c.table_name, c.ordinal_position
                """

                result = conn.execute(text(columns_query))

                # Temporary storage for columns (without primary key info yet)
                temp_columns: dict[str, list[dict]] = {}
                for row in result:
                    table = row[0]
                    if table not in temp_columns:
                        temp_columns[table] = []
                    temp_columns[table].append(
                        {
                            "name": row[1],
                            "data_type": row[2],
                            "is_nullable": row[3].upper() == "YES",
                            "default_value": row[4],
                            "ordinal_position": row[5],
                        }
                    )

                # Get primary keys for tables in this schema (m-6)
                # All identifiers are validated through _validate_identifier
                if db_type == "mysql":
                    pk_query = f"""
                        SELECT
                            kcu.table_name,
                            kcu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                            ON tc.constraint_name = kcu.constraint_name
                            AND tc.table_schema = kcu.table_schema
                        WHERE tc.table_schema = '{validated_schema}'
                        AND tc.table_name IN ({tables_str})
                        AND tc.constraint_type = 'PRIMARY KEY'
                    """
                else:  # PostgreSQL
                    pk_query = f"""
                        SELECT
                            kcu.table_name,
                            kcu.column_name
                        FROM information_schema.key_column_usage kcu
                        WHERE kcu.table_schema = '{validated_schema}'
                        AND kcu.table_name IN ({tables_str})
                        AND kcu.constraint_type = 'PRIMARY KEY'
                    """

                pk_result = conn.execute(text(pk_query))
                pk_columns: set[tuple[str, str]] = set()
                for row in pk_result:
                    pk_columns.add((row[0], row[1]))  # (table_name, column_name)

                # Build final column metadata with primary key info
                for table, cols in temp_columns.items():
                    key = (schema, table)
                    if key not in columns_map:
                        columns_map[key] = []
                    for col in cols:
                        is_pk = (table, col["name"]) in pk_columns
                        columns_map[key].append(
                            ColumnMetadata(
                                name=col["name"],
                                data_type=col["data_type"],
                                is_nullable=col["is_nullable"],
                                default_value=col["default_value"],
                                is_primary_key=is_pk,
                            )
                        )

        return columns_map

    async def _fetch_views(
        self, engine: Engine, db_type: str, database_schema: str | None = None
    ) -> list[ViewMetadata]:
        """Fetch view metadata from the database.

        Args:
            engine: The SQLAlchemy engine.
            db_type: The database type.
            database_schema: The specific database/schema to query (for MySQL/PostgreSQL).

        Returns:
            List of view metadata.
        """
        views = []

        # Validate schema name to prevent SQL injection
        database_schema = self._validate_identifier(database_schema)

        try:
            with engine.connect() as conn:
                # Query for all views at once
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
                    # Build the query with optional database filter
                    if database_schema:
                        query = f"""
                            SELECT table_name as view_name, '' as view_definition, table_schema as view_schema
                            FROM information_schema.views
                            WHERE table_schema = '{database_schema}'
                            ORDER BY table_name
                        """
                    else:
                        query = """
                            SELECT table_name as view_name, '' as view_definition, table_schema as view_schema
                            FROM information_schema.views
                            WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'mysql', 'performance_schema', 'sys')
                            ORDER BY table_name
                        """
                    result = conn.execute(text(query))

                # Collect all view names and schemas
                view_list = []
                for row in result:
                    view_list.append(
                        (row[0], row[1] if row[1] else None, row[2] if row[2] else None)
                    )

                if not view_list:
                    return views

                # Batch fetch columns for all views at once
                # Convert to table_list format for _fetch_all_columns
                table_list_format = [(v[0], v[2]) for v in view_list]
                columns_map = await self._fetch_all_columns(conn, table_list_format, db_type)

                # Build view metadata with columns
                for view_name, view_definition, schema_name in view_list:
                    columns = columns_map.get((schema_name or "default", view_name), [])
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
