"""Query and error models."""


class ErrorDetail:
    """Error detail (using dataclass to avoid camelCase on error codes)."""

    code: str
    message: str
    details: str | None = None


class ErrorResponse:
    """Error response."""

    success: bool = False
    error: ErrorDetail
