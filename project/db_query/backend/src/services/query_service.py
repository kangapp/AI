"""Query execution service."""

import asyncio
from datetime import datetime
from typing import Any

from sqlalchemy import Engine, text

from ..core.sql_parser import get_parser
from ..core.sqlite_db import get_db
from ..models.database import DatabaseDetail
from ..models.metadata import ColumnMetadata
from ..models.query import QueryHistoryItem, QueryResponse


class QueryService:
    """Service for executing SQL queries."""

    def __init__(self) -> None:
        """Initialize the query service."""
        self.db = get_db()

    async def execute_query(
        self,
        database: DatabaseDetail,
        engine: Engine,
        sql: str,
        timeout: int = 30,
    ) -> QueryResponse:
        """Execute a SQL query on the database.

        Args:
            database: The database connection details.
            engine: The SQLAlchemy engine for the database.
            sql: The SQL query to execute.
            timeout: Query timeout in seconds.

        Returns:
            The query response.

        Raises:
            SQLValidationError: If the SQL is invalid.
            asyncio.TimeoutError: If the query times out.
            SQLAlchemyError: If the query execution fails.
        """
        # Validate SQL
        parser = get_parser(database.db_type)
        parser.validate_select_only(sql)

        # Add LIMIT if not present
        final_sql = parser.ensure_limit(sql, default_limit=1000)
        has_limit_after = "LIMIT" in final_sql.upper()

        # Extract limit value if present
        limit_value = None
        if has_limit_after:
            try:
                # Simple extraction of LIMIT value
                limit_match = final_sql.upper().split("LIMIT")[-1].strip().split()[0]
                limit_value = int(limit_match)
            except (ValueError, IndexError):
                pass

        start_time = datetime.now()

        # Execute with timeout
        try:
            result = await asyncio.wait_for(
                self._execute_with_engine(engine, final_sql),
                timeout=timeout,
            )
        except TimeoutError:
            # Log failed query
            await self._log_query(
                database_id=database.id,
                database_name=database.name,
                query_type="sql",
                input_text=sql,
                executed_sql=final_sql,
                row_count=None,
                execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
                status="error",
                error_message="Query timeout",
            )
            raise

        end_time = datetime.now()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Serialize results
        columns, rows = self._serialize_results(result)

        # Log successful query
        await self._log_query(
            database_id=database.id,
            database_name=database.name,
            query_type="sql",
            input_text=sql,
            executed_sql=final_sql,
            row_count=len(rows),
            execution_time_ms=execution_time_ms,
            status="success",
            error_message=None,
        )

        return QueryResponse(
            success=True,
            executed_sql=final_sql,
            row_count=len(rows),
            execution_time_ms=execution_time_ms,
            columns=columns,
            rows=rows,
            has_limit=has_limit_after,
            limit_value=limit_value,
        )

    async def _execute_with_engine(self, engine: Engine, sql: str) -> Any:
        """Execute SQL with the given engine.

        Args:
            engine: The SQLAlchemy engine.
            sql: The SQL to execute.

        Returns:
            The query result.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync_execute, engine, sql)

    def _sync_execute(self, engine: Engine, sql: str) -> Any:
        """Synchronously execute SQL query.

        Args:
            engine: The SQLAlchemy engine.
            sql: The SQL to execute.

        Returns:
            The query result.
        """
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            # Fetch all results and convert to list
            return list(result.fetchall())

    def _serialize_results(self, result: list[Any]) -> tuple[list[ColumnMetadata], list[dict[str, Any]]]:
        """Serialize query results into columns and rows.

        Args:
            result: The raw query result.

        Returns:
            A tuple of (columns, rows).
        """
        if not result:
            return [], []

        # Extract column names from the first row
        first_row = result[0]
        # Handle both Row objects and dict-like objects
        if hasattr(first_row, "_fields"):
            column_names = list(first_row._fields)
        elif hasattr(first_row, "keys"):
            column_names = list(first_row.keys())
        else:
            # Fallback: use numeric indices
            column_names = [f"column_{i}" for i in range(len(first_row))]

        # Create column metadata
        columns = [
            ColumnMetadata(
                name=name,
                data_type="UNKNOWN",  # SQLAlchemy doesn't always provide type info
                is_nullable=True,
                is_primary_key=False,
            )
            for name in column_names
        ]

        # Convert rows to dictionaries
        rows = []
        for row in result:
            row_dict = {}
            for i, name in enumerate(column_names):
                # Access by index to handle both Row and tuple types
                value = row[i] if i < len(row) else None
                # Convert datetime and other special types to strings
                if hasattr(value, "isoformat"):
                    value = value.isoformat()
                elif value is None:
                    value = None
                else:
                    value = str(value) if not isinstance(value, (int, float, str, bool)) else value
                row_dict[name] = value
            rows.append(row_dict)

        return columns, rows

    async def _log_query(
        self,
        database_id: int,
        database_name: str,
        query_type: str,
        input_text: str,
        executed_sql: str,
        row_count: int | None,
        execution_time_ms: int,
        status: str,
        error_message: str | None,
    ) -> None:
        """Log a query to the history.

        Args:
            database_id: The database ID.
            database_name: The database name.
            query_type: The query type (sql or natural).
            input_text: The input SQL or natural language prompt.
            executed_sql: The executed SQL.
            row_count: The number of rows returned.
            execution_time_ms: The execution time in milliseconds.
            status: The query status (success or error).
            error_message: The error message if any.
        """
        await self.db.execute(
            """
            INSERT INTO query_history (
                database_id, database_name, query_type, input_text, executed_sql,
                row_count, execution_time_ms, status, error_message, created_at
            ) VALUES (
                :database_id, :database_name, :query_type, :input_text, :executed_sql,
                :row_count, :execution_time_ms, :status, :error_message, :created_at
            )
            """,
            {
                "database_id": database_id,
                "database_name": database_name,
                "query_type": query_type,
                "input_text": input_text,
                "executed_sql": executed_sql,
                "row_count": row_count,
                "execution_time_ms": execution_time_ms,
                "status": status,
                "error_message": error_message,
                "created_at": datetime.now(),
            },
        )

    async def get_query_history(
        self, database_name: str, page: int = 1, page_size: int = 20
    ) -> list[QueryHistoryItem]:
        """Get query history for a database.

        Args:
            database_name: The database name.
            page: The page number (1-indexed).
            page_size: The number of items per page.

        Returns:
            List of query history items.
        """
        offset = (page - 1) * page_size

        rows = await self.db.fetch_all(
            """
            SELECT * FROM query_history
            WHERE database_name = :database_name
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """,
            {"database_name": database_name, "limit": page_size, "offset": offset},
        )

        items = []
        for row in rows:
            items.append(
                QueryHistoryItem(
                    id=row["id"],
                    database_id=row["database_id"],
                    database_name=row["database_name"],
                    query_type=row["query_type"],
                    input_text=row["input_text"],
                    executed_sql=row["executed_sql"],
                    row_count=row["row_count"],
                    execution_time_ms=row["execution_time_ms"],
                    status=row["status"],
                    error_message=row["error_message"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
            )

        return items

    async def get_query_history_count(self, database_name: str) -> int:
        """Get the total count of query history for a database.

        Args:
            database_name: The database name.

        Returns:
            The total count.
        """
        row = await self.db.fetch_one(
            "SELECT COUNT(*) as count FROM query_history WHERE database_name = :database_name",
            {"database_name": database_name},
        )
        return row["count"] if row else 0
