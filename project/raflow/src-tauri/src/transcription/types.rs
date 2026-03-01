//! WebSocket message types for ElevenLabs API
//!
//! This module defines the message types used for WebSocket communication
//! with the ElevenLabs transcription API.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur during transcription message processing
#[derive(Error, Debug)]
pub enum TranscriptionError {
    /// Failed to parse incoming message
    #[error("Failed to parse message: {0}")]
    ParseError(String),
}

/// Incoming message from ElevenLabs WebSocket
///
/// These messages are received from the ElevenLabs API in response to
/// audio input. The message type is determined by the `message_type` field.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "message_type")]
pub enum IncomingMessage {
    /// Session has been successfully established
    ///
    /// This is the first message received after connecting.
    #[serde(rename = "session_started")]
    SessionStarted {
        /// Unique identifier for this transcription session
        session_id: String,
    },

    /// Partial (interim) transcription result
    ///
    /// Received while audio is being processed. These results may change
    /// as more audio is received.
    #[serde(rename = "partial_transcript")]
    PartialTranscript {
        /// The transcribed text (may be incomplete)
        text: String,
        /// Timestamp when this result was created (Unix timestamp in milliseconds)
        #[serde(default)]
        created_at_ts: Option<i64>,
    },

    /// Final committed transcription result
    ///
    /// Received when a segment of speech is complete. This text will not change.
    #[serde(rename = "committed_transcript")]
    CommittedTranscript {
        /// The final transcribed text
        text: String,
        /// Timestamp when this result was created (Unix timestamp in milliseconds)
        #[serde(default)]
        created_at_ts: Option<i64>,
    },

    /// Error message from the API
    #[serde(rename = "error")]
    Error {
        /// Human-readable error description
        #[serde(default)]
        message: String,
    },

    /// Authentication error from the API
    ///
    /// Received when the API key is invalid or expired.
    #[serde(rename = "auth_error")]
    AuthError {
        /// Human-readable error description
        #[serde(default)]
        message: String,
    },
}

/// VAD (Voice Activity Detection) 配置参数
///
/// 用于优化语音检测灵敏度，适应不同语速和噪音环境。
#[derive(Debug, Clone, Serialize)]
pub struct VadConfig {
    /// VAD 置信度阈值 (0.0-1.0)
    /// 更高的值要求更强的信号才被识别为语音
    /// 推荐值: 0.55 (默认 0.4)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_threshold: Option<f32>,

    /// 静音时长阈值（秒）
    /// 超过此时长的静音会触发提交
    /// 推荐值: 1.0 (默认 1.5)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_silence_threshold_secs: Option<f32>,

    /// 最小语音片段时长（毫秒）
    /// 短于此值的语音片段会被忽略
    /// 推荐值: 80 (默认 100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_speech_duration_ms: Option<u32>,

    /// 最小静音片段时长（毫秒）
    /// 短于此值的静音不会被视为句子结束
    /// 推荐值: 150 (默认 100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_silence_duration_ms: Option<u32>,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            vad_threshold: Some(0.55),
            vad_silence_threshold_secs: Some(1.0),
            min_speech_duration_ms: Some(80),
            min_silence_duration_ms: Some(150),
        }
    }
}

/// Outgoing message to ElevenLabs WebSocket
///
/// These messages are sent to the ElevenLabs API to transmit audio data
/// and control the transcription session.
#[derive(Debug, Clone, Serialize)]
pub struct OutgoingMessage {
    /// Message type identifier
    pub message_type: &'static str,
    /// Base64-encoded audio data (PCM 16kHz mono)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_base_64: Option<String>,
    /// Whether to commit the current audio buffer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit: Option<bool>,
    /// Audio sample rate in Hz
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    /// VAD configuration (only sent in first message)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_threshold: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_silence_threshold_secs: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_speech_duration_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_silence_duration_ms: Option<u32>,
}

