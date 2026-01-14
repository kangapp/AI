"""Pytest configuration and shared fixtures."""

import asyncio
import os
import tempfile
from collections.abc import AsyncIterator, Generator
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import sqlalchemy
from sqlalchemy import Engine, create_engine, text

# Set test environment variables before importing any application code
os.environ["ZAI_API_KEY"] = "test_api_key"
os.environ["DB_PATH"] = ":memory:"
os.environ["LOG_LEVEL"] = "WARNING"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def temp_db_path() -> AsyncIterator[Path]:
    """Create a temporary database file path.

    Yields:
        Path to temporary database file.
    """
    # Create a temp file
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(path)
    yield db_path
    # Cleanup
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def mock_engine() -> Engine:
    """Create a mock SQLAlchemy engine for testing.

    Returns:
        A mock engine.
    """
    engine = create_engine("sqlite:///:memory:")

    # Create a test table
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE test_users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"))
        conn.execute(text("INSERT INTO test_users VALUES (1, 'Alice', 'alice@example.com')"))
        conn.execute(text("INSERT INTO test_users VALUES (2, 'Bob', 'bob@example.com')"))
        conn.commit()

    return engine


@pytest.fixture
def mock_database() -> MagicMock:
    """Create a mock database object.

    Returns:
        A MagicMock configured as a DatabaseDetail.
    """
    db = MagicMock()
    db.id = 1
    db.name = "test_db"
    db.url = "sqlite:///:memory:"
    db.db_type = "sqlite"
    db.metadata_updated_at = None
    db.metadata_json = None
    return db


@pytest.fixture(autouse=True)
async def initialize_test_db() -> AsyncIterator[None]:
    """Initialize the application database for testing.

    This fixture is auto-used for all tests.

    Yields:
        None
    """
    from src.core.sqlite_db import get_db, initialize_database

    # Initialize database
    await initialize_database()

    yield

    # Note: Cleanup not needed for :memory: database


@pytest.fixture
async def reset_database() -> AsyncIterator[None]:
    """Reset the database between tests.

    Yields:
        None
    """
    from src.core.sqlite_db import get_db

    db = get_db()
    # Delete all data from tables
    await db.execute("DELETE FROM query_history")
    await db.execute("DELETE FROM databases")
    yield


@pytest.fixture
def mock_llm_response() -> MagicMock:
    """Create a mock LLM response.

    Returns:
        A MagicMock configured as LLM response.
    """
    mock = MagicMock()
    mock.choices = [MagicMock()]
    mock.choices[0].message.content = "SELECT * FROM users LIMIT 10"
    mock.choices[0].finish_reason = "stop"
    return mock


@pytest.fixture
def sample_query_response() -> dict:
    """Sample query response for testing.

    Returns:
        A dictionary representing a query response.
    """
    return {
        "success": True,
        "executedSql": "SELECT * FROM users LIMIT 10",
        "rowCount": 2,
        "executionTimeMs": 5,
        "columns": [
            {"name": "id", "dataType": "INTEGER", "isNullable": False, "isPrimaryKey": True},
            {"name": "name", "dataType": "TEXT", "isNullable": True, "isPrimaryKey": False},
        ],
        "rows": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}],
        "hasLimit": True,
        "limitValue": 10,
    }


@pytest.fixture
def sample_metadata() -> dict:
    """Sample metadata for testing.

    Returns:
        A dictionary representing database metadata.
    """
    return {
        "databaseName": "test_db",
        "dbType": "sqlite",
        "tables": [
            {
                "name": "users",
                "schema": None,
                "columns": [
                    {"name": "id", "dataType": "INTEGER", "isNullable": False, "isPrimaryKey": True},
                    {"name": "name", "dataType": "TEXT", "isNullable": True, "isPrimaryKey": False},
                ],
            }
        ],
        "views": [],
        "updatedAt": "2024-01-01T00:00:00",
    }
