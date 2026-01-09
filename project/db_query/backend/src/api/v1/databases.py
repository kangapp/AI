"""Database connection endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from ...models.database import DatabaseCreateRequest, DatabaseUpdateRequest, DatabaseDetail
from ...services.db_service import DatabaseService
from ...services.metadata_service import MetadataService

router = APIRouter()

# Service instances
db_service = DatabaseService()
metadata_service = MetadataService()


@router.get("/dbs")
async def list_databases() -> dict[str, Any]:
    """List all database connections.

    Returns:
        Response containing all database connections.
    """
    databases = await db_service.list_databases()
    # Convert to dict for camelCase output
    return {
        "databases": [db.model_dump(by_alias=True) for db in databases],
        "totalCount": len(databases),
    }


@router.put("/dbs/{name}", status_code=status.HTTP_201_CREATED)
async def create_database(name: str, request: DatabaseCreateRequest) -> DatabaseDetail:
    """Create a new database connection.

    Args:
        name: The database name (from URL path for uniqueness).
        request: The database creation request.

    Returns:
        The created database connection.

    Raises:
        HTTPException: If creation fails.
    """
    try:
        # Override name from URL path for consistency
        request.name = name
        return await db_service.create_database(request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create database: {e}",
        ) from e


@router.get("/dbs/{name}")
async def get_database(
    name: str,
    refresh: bool = Query(False, description="Force refresh metadata from database"),
) -> DatabaseDetail:
    """Get database details with metadata.

    Args:
        name: The database name.
        refresh: If True, force refresh metadata from database.

    Returns:
        Database details with tables and views.

    Raises:
        HTTPException: If database is not found.
    """
    try:
        database = await db_service.get_database_by_name(name)

        # Get metadata
        from sqlalchemy import create_engine

        connection_url = await db_service.get_connection_url_with_driver(name)
        engine = create_engine(connection_url)

        metadata = await metadata_service.fetch_metadata(database, engine, force_refresh=refresh)

        # Attach metadata to database
        database.tables = metadata.tables
        database.views = metadata.views
        if refresh:
            database.metadata_updated_at = metadata.updated_at

        return database

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch database metadata: {e}",
        ) from e


@router.patch("/dbs/{name}")
async def update_database(name: str, request: DatabaseUpdateRequest) -> DatabaseDetail:
    """Update a database connection.

    Args:
        name: The current database name.
        request: The update request.

    Returns:
        The updated database connection.

    Raises:
        HTTPException: If database is not found or update fails.
    """
    try:
        return await db_service.update_database(name, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update database: {e}",
        ) from e


@router.delete("/dbs/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_database(name: str) -> None:
    """Delete a database connection.

    Args:
        name: The database name.

    Raises:
        HTTPException: If database is not found.
    """
    try:
        await db_service.delete_database(name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete database: {e}",
        ) from e


@router.get("/dbs/{name}/metadata")
async def get_database_metadata(
    name: str,
    refresh: bool = Query(False, description="Force refresh metadata from database"),
) -> Any:
    """Get database metadata (tables and views).

    Args:
        name: The database name.
        refresh: If True, force refresh metadata from database.

    Returns:
        Database metadata.

    Raises:
        HTTPException: If database is not found.
    """
    try:
        database = await db_service.get_database_by_name(name)

        from sqlalchemy import create_engine

        connection_url = await db_service.get_connection_url_with_driver(name)
        engine = create_engine(connection_url)

        return await metadata_service.fetch_metadata(database, engine, force_refresh=refresh)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch metadata: {e}",
        ) from e
