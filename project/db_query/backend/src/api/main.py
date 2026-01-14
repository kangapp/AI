"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..core.config import get_config
from ..core.logging import configure_logging, get_logger
from ..core.sqlite_db import initialize_database

# Configure structured logging
config = get_config()
configure_logging(
    log_level=config.log_level,
    json_output=config.json_logs,
    log_file=config.log_file,
)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Lifespan context manager for startup and shutdown events.

    Args:
        app: The FastAPI application instance.

    Yields:
        None
    """
    # Startup
    logger.info("application_starting", log_level=config.log_level)
    await initialize_database()
    logger.info("application_started")
    yield
    # Shutdown - cleanup database connections (M-5)
    logger.info("application_shutting_down")
    from ..services.db_service import DatabaseService

    db_service = DatabaseService()
    await db_service.close()
    logger.info("database_connections_closed")

app = FastAPI(
    title="Database Query Tool API",
    description="API for managing database connections and executing queries",
    version="1.0.0",
    lifespan=lifespan,
    # Security: Limit request size to prevent DoS attacks (C-5)
    max_request_size=config.max_request_size,
)

# Security: Configure CORS with specific origins instead of wildcard (C-1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)

# Import routers after app creation to avoid circular imports
from .v1 import (  # noqa: E402
    databases,
    queries,
)

app.include_router(databases.router, prefix="/api/v1", tags=["databases"])
app.include_router(queries.router, prefix="/api/v1", tags=["queries"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint.

    Returns:
        A welcome message.
    """
    return {"message": "Database Query Tool API", "version": "1.0.0"}


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint.

    Returns:
        Health status.
    """
    return {"status": "healthy"}
