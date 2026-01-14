"""Simplified unit tests for DatabaseService."""

import pytest

from src.services.db_service import DatabaseService


@pytest.mark.asyncio
@pytest.mark.unit
class TestDatabaseServiceSimple:
    """Simplified test suite for DatabaseService."""

    async def test_detect_db_type(self) -> None:
        """Test database type detection from URLs."""
        service = DatabaseService()

        assert service._detect_db_type("mysql://localhost/db") == "mysql"
        assert service._detect_db_type("postgresql://localhost/db") == "postgresql"
        assert service._detect_db_type("sqlite:///path/to/db.db") == "sqlite"

        with pytest.raises(ValueError):
            service._detect_db_type("invalid://not-a-db")

    async def test_parse_connection_string_sqlite(self) -> None:
        """Test SQLite connection string parsing."""
        service = DatabaseService()

        parsed = service._parse_connection_string("sqlite:///path/to/db.db")
        assert parsed.scheme == "sqlite"
        assert parsed.database == "path/to/db.db"

    async def test_parse_connection_string_postgresql(self) -> None:
        """Test PostgreSQL connection string parsing."""
        service = DatabaseService()

        parsed = service._parse_connection_string(
            "postgresql://user:pass@localhost:5432/mydb"
        )
        assert parsed.scheme == "postgresql"
        assert parsed.username == "user"
        assert parsed.password == "pass"
        assert parsed.host == "localhost"
        assert parsed.port == 5432
        assert parsed.database == "mydb"

    async def test_connection_string_redaction_with_password(self) -> None:
        """Test that connection strings with passwords are redacted."""
        service = DatabaseService()

        parsed = service._parse_connection_string("postgresql://user:secret@localhost/db")
        redacted = parsed.redact()

        assert "***" in redacted
        assert "secret" not in redacted
        assert "postgresql://***:***@localhost/db" == redacted

    async def test_connection_string_redaction_without_password(self) -> None:
        """Test that SQLite connection strings are redacted properly."""
        service = DatabaseService()

        parsed = service._parse_connection_string("sqlite:///path/to/db.db")
        redacted = parsed.redact()

        assert "sqlite" in redacted
        assert "path/to/db.db" in redacted

    async def test_add_driver_to_url_sqlite(self) -> None:
        """Test adding driver to SQLite URL."""
        service = DatabaseService()

        # SQLite absolute path
        result = service._add_driver_to_url("sqlite:////Users/path/to/db.db", "sqlite")
        assert result == "sqlite:////Users/path/to/db.db"

        # SQLite relative path
        result = service._add_driver_to_url("sqlite:///path/to/db.db", "sqlite")
        assert result == "sqlite:///path/to/db.db"

    async def test_add_driver_to_url_mysql(self) -> None:
        """Test adding driver to MySQL URL."""
        service = DatabaseService()

        result = service._add_driver_to_url("mysql://localhost/db", "mysql")
        assert "mysql+pymysql://" in result
