"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..core.sqlite_db import initialize_database


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Lifespan context manager for startup and shutdown events.

    Args:
        app: The FastAPI application instance.

    Yields:
        None
    """
    # Startup
    await initialize_database()
    yield
    # Shutdown - cleanup if needed


app = FastAPI(
    title="Database Query Tool API",
    description="API for managing database connections and executing queries",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - allow all origins as per requirements
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers after app creation to avoid circular imports
from .v1 import databases  # noqa: E402

app.include_router(databases.router, prefix="/api/v1", tags=["databases"])


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
