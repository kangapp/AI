"""Type stubs for slowapi."""

from collections.abc import Callable
from typing import Any, TypeVar

from fastapi import Request

_F = TypeVar("_F", bound=Callable[..., Any])

class Limiter:
    """Rate limiter."""

    def __init__(self, key_func: Callable[[Request], str]) -> None:
        """Initialize the limiter.

        Args:
            key_func: Function to extract rate limit key from request.
        """
        ...

    def limit(self, limit_value: str) -> Callable[[_F], _F]:
        """Decorator to apply rate limit to endpoint.

        Args:
            limit_value: Rate limit string (e.g., "30/minute").

        Returns:
            Decorator function.
        """
        ...

def get_remote_address(request: Request) -> str:
    """Get remote address from request.

    Args:
        request: The incoming request.

    Returns:
        The client's IP address.
    """
    ...
