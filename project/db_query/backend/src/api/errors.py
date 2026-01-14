"""Unified error handling for API endpoints."""

from enum import Enum
from typing import Any

from fastapi import HTTPException, status


class ErrorCode(str, Enum):
    """Standard error codes for API responses."""

    # Validation errors (4xx)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SQL_SYNTAX_ERROR = "SQL_SYNTAX_ERROR"
    INVALID_STATEMENT_TYPE = "INVALID_STATEMENT_TYPE"
    INVALID_QUERY_TYPE = "INVALID_QUERY_TYPE"

    # Not found errors (404)
    DATABASE_NOT_FOUND = "DATABASE_NOT_FOUND"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"

    # Rate limiting (429)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    REQUEST_TOO_LARGE = "REQUEST_TOO_LARGE"

    # Server errors (5xx)
    QUERY_EXECUTION_ERROR = "QUERY_EXECUTION_ERROR"
    QUERY_TIMEOUT = "QUERY_TIMEOUT"
    LLM_SERVICE_ERROR = "LLM_SERVICE_ERROR"
    METADATA_FETCH_ERROR = "METADATA_FETCH_ERROR"
    EXPORT_ERROR = "EXPORT_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class APIError(Exception):
    """Base exception for API errors with structured response."""

    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ) -> None:
        """Initialize API error.

        Args:
            message: User-friendly error message.
            code: Standard error code.
            http_status: HTTP status code to return.
        """
        self.message = message
        self.code = code
        self.http_status = http_status
        super().__init__(message)


class ValidationError(APIError):
    """Validation error (400)."""

    def __init__(self, message: str, code: ErrorCode = ErrorCode.VALIDATION_ERROR) -> None:
        super().__init__(message, code, status.HTTP_400_BAD_REQUEST)


class NotFoundError(APIError):
    """Resource not found error (404)."""

    def __init__(self, message: str, code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND) -> None:
        super().__init__(message, code, status.HTTP_404_NOT_FOUND)


def handle_api_error(e: Exception) -> HTTPException:
    """Convert an exception to an HTTPException with structured detail.

    Args:
        e: The exception to handle.

    Returns:
        An HTTPException with structured error detail.
    """
    if isinstance(e, APIError):
        return HTTPException(
            status_code=e.http_status,
            detail={"code": e.code, "message": e.message},
        )

    # For ValueError, treat as validation error
    if isinstance(e, ValueError):
        error_msg = str(e)
        if "Only SELECT queries are allowed" in error_msg:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": ErrorCode.INVALID_STATEMENT_TYPE, "message": error_msg},
            )
        if "SQL syntax error" in error_msg:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": ErrorCode.SQL_SYNTAX_ERROR, "message": error_msg},
            )
        if "not found" in error_msg.lower():
            return HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": ErrorCode.RESOURCE_NOT_FOUND, "message": error_msg},
            )
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.VALIDATION_ERROR, "message": error_msg},
        )

    # For TimeoutError
    if isinstance(e, TimeoutError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.QUERY_TIMEOUT,
                "message": "Query execution exceeded timeout limit",
            },
        )

    # For unknown exceptions, log internally but return generic message
    # TODO: Add proper logging when logging system is implemented
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"code": ErrorCode.INTERNAL_ERROR, "message": "An unexpected error occurred"},
    )


def create_error_response(code: ErrorCode, message: str) -> dict[str, Any]:
    """Create a standardized error response dictionary.

    Args:
        code: The error code.
        message: The error message.

    Returns:
        A dictionary with error information.
    """
    return {"code": code, "message": message}
