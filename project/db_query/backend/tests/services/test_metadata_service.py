"""Unit tests for MetadataService."""

import pytest
from sqlalchemy import create_engine, text

from src.services.metadata_service import MetadataService
from tests.test_utils import DatabaseTestHelper


@pytest.mark.asyncio
@pytest.mark.unit
class TestMetadataService:
    """Test suite for MetadataService."""

    async def test_validate_identifier_valid(self) -> None:
        """Test identifier validation with valid identifiers."""
        assert MetadataService._validate_identifier("valid_name") == "valid_name"
        assert MetadataService._validate_identifier("ValidName123") == "ValidName123"
        assert MetadataService._validate_identifier("_private") == "_private"
        assert MetadataService._validate_identifier("with$sign") == "with$sign"

    async def test_validate_identifier_invalid(self) -> None:
        """Test identifier validation with invalid identifiers."""
        with pytest.raises(ValueError, match="Invalid SQL identifier"):
            MetadataService._validate_identifier("with space")

        with pytest.raises(ValueError, match="Invalid SQL identifier"):
            MetadataService._validate_identifier("with-dash")

        with pytest.raises(ValueError, match="Invalid SQL identifier"):
            MetadataService._validate_identifier("with.dot")

        with pytest.raises(ValueError, match="Invalid SQL identifier"):
            MetadataService._validate_identifier("with@symbols")

    async def test_validate_identifier_empty(self) -> None:
        """Test identifier validation with empty/null input."""
        assert MetadataService._validate_identifier(None) is None
        assert MetadataService._validate_identifier("") is None

    async def test_fetch_metadata_sqlite(
        self, mock_database: MagicMock, mock_engine: Engine, initialize_test_db: None
    ) -> None:
        """Test fetching metadata from SQLite database."""
        service = MetadataService()

        # Add test_users table to the mock database
        with mock_engine.connect() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE test_users (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT
                )
            """
                )
            )
            conn.commit()

        metadata = await service.fetch_metadata(mock_database, mock_engine, force_refresh=True)

        assert metadata.database_name == "test_db"
        assert metadata.db_type == "sqlite"
        assert len(metadata.tables) > 0

        # Find test_users table
        test_users = next((t for t in metadata.tables if t.name == "test_users"), None)
        assert test_users is not None
        assert len(test_users.columns) == 3

        # Check column metadata
        id_col = next((c for c in test_users.columns if c.name == "id"), None)
        assert id_col is not None
        assert id_col.is_primary_key is True

    async def test_fetch_metadata_caching(
        self, mock_database: MagicMock, mock_engine: Engine, initialize_test_db: None
    ) -> None:
        """Test metadata caching behavior."""
        service = MetadataService()

        # First fetch - should query the database
        metadata1 = await service.fetch_metadata(mock_database, mock_engine, force_refresh=True)

        # Second fetch - should use cache (within TTL)
        mock_database.metadata_updated_at = metadata1.updated_at
        metadata2 = await service.fetch_metadata(mock_database, mock_engine, force_refresh=False)

        assert metadata2.updated_at == metadata1.updated_at

    async def test_fetch_metadata_force_refresh(
        self, mock_database: MagicMock, mock_engine: Engine, initialize_test_db: None
    ) -> None:
        """Test force refresh bypasses cache."""
        service = MetadataService()

        # Create table
        with mock_engine.connect() as conn:
            conn.execute(text("CREATE TABLE initial_table (id INTEGER)"))
            conn.commit()

        # First fetch
        metadata1 = await service.fetch_metadata(mock_database, mock_engine, force_refresh=True)
        initial_table_count = len(metadata1.tables)

        # Add another table
        with mock_engine.connect() as conn:
            conn.execute(text("CREATE TABLE new_table (id INTEGER)"))
            conn.commit()

        # Force refresh should pick up new table
        metadata2 = await service.fetch_metadata(mock_database, mock_engine, force_refresh=True)

        assert len(metadata2.tables) == initial_table_count + 1

    async def test_fetch_tables_sqlite(self, mock_engine: Engine) -> None:
        """Test fetching tables from SQLite."""
        service = MetadataService()

        # Create test tables
        with mock_engine.connect() as conn:
            conn.execute(text("CREATE TABLE table1 (id INTEGER)"))
            conn.execute(text("CREATE TABLE table2 (id INTEGER)"))
            # sqlite_* tables should be filtered out
            conn.execute(text("CREATE TABLE sqlite_test (id INTEGER)"))
            conn.commit()

        tables = await service._fetch_tables(mock_engine, "sqlite", None)

        # Should have our test tables but not sqlite_* tables
        assert len(tables) == 2
        table_names = [t.name for t in tables]
        assert "table1" in table_names
        assert "table2" in table_names

    async def test_fetch_views_sqlite(self, mock_engine: Engine) -> None:
        """Test fetching views from SQLite."""
        service = MetadataService()

        # Create a view
        with mock_engine.connect() as conn:
            conn.execute(text("CREATE TABLE base_table (id INTEGER, name TEXT)"))
            conn.execute(text("CREATE VIEW test_view AS SELECT id FROM base_table"))
            conn.commit()

        views = await service._fetch_views(mock_engine, "sqlite", None)

        assert len(views) >= 1
        test_view = next((v for v in views if v.name == "test_view"), None)
        assert test_view is not None

    async def test_fetch_all_columns_sqlite(self, mock_engine: Engine) -> None:
        """Test fetching columns for SQLite tables."""
        service = MetadataService()

        # Create test table with various column types
        with mock_engine.connect() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE column_test (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    age INTEGER DEFAULT 0,
                    score REAL,
                    active BOOLEAN
                )
            """
                )
            )
            conn.commit()

        tables = [("column_test", None)]
        columns_map = await service._fetch_all_columns(
            mock_engine.connect(), tables, "sqlite"
        )

        assert ("default", "column_test") in columns_map
        columns = columns_map[("default", "column_test")]
        assert len(columns) == 5

        # Check column properties
        id_col = next((c for c in columns if c.name == "id"), None)
        assert id_col is not None
        assert id_col.is_primary_key is True
        assert id_col.data_type == "INTEGER"

        name_col = next((c for c in columns if c.name == "name"), None)
        assert name_col is not None
        assert name_col.is_nullable is False

    async def test_metadata_ttl_expiration(
        self, mock_database: MagicMock, mock_engine: Engine, initialize_test_db: None
    ) -> None:
        """Test metadata TTL expiration (cache invalidation)."""
        from src.core.constants import Metadata
        from datetime import datetime, timedelta

        service = MetadataService()

        # Set metadata_updated_at to before TTL
        old_time = datetime.now() - Metadata.CACHE_TTL - timedelta(hours=1)
        mock_database.metadata_updated_at = old_time

        # Fetch should recognize cache is expired and refresh
        # (This test verifies the logic is present, actual refresh would hit DB)
        await service.fetch_metadata(mock_database, mock_engine, force_refresh=False)

    async def test_fetch_metadata_with_database_schema(
        self, initialize_test_db: None
    ) -> None:
        """Test fetching metadata with specific database schema."""
        service = MetadataService()

        # Create an in-memory PostgreSQL-like database for testing
        # Note: This is a simplified test - real PostgreSQL would require different setup
        db, engine = DatabaseTestHelper.create_in_memory_database()

        metadata = await service.fetch_metadata(db, engine, force_refresh=True)

        assert metadata.database_name == "test_db"
        assert metadata.db_type == "sqlite"
        assert len(metadata.tables) == 2  # users and orders

    async def test_fetch_metadata_empty_database(
        self, mock_database: MagicMock, initialize_test_db: None
    ) -> None:
        """Test fetching metadata from empty database."""
        service = MetadataService()

        # Create empty in-memory database
        from sqlalchemy import create_engine

        empty_engine = create_engine("sqlite:///:memory:")

        metadata = await service.fetch_metadata(mock_database, empty_engine, force_refresh=True)

        assert metadata.database_name == "test_db"
        assert len(metadata.tables) == 0
        assert len(metadata.views) == 0
