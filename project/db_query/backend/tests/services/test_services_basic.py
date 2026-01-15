"""Additional tests for services to improve coverage."""

import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine, text

from src.services.db_service import DatabaseService
from src.services.query_service import QueryService


@pytest.mark.asyncio
class TestDatabaseServiceBasic:
    """Basic tests for DatabaseService."""

    async def test_detect_db_type_mysql(self) -> None:
        """Test MySQL type detection."""
        service = DatabaseService()
        assert service._detect_db_type("mysql://localhost/db") == "mysql"

    async def test_detect_db_type_postgresql(self) -> None:
        """Test PostgreSQL type detection."""
        service = DatabaseService()
        assert service._detect_db_type("postgresql://localhost/db") == "postgresql"

    async def test_detect_db_type_sqlite(self) -> None:
        """Test SQLite type detection."""
        service = DatabaseService()
        assert service._detect_db_type("sqlite:///test.db") == "sqlite"

    async def test_parse_connection_string_sqlite(self) -> None:
        """Test SQLite connection string parsing."""
        service = DatabaseService()
        parsed = service._parse_connection_string("sqlite:///test.db")
        assert parsed.scheme == "sqlite"

    async def test_add_driver_to_url_sqlite(self) -> None:
        """Test adding driver to SQLite URL."""
        service = DatabaseService()
        result = service._add_driver_to_url("sqlite:///test.db", "sqlite")
        assert "sqlite" in result

    async def test_add_driver_to_url_mysql(self) -> None:
        """Test adding driver to MySQL URL."""
        service = DatabaseService()
        result = service._add_driver_to_url("mysql://localhost/db", "mysql")
        assert "pymysql" in result


@pytest.mark.asyncio
class TestQueryServiceBasic:
    """Basic tests for QueryService."""

    async def test_serialize_results_with_data(self) -> None:
        """Test serializing results with data."""
        service = QueryService()
        result = [(1, "Alice"), (2, "Bob")]
        columns, rows = service._serialize_results(result)
        assert len(columns) == 2
        assert len(rows) == 2

    async def test_serialize_results_empty(self) -> None:
        """Test serializing empty results."""
        service = QueryService()
        columns, rows = service._serialize_results([])
        assert columns == []
        assert rows == []

    async def test_delete_query_history_batch_empty(self) -> None:
        """Test batch delete with empty list."""
        service = QueryService()
        count = await service.delete_query_history_batch([])
        assert count == 0

    async def test_delete_query_history_item_not_found(self) -> None:
        """Test deleting non-existent history item."""
        service = QueryService()
        result = await service.delete_query_history_item(99999)
        assert result is False

    async def test_clear_query_history_empty_db(self) -> None:
        """Test clearing history from non-existent database."""
        service = QueryService()
        count = await service.clear_query_history("nonexistent_db")
        assert count == 0


@pytest.mark.asyncio
class TestQueryServiceExport:
    """Tests for export functionality."""

    async def test_export_results_unsupported_format(self) -> None:
        """Test exporting with unsupported format."""
        service = QueryService()

        from src.models.query import QueryResponse, ExportRequest
        from src.models.metadata import ColumnMetadata

        query_response = QueryResponse(
            success=True,
            executed_sql="SELECT 1",
            row_count=0,
            execution_time_ms=1,
            columns=[],
            rows=[],
            has_limit=False,
        )

        export_request = ExportRequest(
            sql="SELECT 1",
            format="xml",
            include_headers=True,
        )

        with pytest.raises(ValueError, match="Unsupported export format"):
            service.export_results(
                query_response=query_response,
                export_request=export_request,
                database_name="test_db",
            )
