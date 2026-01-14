"""Test utilities and helper functions."""

from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

from sqlalchemy import create_engine, text


class DatabaseTestHelper:
    """Helper class for database testing."""

    @staticmethod
    def create_in_memory_database() -> MagicMock:
        """Create an in-memory SQLite database for testing.

        Returns:
            A MagicMock configured as a DatabaseDetail.
        """
        from src.models.database import DatabaseDetail

        engine = create_engine("sqlite:///:memory:")

        # Create test schema
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"))
            conn.execute(text("CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, total REAL)"))
            conn.execute(text("INSERT INTO users VALUES (1, 'Alice', 'alice@test.com')"))
            conn.execute(text("INSERT INTO users VALUES (2, 'Bob', 'bob@test.com')"))
            conn.execute(text("INSERT INTO orders VALUES (1, 1, 100.0)"))
            conn.execute(text("INSERT INTO orders VALUES (2, 2, 200.0)"))
            conn.commit()

        db = MagicMock(spec=DatabaseDetail)
        db.id = 1
        db.name = "test_db"
        db.url = "sqlite:///:memory:"
        db.db_type = "sqlite"
        db.metadata_updated_at = None
        db.metadata_json = None

        return db, engine

    @staticmethod
    def create_sample_query_result() -> list[tuple[Any, ...]]:
        """Create a sample query result.

        Returns:
            A list of tuples representing query results.
        """
        return [(1, "Alice", "alice@test.com"), (2, "Bob", "bob@test.com")]


class APITestHelper:
    """Helper class for API testing."""

    @staticmethod
    def create_mock_request(data: dict[str, Any]) -> MagicMock:
        """Create a mock FastAPI request.

        Args:
            data: The request data.

        Returns:
            A MagicMock configured as a FastAPI Request.
        """
        mock = MagicMock()
        mock.json.return_value = data
        mock.headers = {}
        mock.query_params = {}
        return mock

    @staticmethod
    def assert_error_response(response: dict, expected_code: str) -> None:
        """Assert that a response is an error response.

        Args:
            response: The response to check.
            expected_code: The expected error code.
        """
        assert "detail" in response
        if isinstance(response["detail"], list):
            # Pydantic validation error
            assert any(error["type"] == expected_code for error in response["detail"])
        else:
            # API error
            assert response["detail"].get("code") == expected_code


class DateTimeTestHelper:
    """Helper class for datetime testing."""

    @staticmethod
    def assert_datetime_close(
        actual: datetime | str, expected: datetime, delta_seconds: int = 1
    ) -> None:
        """Assert that two datetimes are close within a delta.

        Args:
            actual: The actual datetime (datetime or ISO string).
            expected: The expected datetime.
            delta_seconds: The allowed delta in seconds.
        """
        if isinstance(actual, str):
            actual = datetime.fromisoformat(actual)

        diff = abs((actual - expected).total_seconds())
        assert diff <= delta_seconds, f"Datetimes differ by {diff} seconds"


def create_mock_column(name: str, data_type: str = "TEXT") -> MagicMock:
    """Create a mock column metadata object.

    Args:
        name: The column name.
        data_type: The column data type.

    Returns:
        A MagicMock configured as ColumnMetadata.
    """
    mock = MagicMock()
    mock.name = name
    mock.data_type = data_type
    mock.is_nullable = True
    mock.is_primary_key = False
    mock.default_value = None
    return mock


def create_mock_table(name: str, columns: list[MagicMock] | None = None) -> MagicMock:
    """Create a mock table metadata object.

    Args:
        name: The table name.
        columns: List of column metadata objects.

    Returns:
        A MagicMock configured as TableMetadata.
    """
    mock = MagicMock()
    mock.name = name
    mock.schema = None
    mock.columns = columns or []
    return mock
