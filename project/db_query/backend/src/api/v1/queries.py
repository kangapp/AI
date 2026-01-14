"""Query execution endpoints."""


from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel

from ...middleware.rate_limit import limiter
from ...models.query import (
    ExportRequest,
    NaturalQueryRequest,
    NaturalQueryResponse,
    QueryHistoryResponse,
    QueryRequest,
    QueryResponse,
)
from ...services.db_service import DatabaseService
from ...services.llm_service import LLMService
from ...services.metadata_service import MetadataService
from ...services.query_service import QueryService
from ..dependencies import get_db_service, get_llm_service, get_metadata_service, get_query_service
from ..errors import ErrorCode, handle_api_error

router = APIRouter()

# Type annotations for rate-limited endpoints
_RateLimitedFunc = ...  # Placeholder for decorator type annotation


class SuggestedQueriesResponse(BaseModel):
    """Response model for suggested queries."""

    suggestions: list[str]


class DeleteHistoryRequest(BaseModel):
    """Request model for deleting history items."""

    ids: list[int] | None = None  # If null, delete all for the database


@router.post(
    "/dbs/{name}/query",
    status_code=status.HTTP_200_OK,
    summary="Execute SQL query",
    description="Executes a SELECT query on the specified database. Only SELECT queries are allowed for security.",
)
@limiter.limit("30/minute")  # type: ignore[untyped-decorator]
async def execute_query(
    request: Request,
    name: str,
    query_req: QueryRequest,
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
) -> QueryResponse:
    """Execute a SQL query on the database.

    ## Query Examples

    ### Simple SELECT
    ```sql
    SELECT * FROM users LIMIT 10
    ```

    ### SELECT with WHERE clause
    ```sql
    SELECT id, name, email FROM users WHERE active = true LIMIT 100
    ```

    ### JOIN with WHERE
    ```sql
    SELECT u.name, o.total
    FROM users u
    JOIN orders o ON u.id = o.user_id
    WHERE o.created_at > '2024-01-01'
    LIMIT 100
    ```

    ### Aggregate functions
    ```sql
    SELECT category, COUNT(*) as count, AVG(price) as avg_price
    FROM products
    GROUP BY category
    ORDER BY count DESC
    LIMIT 50
    ```

    ## Response Format

    The response includes:
    - **executedSql**: The SQL that was executed (LIMIT may be auto-added)
    - **rowCount**: Number of rows returned
    - **executionTimeMs**: Query execution time in milliseconds
    - **columns**: Array of column metadata (name, type, nullable)
    - **rows**: Array of result rows
    - **hasLimit**: Whether LIMIT was present or added
    - **limitValue**: The LIMIT value if present

    ## Error Responses

    - **400 Bad Request**: Invalid SQL syntax or non-SELECT query
    - **404 Not Found**: Database not found
    - **422 Unprocessable Entity**: SQL exceeds maximum length (100,000 characters)
    - **500 Internal Server Error**: Query execution error

    ## Rate Limiting

    This endpoint is rate-limited to 30 requests per minute per IP address.

    Args:
        request: The FastAPI request.
        name: The database name.
        query_req: The query request.
        db_service: The database service instance.
        query_service: The query service instance.

    Returns:
        The query response.

    Raises:
        HTTPException: If the database is not found or query fails.
    """
    try:
        # Get database
        database = await db_service.get_database_by_name(name)

        # Get engine with driver
        connection_url = await db_service.get_connection_url_with_driver(name)
        engine = db_service.get_engine(database.id, connection_url)

        # Execute query
        return await query_service.execute_query(database, engine, query_req.sql)

    except Exception as e:
        raise handle_api_error(e) from e


