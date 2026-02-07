// Transcription module - 语音转录模块
// 包含 ElevenLabs Scribe v2 Realtime API 客户端

pub mod client;
pub mod messages;

// Re-export commonly used types
pub use client::{ScribeClient, ScribeClientEvent};
pub use messages::{TranscriptMessage, ScribeConfig};
