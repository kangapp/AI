"""Dependency injection for service instances."""

from ..services.db_service import DatabaseService
from ..services.llm_service import LLMService
from ..services.metadata_service import MetadataService
from ..services.query_service import QueryService


def get_db_service() -> DatabaseService:
    """Get a DatabaseService instance.

    Returns:
        A DatabaseService instance.
    """
    return DatabaseService()


def get_query_service() -> QueryService:
    """Get a QueryService instance.

    Returns:
        A QueryService instance.
    """
    return QueryService()


def get_llm_service() -> LLMService:
    """Get an LLMService instance.

    Returns:
        An LLMService instance.
    """
    return LLMService()


def get_metadata_service() -> MetadataService:
    """Get a MetadataService instance.

    Returns:
        A MetadataService instance.
    """
    return MetadataService()


# Type aliases for dependency injection
DatabaseServiceDep = DatabaseService
QueryServiceDep = QueryService
LLMServiceDep = LLMService
MetadataServiceDep = MetadataService
