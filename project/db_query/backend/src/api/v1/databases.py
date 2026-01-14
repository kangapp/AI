"""Database connection endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, Query, status

from ...models.database import DatabaseCreateRequest, DatabaseDetail, DatabaseUpdateRequest
from ...services.db_service import DatabaseService
from ...services.metadata_service import MetadataService
from ..dependencies import get_db_service, get_metadata_service
from ..errors import handle_api_error

router = APIRouter()


@router.get(
    "/dbs",
    summary="List all databases",
    description="Retrieves a list of all configured database connections.",
)
async def list_databases(
    db_service: DatabaseService = Depends(get_db_service),
) -> dict[str, Any]:
    """List all database connections.

    ## Response Format

    ```json
    {
      "databases": [
        {
          "id": 1,
          "name": "my_database",
          "url": "mysql://***:***@localhost:3306/mydb",
          "dbType": "mysql",
          "createdAt": "2024-01-01T00:00:00",
          "lastConnectedAt": "2024-01-01T12:00:00",
          "isActive": true
        }
      ],
      "totalCount": 1
    }
    ```

    ## Field Descriptions

    - **id**: Unique database identifier
    - **name**: User-friendly database name
    - **url**: Connection string (password redacted)
    - **dbType**: Database type (mysql, postgresql, sqlite)
    - **createdAt**: Database creation timestamp
    - **lastConnectedAt**: Last successful connection timestamp
    - **isActive**: Whether the database is active

    Returns:
        Response containing all database connections.
    """
    databases = await db_service.list_databases()
    # Convert to dict for camelCase output
    return {
        "databases": [db.model_dump(by_alias=True) for db in databases],
        "totalCount": len(databases),
    }


@router.put(
    "/dbs/{name}",
    status_code=status.HTTP_201_CREATED,
    summary="Create database connection",
    description="Creates a new database connection with the specified configuration.",
)
async def create_database(
    name: str,
    request: DatabaseCreateRequest,
    db_service: DatabaseService = Depends(get_db_service),
) -> DatabaseDetail:
    """Create a new database connection.

    ## Connection String Formats

    ### MySQL
    ```
    mysql://username:password@localhost:3306/database_name
    ```

    ### PostgreSQL
    ```
    postgresql://username:password@localhost:5432/database_name
    ```

    ### SQLite (relative path)
    ```
    sqlite:///path/to/database.db
    ```

    ### SQLite (absolute path)
    ```
    sqlite:////absolute/path/to/database.db
    ```

    ## Request Format

    ```json
    {
      "name": "my_database",
      "url": "mysql://user:pass@localhost:3306/mydb"
    }
    ```

    ## Validation Rules

    - **name**: 1-100 characters, must be unique
    - **url**: 10-2000 characters, must be a valid connection string

    ## Error Responses

    - **400 Bad Request**: Connection string is invalid or connection fails
    - **409 Conflict**: Database name already exists
    - **422 Unprocessable Entity**: Validation error (name/url length)

    Returns:
        The created database connection.

    Raises:
        HTTPException: If creation fails.
    """
    try:
        # Override name from URL path for consistency
        request.name = name
        return await db_service.create_database(request)
    except Exception as e:
        raise handle_api_error(e) from e


@router.get("/dbs/{name}")
async def get_database(
    name: str,
    refresh: bool = Query(False, description="Force refresh metadata from database"),
    db_service: DatabaseService = Depends(get_db_service),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> DatabaseDetail:
    """Get database details with metadata.

    Args:
        name: The database name.
        refresh: If True, force refresh metadata from database.
        db_service: The database service instance.
        metadata_service: The metadata service instance.

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

    except Exception as e:
        raise handle_api_error(e) from e


@router.patch("/dbs/{name}")
async def update_database(
    name: str,
    request: DatabaseUpdateRequest,
    db_service: DatabaseService = Depends(get_db_service),
) -> DatabaseDetail:
    """Update a database connection.

    Args:
        name: The current database name.
        request: The update request.
        db_service: The database service instance.

    Returns:
        The updated database connection.

    Raises:
        HTTPException: If database is not found or update fails.
    """
    try:
        return await db_service.update_database(name, request)
    except Exception as e:
        raise handle_api_error(e) from e


@router.delete("/dbs/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_database(
    name: str,
    db_service: DatabaseService = Depends(get_db_service),
) -> None:
    """Delete a database connection.

    Args:
        name: The database name.
        db_service: The database service instance.

    Raises:
        HTTPException: If database is not found.
    """
    try:
        await db_service.delete_database(name)
    except Exception as e:
        raise handle_api_error(e) from e


@router.get("/dbs/{name}/metadata")
async def get_database_metadata(
    name: str,
    refresh: bool = Query(False, description="Force refresh metadata from database"),
    db_service: DatabaseService = Depends(get_db_service),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> Any:
    """Get database metadata (tables and views).

    Args:
        name: The database name.
        refresh: If True, force refresh metadata from database.
        db_service: The database service instance.
        metadata_service: The metadata service instance.

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

    except Exception as e:
        raise handle_api_error(e) from e
