"""Query execution endpoints."""


from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel

from ...models.query import (
    ExportRequest,
    ExportResponse,
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

router = APIRouter()

# Service instances
db_service = DatabaseService()
query_service = QueryService()
llm_service = LLMService()
metadata_service = MetadataService()


class SuggestedQueriesResponse(BaseModel):
    """Response model for suggested queries."""

    suggestions: list[str]


@router.post("/dbs/{name}/query", status_code=status.HTTP_200_OK)
async def execute_query(name: str, request: QueryRequest) -> QueryResponse:
    """Execute a SQL query on the database.

    Args:
        name: The database name.
        request: The query request.

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
        return await query_service.execute_query(database, engine, request.sql)

    except ValueError as e:
        # Check if it's a validation error
        error_msg = str(e)
        if "Only SELECT queries are allowed" in error_msg or "SQL syntax error" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "SQL_SYNTAX_ERROR" if "syntax" in error_msg else "INVALID_STATEMENT_TYPE", "message": error_msg},
            ) from e
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "QUERY_TIMEOUT", "message": "Query execution exceeded timeout limit"},
        ) from e
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "QUERY_EXECUTION_ERROR", "message": error_msg},
        ) from e


@router.get("/dbs/{name}/history")
async def get_query_history(
    name: str,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Number of items per page"),
) -> QueryHistoryResponse:
    """Get query history for a database.

    Args:
        name: The database name.
        page: The page number.
        page_size: The page size.

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

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        ) from e


@router.post("/dbs/{name}/query/natural", status_code=status.HTTP_200_OK)
async def natural_query(name: str, request: NaturalQueryRequest) -> NaturalQueryResponse:
    """Generate SQL from natural language and optionally execute it.

    Args:
        name: The database name.
        request: The natural query request.

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
        metadata_response = await metadata_service.fetch_metadata(database, engine, force_refresh=False)
        tables, views = metadata_response.tables, metadata_response.views

        # Generate SQL
        generated_sql, explanation, is_valid, validation_message = (
            await llm_service.generate_and_validate(
                request.prompt, tables, views, database.db_type
            )
        )

        if not is_valid:
            return NaturalQueryResponse(
                success=False,
                generated_sql="",
                explanation=None,
                is_valid=False,
                validation_message=validation_message,
            )

        # If execute_immediately is True, execute the query
        if request.execute_immediately and is_valid:
            query_response = await query_service.execute_query(
                database, engine, generated_sql
            )
            # Return the generated SQL with execution results in explanation
            return NaturalQueryResponse(
                success=True,
                generated_sql=query_response.executed_sql,
                explanation=f"Executed successfully: {query_response.row_count} rows returned in {query_response.execution_time_ms}ms",
                is_valid=True,
                validation_message=None,
            )

        return NaturalQueryResponse(
            success=True,
            generated_sql=generated_sql,
            explanation=explanation,
            is_valid=is_valid,
            validation_message=None,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "LLM_SERVICE_ERROR", "message": error_msg},
        ) from e


@router.post("/dbs/{name}/query/export", status_code=status.HTTP_200_OK)
async def export_query_results(
    name: str,
    export_request: ExportRequest,
) -> Response:
    """Execute a query and export results to CSV or JSON format.

    Args:
        name: The database name.
        export_request: The export request with SQL query and format settings.

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
        query_response = await query_service.execute_query(
            database, engine, export_request.sql
        )

        # Export results directly with format and include_headers
        from datetime import datetime
        import csv
        import json
        from io import StringIO

        export_format = export_request.format.lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if export_format == "csv":
            output = StringIO()
            writer = csv.writer(output)

            # Write headers if requested
            if export_request.include_headers:
                headers = [col.name for col in query_response.columns]
                writer.writerow(headers)

            # Write rows
            for row in query_response.rows:
                row_values = [
                    str(value) if value is not None else "" for value in row.values()
                ]
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
            raise ValueError(f"Unsupported export format: {export_format}")

        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            },
        )

    except ValueError as e:
        error_msg = str(e)
        if "Only SELECT queries are allowed" in error_msg or "SQL syntax error" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "SQL_SYNTAX_ERROR"
                    if "syntax" in error_msg
                    else "INVALID_STATEMENT_TYPE",
                    "message": error_msg,
                },
            ) from e
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except TimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "QUERY_TIMEOUT",
                "message": "Query execution exceeded timeout limit",
            },
        ) from e
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "QUERY_EXECUTION_ERROR", "message": error_msg},
        ) from e


@router.get("/dbs/{name}/suggested-queries", status_code=status.HTTP_200_OK)
async def get_suggested_queries(name: str, limit: int = Query(6, ge=3, le=10)) -> SuggestedQueriesResponse:
    """Get AI-suggested query descriptions based on database metadata.

    Args:
        name: The database name.
        limit: Number of suggestions to return (3-10).

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
        metadata_response = await metadata_service.fetch_metadata(database, engine, force_refresh=False)
        tables, views = metadata_response.tables, metadata_response.views

        # Generate suggested queries using LLM
        suggestions = await llm_service.generate_suggested_queries(
            tables, views, database.db_type, limit
        )

        return SuggestedQueriesResponse(suggestions=suggestions)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "SUGGESTION_ERROR", "message": error_msg},
        ) from e