impl OutgoingMessage {
    /// Create an audio chunk message
    ///
    /// Sends a chunk of audio data to the API for transcription.
    /// The audio should be base64-encoded PCM at 16kHz mono.
    ///
    /// # Arguments
    ///
    /// * `base64` - Base64-encoded audio data
    #[must_use]
    pub fn audio(base64: String) -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(base64),
            commit: None,
            sample_rate: None,
            vad_threshold: None,
            vad_silence_threshold_secs: None,
            min_speech_duration_ms: None,
            min_silence_duration_ms: None,
        }
    }

    /// Create an audio chunk message with VAD configuration
    ///
    /// This should be used for the first audio message to configure
    /// the transcription engine.
    #[must_use]
    pub fn audio_with_config(base64: String, config: &VadConfig) -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(base64),
            commit: None,
            sample_rate: Some(16000),
            vad_threshold: config.vad_threshold,
            vad_silence_threshold_secs: config.vad_silence_threshold_secs,
            min_speech_duration_ms: config.min_speech_duration_ms,
            min_silence_duration_ms: config.min_silence_duration_ms,
        }
    }

    /// Create a commit message (end of speech)
    ///
    /// Signals that the current audio segment is complete and
    /// a final transcription should be generated.
    #[must_use]
    pub fn commit() -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(String::new()),
            commit: Some(true),
            sample_rate: None,
            vad_threshold: None,
            vad_silence_threshold_secs: None,
            min_speech_duration_ms: None,
            min_silence_duration_ms: None,
        }
    }
}

/// Transcription event for internal use
///
/// These events are produced by processing incoming WebSocket messages
/// and are used internally by the transcription client.
#[derive(Debug, Clone)]
pub enum TranscriptionEvent {
    /// Session has been established
    SessionStarted {
        /// Unique session identifier
        session_id: String,
    },
    /// Partial (interim) transcription result
    Partial {
        /// The transcribed text (may be incomplete)
        text: String,
    },
    /// Final committed transcription result
    Committed {
        /// The final transcribed text
        text: String,
    },
    /// Error occurred during transcription
    Error {
        /// Human-readable error description
        message: String,
    },
}