@router.get(
    "/dbs/{name}/history",
    summary="Get query history",
    description="Retrieves paginated query execution history for a database.",
)
async def get_query_history(
    name: str,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Number of items per page"),
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
) -> QueryHistoryResponse:
    """Get query history for a database.

    ## Response Format

    The response includes:
    - **items**: Array of query history items
    - **totalCount**: Total number of history items
    - **page**: Current page number
    - **pageSize**: Items per page

    ## History Item Fields

    Each history item contains:
    - **id**: Unique identifier
    - **databaseName**: Database name
    - **queryType**: Type of query (sql or natural)
    - **inputText**: Original input (SQL or natural language)
    - **executedSql**: The SQL that was executed
    - **rowCount**: Number of rows returned (null if error)
    - **executionTimeMs**: Execution time in milliseconds
    - **status**: Query status (success or error)
    - **errorMessage**: Error message if applicable
    - **createdAt**: Timestamp of query execution

    Args:
        name: The database name.
        page: The page number.
        page_size: The page size.
        db_service: The database service instance.
        query_service: The query service instance.

    Returns:
        The query history response.

    Raises:
        HTTPException: If the database is not found.
    """
    try:
        # Verify database exists
        await db_service.get_database_by_name(name)

        # Get history
        items = await query_service.get_query_history(name, page, page_size)
        total_count = await query_service.get_query_history_count(name)

        return QueryHistoryResponse(
            items=items,
            total_count=total_count,
            page=page,
            page_size=page_size,
        )

    except Exception as e:
        raise handle_api_error(e) from e


