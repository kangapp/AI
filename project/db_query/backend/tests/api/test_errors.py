"""Simple tests for API errors."""

import pytest
from fastapi import HTTPException

from src.api.errors import ErrorCode, APIError, handle_api_error


@pytest.mark.unit
def test_error_code_exists() -> None:
    """Test that ErrorCode enum has values."""
    assert ErrorCode.DATABASE_NOT_FOUND is not None
    assert ErrorCode.VALIDATION_ERROR is not None
    assert ErrorCode.SQL_SYNTAX_ERROR is not None


@pytest.mark.unit
def test_api_error_creation() -> None:
    """Test creating APIError."""
    error = APIError(code=ErrorCode.DATABASE_NOT_FOUND, message="Not found")
    assert error.code == ErrorCode.DATABASE_NOT_FOUND
    assert error.message == "Not found"


@pytest.mark.unit
def test_handle_api_error() -> None:
    """Test handling APIError."""
    error = APIError(code=ErrorCode.DATABASE_NOT_FOUND, message="Not found")
    response = handle_api_error(error)
    assert response is not None


@pytest.mark.unit
def test_handle_http_exception() -> None:
    """Test handling HTTPException."""
    error = HTTPException(status_code=404, detail="Not found")
    response = handle_api_error(error)
    assert response is not None


@pytest.mark.unit
def test_handle_generic_exception() -> None:
    """Test handling generic exception."""
    error = ValueError("Some error")
    response = handle_api_error(error)
    assert response is not None
