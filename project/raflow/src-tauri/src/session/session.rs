//! Recording session implementation.

use crate::audio::AudioPipeline;
use crate::clipboard;
use crate::config;
use crate::transcription::TranscriptionClient;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::Mutex;

/// Session errors.
#[derive(Error, Debug)]
pub enum SessionError {
    /// API key not configured.
    #[error("API key not configured. Please set ELEVENLABS_API_KEY environment variable or configure in settings.")]
    ApiKeyMissing,

    /// WebSocket connection failed.
    #[error("WebSocket connection failed: {0}")]
    ConnectionFailed(String),

    /// Audio capture failed.
    #[error("Audio capture failed: {0}")]
    AudioCaptureFailed(String),

    /// Operation timed out.
    #[error("Operation timed out")]
    Timeout,

    /// Session is already active.
    #[error("Recording session is already active")]
    AlreadyActive,

    /// Session is not active.
    #[error("No active recording session")]
    NotActive,

    /// Clipboard error.
    #[error("Clipboard error: {0}")]
    Clipboard(String),
}

/// Shared session state managed by Tauri.
pub struct SessionState {
    /// Current active session (None if not recording).
    pub session: Arc<Mutex<Option<RecordingSession>>>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
        }
    }
}

/// Recording session that coordinates audio capture and transcription.
pub struct RecordingSession {
    /// Audio pipeline for capturing and resampling.
    audio_pipeline: AudioPipeline,
    /// WebSocket client for transcription.
    ws_client: TranscriptionClient,
    /// Flag indicating if session is active.
    is_active: Arc<AtomicBool>,
    /// Latest committed transcript text.
    committed_text: Arc<Mutex<String>>,
}

impl RecordingSession {
    /// Create a new recording session.
    ///
    /// # Errors
    ///
    /// Returns [`SessionError::ApiKeyMissing`] if API key is not configured.
    /// Returns [`SessionError::AudioCaptureFailed`] if audio device cannot be initialized.
    pub fn new() -> Result<Self, SessionError> {
        // Check API key first
        let api_key = config::get_api_key()
            .map_err(|e| SessionError::ConnectionFailed(e.to_string()))?
            .ok_or(SessionError::ApiKeyMissing)?;

        // Initialize audio pipeline
        let audio_pipeline = AudioPipeline::new()
            .map_err(|e| SessionError::AudioCaptureFailed(e.to_string()))?;

        Ok(Self {
            audio_pipeline,
            ws_client: TranscriptionClient::new(api_key),
            is_active: Arc::new(AtomicBool::new(false)),
            committed_text: Arc::new(Mutex::new(String::new())),
        })
    }

    /// Check if the session is currently active.
    #[must_use]
    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }
}
