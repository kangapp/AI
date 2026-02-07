// Transcription module - 语音转录模块
// 包含 ElevenLabs Scribe v2 Realtime API 客户端

pub mod client;
pub mod messages;
pub mod robust_client;
pub mod language_config;

// Re-export commonly used types
pub use client::{ScribeClient, ScribeClientEvent};
pub use messages::{TranscriptMessage, ScribeConfig};
pub use robust_client::{ConnectionState, RobustScribeClient};
pub use language_config::{
    LanguageConfig, LanguageCode, SupportedLanguage, AutoLanguageDetection
};
