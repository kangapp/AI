"""Configuration management using environment variables."""

from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    zai_api_key: str = Field(..., description="ZhipuAI API key (required)")
    db_path: str = Field(default="~/.db_query/db_query.db", description="Path to the SQLite database file")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Logging level",
    )

    def get_resolved_db_path(self) -> Path:
        """Get the resolved database path, expanding ~ and creating parent dirs."""
        path = Path(self.db_path).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path


# Global config instance
_config: AppConfig | None = None


def load_config() -> AppConfig:
    """Load configuration from environment variables.

    Raises:
        ValidationError: If required environment variables are missing.
    """
    global _config
    if _config is None:
        try:
            _config = AppConfig()
        except ValidationError as e:
            raise ValueError(
                "Missing required environment variable: ZAI_API_KEY. "
                "Please set it in your .env file or environment."
            ) from e
    return _config


# Export config singleton for easy access
config = load_config()


def get_config() -> AppConfig:
    """Get the current configuration.

    Returns:
        The application configuration.
    """
    return config