@router.post(
    "/dbs/{name}/query/natural",
    status_code=status.HTTP_200_OK,
    summary="Natural language to SQL",
    description="Converts natural language queries to SQL using AI. Can optionally execute the generated query.",
)
@limiter.limit("10/minute")  # type: ignore[untyped-decorator]
async def natural_query(
    request: Request,
    name: str,
    natural_req: NaturalQueryRequest,
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
    llm_service: LLMService = Depends(get_llm_service),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> NaturalQueryResponse:
    """Generate SQL from natural language and optionally execute it.

    ## Request Format

    ```json
    {
      "prompt": "Show me all users who registered in the last 7 days",
      "executeImmediately": false
    }
    ```

    ## Example Prompts

    - "Show me the top 10 customers by total order amount"
    - "Count users by country"
    - "Find all orders with total greater than $1000"
    - "List products with low stock (less than 10 items)"

    ## Response Format

    When `executeImmediately` is `false`:
    - **success**: Whether SQL generation succeeded
    - **generatedSql**: The generated SQL query
    - **explanation**: Natural language explanation of the query
    - **isValid**: Whether the SQL is syntactically valid

    When `executeImmediately` is `true`:
    - All fields above, plus:
    - **rowCount**: Number of rows returned
    - **executionTimeMs**: Query execution time
    - **columns**: Column metadata
    - **rows**: Query results

    ## Error Responses

    - **400 Bad Request**: Prompt exceeds maximum length (5,000 characters)
    - **404 Not Found**: Database not found
    - **422 Unprocessable Entity**: Invalid request format
    - **500 Internal Server Error**: SQL generation or execution failed

    ## Rate Limiting

    This endpoint is rate-limited to 10 requests per minute per IP address.

    Args:
        request: The FastAPI request.
        name: The database name.
        natural_req: The natural query request.
        db_service: The database service instance.
        query_service: The query service instance.
        llm_service: The LLM service instance.
        metadata_service: The metadata service instance.

    Returns:
        The natural query response with generated SQL.

    Raises:
        HTTPException: If the database is not found or SQL generation fails.
    """
    try:
        # Get database
        database = await db_service.get_database_by_name(name)

        # Get connection URL and engine
        connection_url = await db_service.get_connection_url_with_driver(name)
        engine = db_service.get_engine(database.id, connection_url)

        # Fetch metadata for context
        metadata_response = await metadata_service.fetch_metadata(
            database, engine, force_refresh=False
        )
        tables, views = metadata_response.tables, metadata_response.views

        # Generate SQL
        (
            generated_sql,
            explanation,
            is_valid,
            validation_message,
        ) = await llm_service.generate_and_validate(
            natural_req.prompt, tables, views, database.db_type
        )

        if not is_valid:
            return NaturalQueryResponse(
                success=False,
                generated_sql="",
                explanation=None,
                is_valid=False,
                validation_message=validation_message,
                row_count=None,
                execution_time_ms=None,
                columns=None,
                rows=None,
            )

        # If execute_immediately is True, execute the query
        if natural_req.execute_immediately and is_valid:
            query_response = await query_service.execute_query(
                database, engine, generated_sql, query_type="natural", input_text=natural_req.prompt
            )
            # Return the generated SQL with full execution results
            return NaturalQueryResponse(
                success=True,
                generated_sql=query_response.executed_sql,
                explanation=f"Executed successfully: {query_response.row_count} rows returned in {query_response.execution_time_ms}ms",
                is_valid=True,
                validation_message=None,
                row_count=query_response.row_count,
                execution_time_ms=query_response.execution_time_ms,
                columns=query_response.columns,
                rows=query_response.rows,
            )

        return NaturalQueryResponse(
            success=True,
            generated_sql=generated_sql,
            explanation=explanation,
            is_valid=is_valid,
            validation_message=None,
            row_count=None,
            execution_time_ms=None,
            columns=None,
            rows=None,
        )

    except Exception as e:
        raise handle_api_error(e) from e


@router.post(
    "/dbs/{name}/query/export",
    status_code=status.HTTP_200_OK,
    summary="Export query results",
    description="Executes a SQL query and exports results to CSV or JSON format for download.",
)
@limiter.limit("20/minute")  # type: ignore[untyped-decorator]
async def export_query_results(
    request: Request,
    name: str,
    export_req: ExportRequest,
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
) -> Response:
    """Execute a query and export results to CSV or JSON format.

    ## Request Format

    ```json
    {
      "sql": "SELECT * FROM users LIMIT 100",
      "format": "csv",
      "includeHeaders": true
    }
    ```

    ## Supported Formats

    - **csv**: Comma-separated values with optional headers
    - **json**: JSON format with metadata, columns, and rows

    ## CSV Format

    When `format` is "csv":
    - Column headers included if `includeHeaders` is true
    - Values are comma-separated
    - Null values represented as empty strings

    ## JSON Format

    When `format` is "json":
    ```json
    {
      "metadata": {
        "database": "mydb",
        "executedSql": "SELECT * FROM users LIMIT 100",
        "rowCount": 100,
        "executionTimeMs": 15,
        "exportedAt": "2024-01-01T12:00:00"
      },
      "columns": [
        {"name": "id", "dataType": "INTEGER", "isNullable": false},
        {"name": "name", "dataType": "TEXT", "isNullable": true}
      ],
      "rows": [
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"}
      ]
    }
    ```

    ## Response

    Returns a file download with:
    - **Content-Type**: `text/csv` or `application/json`
    - **Content-Disposition**: Attachment with filename `{database}_query_{timestamp}.{ext}`

    ## Rate Limiting

    This endpoint is rate-limited to 20 requests per minute per IP address.

    Args:
        request: The FastAPI request.
        name: The database name.
        export_req: The export request with SQL query and format settings.
        db_service: The database service instance.
        query_service: The query service instance.

    Returns:
        A file download response with the exported data.

    Raises:
        HTTPException: If the database is not found or query fails.
    """
    try:
        # Get database
        database = await db_service.get_database_by_name(name)

        # Get engine with driver
        connection_url = await db_service.get_connection_url_with_driver(name)
        engine = db_service.get_engine(database.id, connection_url)

        # Execute query
        query_response = await query_service.execute_query(database, engine, export_req.sql)

        # Export results directly with format and include_headers
        import csv
        import json
        from datetime import datetime
        from io import StringIO

        export_format = export_req.format.lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if export_format == "csv":
            output = StringIO()
            writer = csv.writer(output)

            # Write headers if requested
            if export_req.include_headers:
                headers = [col.name for col in query_response.columns]
                writer.writerow(headers)

            # Write rows
            for row in query_response.rows:
                row_values = [str(value) if value is not None else "" for value in row.values()]
                writer.writerow(row_values)

            content = output.getvalue()
            content_type = "text/csv"
            filename = f"{name}_query_{timestamp}.csv"

        elif export_format == "json":
            # Build export data structure
            export_data = {
                "metadata": {
                    "database": name,
                    "executed_sql": query_response.executed_sql,
                    "row_count": query_response.row_count,
                    "execution_time_ms": query_response.execution_time_ms,
                    "exported_at": datetime.now().isoformat(),
                },
                "columns": [
                    {
                        "name": col.name,
                        "data_type": col.data_type,
                        "is_nullable": col.is_nullable,
                    }
                    for col in query_response.columns
                ],
                "rows": query_response.rows,
            }

            content = json.dumps(export_data, ensure_ascii=False, indent=2)
            content_type = "application/json"
            filename = f"{name}_query_{timestamp}.json"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": ErrorCode.VALIDATION_ERROR,
                    "message": f"Unsupported export format: {export_format}",
                },
            )

        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise handle_api_error(e) from e


