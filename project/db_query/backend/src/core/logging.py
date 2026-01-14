"""Structured logging configuration using structlog."""

import logging
import sys
from pathlib import Path
from typing import Any

import structlog
from structlog.types import Processor


def configure_logging(
    log_level: str = "INFO", json_output: bool = False, log_file: str | Path | None = None
) -> None:
    """Configure structured logging for the application.

    Args:
        log_level: The logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        json_output: If True, output JSON format; otherwise use readable text format.
        log_file: Optional path to log file. If provided, logs will be written to file.
    """
    import os

    # Auto-detect JSON output for production environments
    if os.getenv("ENV") == "production" or os.getenv("LOG_FORMAT") == "json":
        json_output = True

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Clear any existing handlers
    root_logger.handlers.clear()

    # Create formatter
    formatter = logging.Formatter("%(message)s")

    # Always add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.addHandler(console_handler)

    # Add file handler if log_file is specified
    if log_file:
        log_path = Path(log_file)
        # Create parent directory if it doesn't exist
        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        root_logger.addHandler(file_handler)

    # Configure structlog processors
    processors: list[Processor] = [
        # Add log level
        structlog.stdlib.add_log_level,
        # Add logger name
        structlog.stdlib.add_logger_name,
        # Add timestamp
        structlog.processors.TimeStamper(fmt="iso" if json_output else "%Y-%m-%d %H:%M:%S"),
        # Add call site information (file, line, function)
        structlog.processors.CallsiteParameterAdder(
            [
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.LINENO,
                structlog.processors.CallsiteParameter.FUNC_NAME,
            ]
        ),
        # Handle exceptions
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        # Process exceptions as part of the event
        structlog.processors.UnicodeDecoder(),
    ]

    # Development vs Production rendering
    if json_output:
        # JSON format for production
        processors.append(structlog.processors.JSONRenderer())
    else:
        # Readable text format for development
        processors.append(
            structlog.dev.ConsoleRenderer(
                colors=True,  # Enable colored output
                exception_formatter=structlog.dev.plain_traceback,
            )
        )

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance.

    Args:
        name: The name of the logger (usually __name__).

    Returns:
        A structured logger instance.
    """
    return structlog.get_logger(name)  # type: ignore[return-value]


# Add exception formatter for better error tracking
class ExceptionProcessor:
    """Custom processor for formatting exceptions in logs."""

    def __call__(
        self, logger: Any, method_name: str, event_dict: dict[str, Any]
    ) -> dict[str, Any]:
        """Process the log event and format exceptions.

        Args:
            logger: The logger instance.
            method_name: The logging method name.
            event_dict: The event dictionary.

        Returns:
            The processed event dictionary.
        """
        # Add error information if present
        if "exc_info" in event_dict and event_dict["exc_info"]:
            exc_type, exc_value, exc_tb = event_dict["exc_info"]
            if exc_value:
                event_dict["error"] = {
                    "type": exc_type.__name__ if exc_type else None,
                    "message": str(exc_value),
                }

        return event_dict
