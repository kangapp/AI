//! WebSocket message types for ElevenLabs API

use serde::{Deserialize, Serialize};

/// Incoming message from ElevenLabs
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "message_type")]
pub enum IncomingMessage {
    #[serde(rename = "session_started")]
    SessionStarted { session_id: String },

    #[serde(rename = "partial_transcript")]
    PartialTranscript {
        text: String,
        #[serde(default)]
        created_at_ts: Option<i64>,
    },

    #[serde(rename = "committed_transcript")]
    CommittedTranscript {
        text: String,
        #[serde(default)]
        created_at_ts: Option<i64>,
    },

    #[serde(rename = "error")]
    Error {
        #[serde(default)]
        message: String,
    },
}

/// Outgoing message to ElevenLabs
#[derive(Debug, Clone, Serialize)]
pub struct OutgoingMessage {
    pub message_type: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_base_64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit: Option<bool>,
}

impl OutgoingMessage {
    /// Create an audio chunk message
    pub fn audio(base64: String) -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(base64),
            commit: None,
        }
    }

    /// Create a commit message (end of speech)
    pub fn commit() -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(String::new()),
            commit: Some(true),
        }
    }
}

/// Transcription event for internal use
#[derive(Debug, Clone)]
pub enum TranscriptionEvent {
    SessionStarted { session_id: String },
    Partial { text: String },
    Committed { text: String },
    Error { message: String },
}

impl TryFrom<IncomingMessage> for TranscriptionEvent {
    type Error = String;

    fn try_from(msg: IncomingMessage) -> Result<Self, String> {
        match msg {
            IncomingMessage::SessionStarted { session_id } => {
                Ok(TranscriptionEvent::SessionStarted { session_id })
            }
            IncomingMessage::PartialTranscript { text, .. } => {
                Ok(TranscriptionEvent::Partial { text })
            }
            IncomingMessage::CommittedTranscript { text, .. } => {
                Ok(TranscriptionEvent::Committed { text })
            }
            IncomingMessage::Error { message } => {
                Ok(TranscriptionEvent::Error { message })
            }
        }
    }
}