// Note: Using From instead of TryFrom since the conversion from IncomingMessage
// to TranscriptionEvent never fails - all variants map directly.
impl From<IncomingMessage> for TranscriptionEvent {
    fn from(msg: IncomingMessage) -> Self {
        match msg {
            IncomingMessage::SessionStarted { session_id } => {
                TranscriptionEvent::SessionStarted { session_id }
            }
            IncomingMessage::PartialTranscript { text, .. } => TranscriptionEvent::Partial { text },
            IncomingMessage::CommittedTranscript { text, .. } => {
                TranscriptionEvent::Committed { text }
            }
            IncomingMessage::Error { message } => TranscriptionEvent::Error { message },
            IncomingMessage::AuthError { message } => TranscriptionEvent::Error {
                message: format!("Authentication error: {}", message),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_outgoing_message_audio() {
        let msg = OutgoingMessage::audio("dGVzdA==".to_string());
        assert_eq!(msg.message_type, "input_audio_chunk");
        assert_eq!(msg.audio_base_64, Some("dGVzdA==".to_string()));
        assert_eq!(msg.commit, None);
    }

    #[test]
    fn test_outgoing_message_commit() {
        let msg = OutgoingMessage::commit();
        assert_eq!(msg.message_type, "input_audio_chunk");
        assert_eq!(msg.audio_base_64, Some(String::new()));
        assert_eq!(msg.commit, Some(true));
    }

    #[test]
    fn test_outgoing_message_serialization() {
        let msg = OutgoingMessage::audio("dGVzdA==".to_string());
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains(r#""message_type":"input_audio_chunk""#));
        assert!(json.contains(r#""audio_base_64":"dGVzdA==""#));
        assert!(!json.contains("commit")); // Should be skipped
    }

    #[test]
    fn test_incoming_message_deserialization_session_started() {
        let json = r#"{"message_type":"session_started","session_id":"test-123"}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        match msg {
            IncomingMessage::SessionStarted { session_id } => {
                assert_eq!(session_id, "test-123");
            }
            _ => panic!("Expected SessionStarted variant"),
        }
    }

    #[test]
    fn test_session_started_with_config() {
        // Test actual server response format with config object
        let json = r#"{
            "message_type": "session_started",
            "session_id": "b1b982e08f2d44cab9fa256fac8f93f3",
            "config": {
                "sample_rate": 16000,
                "audio_format": "pcm_16000",
                "language_code": null,
                "timestamps_granularity": "word",
                "vad_commit_strategy": false,
                "vad_silence_threshold_secs": 1.5,
                "vad_threshold": 0.4,
                "min_speech_duration_ms": 100,
                "min_silence_duration_ms": 100,
                "max_tokens_to_recompute": 5,
                "model_id": "scribe_v2_realtime",
                "disable_logging": false,
                "include_timestamps": false,
                "include_language_detection": false
            }
        }"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        match msg {
            IncomingMessage::SessionStarted { session_id } => {
                assert_eq!(session_id, "b1b982e08f2d44cab9fa256fac8f93f3");
            }
            _ => panic!("Expected SessionStarted variant"),
        }
    }

    #[test]
    fn test_incoming_message_deserialization_partial() {
        let json = r#"{"message_type":"partial_transcript","text":"hello"}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        match msg {
            IncomingMessage::PartialTranscript { text, created_at_ts } => {
                assert_eq!(text, "hello");
                assert_eq!(created_at_ts, None);
            }
            _ => panic!("Expected PartialTranscript variant"),
        }
    }

    #[test]
    fn test_incoming_message_deserialization_committed() {
        let json = r#"{"message_type":"committed_transcript","text":"hello world","created_at_ts":12345}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        match msg {
            IncomingMessage::CommittedTranscript { text, created_at_ts } => {
                assert_eq!(text, "hello world");
                assert_eq!(created_at_ts, Some(12345));
            }
            _ => panic!("Expected CommittedTranscript variant"),
        }
    }

    #[test]
    fn test_incoming_message_deserialization_error() {
        let json = r#"{"message_type":"error","message":"Connection failed"}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        match msg {
            IncomingMessage::Error { message } => {
                assert_eq!(message, "Connection failed");
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[test]
    fn test_conversion_session_started() {
        let msg = IncomingMessage::SessionStarted {
            session_id: "test-123".to_string(),
        };
        let event: TranscriptionEvent = msg.into();
        match event {
            TranscriptionEvent::SessionStarted { session_id } => {
                assert_eq!(session_id, "test-123");
            }
            _ => panic!("Expected SessionStarted variant"),
        }
    }

    #[test]
    fn test_conversion_partial() {
        let msg = IncomingMessage::PartialTranscript {
            text: "hello".to_string(),
            created_at_ts: Some(12345),
        };
        let event: TranscriptionEvent = msg.into();
        match event {
            TranscriptionEvent::Partial { text } => {
                assert_eq!(text, "hello");
            }
            _ => panic!("Expected Partial variant"),
        }
    }

    #[test]
    fn test_conversion_committed() {
        let msg = IncomingMessage::CommittedTranscript {
            text: "hello world".to_string(),
            created_at_ts: Some(12345),
        };
        let event: TranscriptionEvent = msg.into();
        match event {
            TranscriptionEvent::Committed { text } => {
                assert_eq!(text, "hello world");
            }
            _ => panic!("Expected Committed variant"),
        }
    }

    #[test]
    fn test_conversion_error() {
        let msg = IncomingMessage::Error {
            message: "Test error".to_string(),
        };
        let event: TranscriptionEvent = msg.into();
        match event {
            TranscriptionEvent::Error { message } => {
                assert_eq!(message, "Test error");
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[test]
    fn test_transcription_error_display() {
        let err = TranscriptionError::ParseError("invalid JSON".to_string());
        assert_eq!(err.to_string(), "Failed to parse message: invalid JSON");
    }

    #[test]
    fn test_vad_config_default() {
        let config = VadConfig::default();
        assert_eq!(config.vad_threshold, Some(0.55));
        assert_eq!(config.vad_silence_threshold_secs, Some(1.0));
        assert_eq!(config.min_speech_duration_ms, Some(80));
        assert_eq!(config.min_silence_duration_ms, Some(150));
    }

    #[test]
    fn test_outgoing_message_audio_with_config() {
        let config = VadConfig::default();
        let msg = OutgoingMessage::audio_with_config("dGVzdA==".to_string(), &config);

        assert_eq!(msg.message_type, "input_audio_chunk");
        assert_eq!(msg.audio_base_64, Some("dGVzdA==".to_string()));
        assert_eq!(msg.sample_rate, Some(16000));
        assert_eq!(msg.vad_threshold, Some(0.55));
        assert_eq!(msg.vad_silence_threshold_secs, Some(1.0));
        assert_eq!(msg.min_speech_duration_ms, Some(80));
        assert_eq!(msg.min_silence_duration_ms, Some(150));
    }

    #[test]
    fn test_outgoing_message_audio_with_config_serialization() {
        let config = VadConfig::default();
        let msg = OutgoingMessage::audio_with_config("dGVzdA==".to_string(), &config);
        let json = serde_json::to_string(&msg).unwrap();

        assert!(json.contains(r#""message_type":"input_audio_chunk""#));
        assert!(json.contains(r#""audio_base_64":"dGVzdA==""#));
        assert!(json.contains(r#""sample_rate":16000"#));
        assert!(json.contains(r#""vad_threshold":0.55"#));
    }
}
