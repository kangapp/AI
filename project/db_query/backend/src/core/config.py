"""Configuration management using environment variables."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class AppConfig(BaseModel):
    """Application configuration loaded from environment variables."""

    zai_api_key: str = Field(default="", alias="ZAI_API_KEY")
    db_path: str = Field(default="~/.db_query/db_query.db", alias="DB_PATH")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", alias="LOG_LEVEL"
    )

    def get_resolved_db_path(self) -> Path:
        """Get the resolved database path, expanding ~ and creating parent dirs."""
        path = Path(self.db_path).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path


# Global config instance
_config: AppConfig | None = None


def load_config() -> AppConfig:
    """Load configuration from environment variables."""
    global _config
    if _config is None:
        _config = AppConfig()
    return _config


# Export config singleton for easy access
config = load_config()


def get_config() -> AppConfig:
    """Get the current configuration."""
    return config
