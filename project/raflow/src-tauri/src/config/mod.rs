//! Application configuration module.
//!
//! Handles loading and saving API keys and other settings.
//!
//! # Configuration Sources
//!
//! API keys are loaded from multiple sources in this priority order:
//! 1. Environment variables (`.env` file or system)
//! 2. Configuration file (`config.json`)
//!
//! # Configuration File Location
//!
//! The configuration file is stored in the user's config directory:
//! - **macOS**: `~/Library/Application Support/raflow/config.json`
//! - **Windows**: `%APPDATA%/raflow/config.json`
//! - **Linux**: `~/.config/raflow/config.json`
//!
//! # Example
//!
//! ```no_run
//! use raflow_lib::config::{AppConfig, load_config, save_config, get_api_key};
//!
//! // Load or create default config
//! let mut config = load_config()?;
//!
//! // Set API key
//! config.elevenlabs_api_key = Some("your-api-key".to_string());
//!
//! // Save config
//! save_config(&config)?;
//!
//! // Get API key (checks env var first, then config file)
//! let api_key = get_api_key()?;
//! # Ok::<(), raflow_lib::config::ConfigError>(())
//! ```

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

/// Environment variable name for ElevenLabs API key.
pub const ENV_ELEVENLABS_API_KEY: &str = "ELEVENLABS_API_KEY";

/// Configuration errors.
#[derive(Error, Debug)]
pub enum ConfigError {
    /// Failed to determine config directory.
    #[error("Failed to determine config directory")]
    NoConfigDir,

    /// Failed to create config directory.
    #[error("Failed to create config directory: {0}")]
    CreateDir(String),

    /// Failed to read config file.
    #[error("Failed to read config file: {0}")]
    ReadConfig(String),

    /// Failed to parse config file.
    #[error("Failed to parse config file: {0}")]
    ParseConfig(String),

    /// Failed to write config file.
    #[error("Failed to write config file: {0}")]
    WriteConfig(String),
}

/// Application configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AppConfig {
    /// ElevenLabs API key for speech-to-text.
    pub elevenlabs_api_key: Option<String>,

    /// Sample rate for audio capture (default: 48000).
    #[serde(default = "default_sample_rate")]
    pub sample_rate: u32,

    /// Enable debug logging.
    #[serde(default)]
    pub debug_logging: bool,
}

fn default_sample_rate() -> u32 {
    48000
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            elevenlabs_api_key: None,
            sample_rate: default_sample_rate(),
            debug_logging: false,
        }
    }
}

/// Returns the configuration file path.
///
/// # Errors
///
/// Returns `ConfigError::NoConfigDir` if the config directory cannot be determined.
pub fn config_path() -> Result<PathBuf, ConfigError> {
    let project_dirs =
        ProjectDirs::from("com", "raflow", "raflow").ok_or(ConfigError::NoConfigDir)?;
    Ok(project_dirs.config_dir().join("config.json"))
}

/// Loads the configuration from disk.
///
/// If the config file doesn't exist, returns the default configuration.
///
/// # Errors
///
/// Returns `ConfigError` if the config file exists but cannot be read or parsed.
pub fn load_config() -> Result<AppConfig, ConfigError> {
    let path = config_path()?;

    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| {
        ConfigError::ReadConfig(format!("{}: {}", path.display(), e))
    })?;

    serde_json::from_str(&content).map_err(|e| ConfigError::ParseConfig(e.to_string()))
}

/// Saves the configuration to disk.
///
/// Creates the config directory if it doesn't exist.
///
/// # Errors
///
/// Returns `ConfigError` if the config cannot be written.
pub fn save_config(config: &AppConfig) -> Result<(), ConfigError> {
    let path = config_path()?;
    let dir = path.parent().ok_or(ConfigError::NoConfigDir)?;

    // Create directory if it doesn't exist
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| {
            ConfigError::CreateDir(format!("{}: {}", dir.display(), e))
        })?;
    }

    let content =
        serde_json::to_string_pretty(config).map_err(|e| ConfigError::ParseConfig(e.to_string()))?;

    fs::write(&path, content).map_err(|e| {
        ConfigError::WriteConfig(format!("{}: {}", path.display(), e))
    })?;

    Ok(())
}

/// Gets the ElevenLabs API key from environment variable or config file.
///
/// Priority:
/// 1. `ELEVENLABS_API_KEY` environment variable
/// 2. `elevenlabs_api_key` in config file
///
/// # Errors
///
/// Returns `ConfigError` if the config file cannot be read.
///
/// # Returns
///
/// `Some(key)` if found, `None` if not set anywhere.
pub fn get_api_key() -> Result<Option<String>, ConfigError> {
    let config_file_path = config_path().unwrap_or_else(|e| {
        tracing::warn!("Failed to get config path: {}", e);
        std::path::PathBuf::from("(unknown)")
    });
    tracing::info!("Config file path: {}", config_file_path.display());

    // First check environment variable
    if let Ok(key) = env::var(ENV_ELEVENLABS_API_KEY) {
        if !key.is_empty() && key != "your-api-key-here" {
            tracing::info!("API key found in environment variable");
            return Ok(Some(key));
        }
    }
    tracing::info!("API key not in environment, checking config file...");

    // Fall back to config file
    let config = load_config()?;
    tracing::info!("Config loaded, api_key present: {}", config.elevenlabs_api_key.is_some());
    Ok(config.elevenlabs_api_key)
}

/// Initializes configuration.
///
/// Call this once at application startup.
/// Note: .env file loading is disabled in production builds.
/// Use config file at ~/Library/Application Support/com.raflow.raflow/config.json
#[cfg(debug_assertions)]
pub fn init() {
    // Only load .env in debug builds for development
    let _ = dotenvy::dotenv();
}

#[cfg(not(debug_assertions))]
pub fn init() {
    // In release builds, only use config file
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert!(config.elevenlabs_api_key.is_none());
        assert_eq!(config.sample_rate, 48000);
        assert!(!config.debug_logging);
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig {
            elevenlabs_api_key: Some("test-key".to_string()),
            sample_rate: 16000,
            debug_logging: true,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("test-key"));
        assert!(json.contains("16000"));
        assert!(json.contains("true"));

        let parsed: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.elevenlabs_api_key, Some("test-key".to_string()));
        assert_eq!(parsed.sample_rate, 16000);
        assert!(parsed.debug_logging);
    }

    #[test]
    fn test_config_error_display() {
        let err = ConfigError::NoConfigDir;
        assert!(err.to_string().contains("config directory"));

        let err = ConfigError::ParseConfig("invalid json".to_string());
        assert!(err.to_string().contains("invalid json"));
    }
}
