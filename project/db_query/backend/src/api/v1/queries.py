"""Query execution endpoints."""


from fastapi import APIRouter, HTTPException, Query, status

from ...models.query import QueryHistoryResponse, QueryRequest, QueryResponse
from ...services.db_service import DatabaseService
from ...services.query_service import QueryService

router = APIRouter()

# Service instances
db_service = DatabaseService()
query_service = QueryService()


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
