"""Simplified unit tests for QueryService."""

import pytest
from sqlalchemy import create_engine, text

from src.services.query_service import QueryService


@pytest.mark.asyncio
@pytest.mark.unit
class TestQueryServiceSimple:
    """Simplified test suite for QueryService."""

    async def test_serialize_results_basic(self) -> None:
        """Test result serialization with basic data."""
        service = QueryService()

        # Create sample result
        result = [(1, "Alice", "alice@test.com"), (2, "Bob", "bob@test.com")]

        columns, rows = service._serialize_results(result)

        assert len(columns) == 3
        assert len(rows) == 2
        assert rows[0] == {"column_0": 1, "column_1": "Alice", "column_2": "alice@test.com"}

    async def test_serialize_results_empty(self) -> None:
        """Test result serialization with empty result."""
        service = QueryService()

        columns, rows = service._serialize_results([])

        assert columns == []
        assert rows == []

    async def test_delete_query_history_batch_empty(self) -> None:
        """Test batch delete with empty list."""
        service = QueryService()

        result = await service.delete_query_history_batch([])

        assert result == 0

    async def test_export_results_unsupported_format(self) -> None:
        """Test exporting with unsupported format."""
        service = QueryService()

        from src.models.query import ExportRequest, QueryResponse
        from src.models.metadata import ColumnMetadata

        query_response = QueryResponse(
            success=True,
            executed_sql="SELECT 1",
            row_count=1,
            execution_time_ms=1,
            columns=[ColumnMetadata(name="id", data_type="INTEGER", is_nullable=True)],
            rows=[{"id": 1}],
            has_limit=True,
            limit_value=1,
        )

        export_request = ExportRequest(
            sql="SELECT 1", format="xml", include_headers=True
        )

        with pytest.raises(ValueError, match="Unsupported export format"):
            service.export_results(
                query_response=query_response,
                export_request=export_request,
                database_name="test",
            )

    async def test_delete_query_history_item_not_found(self) -> None:
        """Test deleting non-existent history item."""
        service = QueryService()

        result = await service.delete_query_history_item(99999)

        assert result is False

    async def test_clear_query_history_empty_db(self) -> None:
        """Test clearing history from database with no history."""
        service = QueryService()

        # Using a non-existent database should return 0
        count = await service.clear_query_history("nonexistent_db")

        assert count == 0