@router.get("/dbs/{name}/suggested-queries", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")  # type: ignore[untyped-decorator]
async def get_suggested_queries(
    request: Request,
    name: str,
    limit: int = Query(6, ge=3, le=10),
    seed: int | None = Query(None, description="Random seed for generating different suggestions"),
    exclude: str | None = Query(None, description="Comma-separated list of suggestions to exclude"),
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
    llm_service: LLMService = Depends(get_llm_service),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> SuggestedQueriesResponse:
    """Get AI-suggested query descriptions based on database metadata.

    Args:
        name: The database name.
        limit: Number of suggestions to return (3-10).
        seed: Random seed for generating different suggestions (for "refresh" functionality).
        exclude: Comma-separated list of suggestions to exclude from the response.
        db_service: The database service instance.
        query_service: The query service instance.
        llm_service: The LLM service instance.
        metadata_service: The metadata service instance.

    Returns:
        The suggested queries response.

    Raises:
        HTTPException: If the database is not found or suggestion generation fails.
    """
    try:
        # Get database
        database = await db_service.get_database_by_name(name)

        # Get connection URL and engine
        connection_url = await db_service.get_connection_url_with_driver(name)
        engine = db_service.get_engine(database.id, connection_url)

        # Fetch metadata for context
        metadata_response = await metadata_service.fetch_metadata(
            database, engine, force_refresh=False
        )
        tables, views = metadata_response.tables, metadata_response.views

        # Parse exclude list
        exclude_list = []
        if exclude:
            exclude_list = [s.strip() for s in exclude.split(",") if s.strip()]

        # Get query history for context (optional)
        try:
            history_items = await query_service.get_query_history(name, page=1, page_size=10)
            history_context = [item.input_text for item in history_items if item.input_text]
        except Exception:
            history_context = []

        # Generate suggested queries using LLM
        suggestions = await llm_service.generate_suggested_queries(
            tables,
            views,
            database.db_type,
            limit,
            seed=seed,
            exclude=exclude_list,
            history=history_context,
        )

        return SuggestedQueriesResponse(suggestions=suggestions)

    except Exception as e:
        raise handle_api_error(e) from e


@router.delete("/dbs/{name}/history", status_code=status.HTTP_200_OK)
async def delete_query_history(
    name: str,
    request: DeleteHistoryRequest,
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
) -> Response:
    """Delete query history items for a database.

    Args:
        name: The database name.
        request: The delete request with optional list of IDs.
        db_service: The database service instance.
        query_service: The query service instance.

    Returns:
        204 No Content on success.

    Raises:
        HTTPException: If the database is not found or deletion fails.
    """
    try:
        # Verify database exists
        await db_service.get_database_by_name(name)

        if request.ids is None:
            # Delete all history for this database
            deleted_count = await query_service.clear_query_history(name)
        elif len(request.ids) == 0:
            # No IDs to delete
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        else:
            # Delete specific items
            deleted_count = await query_service.delete_query_history_batch(request.ids)

        if deleted_count > 0:
            return Response(
                content=f"Deleted {deleted_count} history item(s)",
                status_code=status.HTTP_200_OK,
            )
        else:
            return Response(status_code=status.HTTP_204_NO_CONTENT)

    except Exception as e:
        raise handle_api_error(e) from e


@router.get("/dbs/{name}/history/summary", status_code=status.HTTP_200_OK)
async def get_history_summary(
    name: str,
    db_service: DatabaseService = Depends(get_db_service),
    query_service: QueryService = Depends(get_query_service),
) -> dict[str, int]:
    """Get query history summary for a database.

    Args:
        name: The database name.
        db_service: The database service instance.
        query_service: The query service instance.

    Returns:
        A dictionary with total count and recent success/error counts.

    Raises:
        HTTPException: If the database is not found.
    """
    try:
        # Verify database exists
        await db_service.get_database_by_name(name)

        # Get total count
        total_count = await query_service.get_query_history_count(name)

        # Get recent items for summary
        recent_items = await query_service.get_query_history(name, page=1, page_size=100)
        success_count = sum(1 for item in recent_items if item.status == "success")
        error_count = sum(1 for item in recent_items if item.status == "error")

        return {
            "total_count": total_count,
            "recent_success_count": success_count,
            "recent_error_count": error_count,
        }

    except Exception as e:
        raise handle_api_error(e) from e
