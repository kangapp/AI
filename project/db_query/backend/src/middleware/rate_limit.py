"""Rate limiting for API endpoints."""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# Create limiter instance
limiter = Limiter(key_func=get_remote_address)


def get_remote_address_from_request(request: Request) -> str:
    """Get remote address from request for rate limiting.

    Args:
        request: The incoming request.

    Returns:
        The client's IP address.
    """
    return get_remote_address(request)
