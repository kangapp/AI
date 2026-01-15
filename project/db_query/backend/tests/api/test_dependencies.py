"""Simple tests for API dependencies."""

import pytest

from src.api.dependencies import get_db_service, get_query_service, get_metadata_service, get_llm_service
from src.services.db_service import DatabaseService
from src.services.query_service import QueryService
from src.services.metadata_service import MetadataService
from src.services.llm_service import LLMService


@pytest.mark.unit
def test_get_db_service_returns_service() -> None:
    """Test that get_db_service returns a DatabaseService."""
    service = get_db_service()
    assert isinstance(service, DatabaseService)


@pytest.mark.unit
def test_get_query_service_returns_service() -> None:
    """Test that get_query_service returns a QueryService."""
    service = get_query_service()
    assert isinstance(service, QueryService)


@pytest.mark.unit
def test_get_metadata_service_returns_service() -> None:
    """Test that get_metadata_service returns a MetadataService."""
    service = get_metadata_service()
    assert isinstance(service, MetadataService)


@pytest.mark.unit
def test_get_llm_service_returns_service() -> None:
    """Test that get_llm_service returns a LLMService."""
    service = get_llm_service()
    assert isinstance(service, LLMService)
