//! Recording session implementation.

use crate::audio::AudioPipeline;
use crate::config;
use crate::session::websocket_task::run_transcription_task;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use thiserror::Error;
use tokio::sync::{mpsc, Mutex};

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
    /// Channel sender for audio data.
    audio_sender: Option<mpsc::Sender<Vec<i16>>>,
    /// Flag indicating if session is active.
    is_active: Arc<AtomicBool>,
    /// Latest committed transcript text.
    committed_text: Arc<Mutex<String>>,
    /// Cancellation token for stopping tasks.
    cancel_token: Arc<AtomicBool>,
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
        let _api_key = config::get_api_key()
            .map_err(|e| SessionError::ConnectionFailed(e.to_string()))?
            .ok_or(SessionError::ApiKeyMissing)?;

        // Initialize audio pipeline
        let audio_pipeline = AudioPipeline::new()
            .map_err(|e| SessionError::AudioCaptureFailed(e.to_string()))?;

        Ok(Self {
            audio_pipeline,
            audio_sender: None,
            is_active: Arc::new(AtomicBool::new(false)),
            committed_text: Arc::new(Mutex::new(String::new())),
            cancel_token: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Check if the session is currently active.
    #[must_use]
    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    /// Start the recording session.
    ///
    /// # Errors
    ///
    /// Returns [`SessionError::AlreadyActive`] if session is already active.
    /// Returns [`SessionError::ApiKeyMissing`] if API key is not configured.
    /// Returns [`SessionError::ConnectionFailed`] if WebSocket connection fails.
    /// Returns [`SessionError::AudioCaptureFailed`] if audio capture fails to start.
    pub async fn start(&mut self, app_handle: AppHandle) -> Result<(), SessionError> {
        if self.is_active.load(Ordering::SeqCst) {
            return Err(SessionError::AlreadyActive);
        }

        tracing::info!("Starting recording session...");

        // Get API key
        let api_key = config::get_api_key()
            .map_err(|e| SessionError::ConnectionFailed(e.to_string()))?
            .ok_or(SessionError::ApiKeyMissing)?;

        // Reset cancellation token
        self.cancel_token.store(false, Ordering::SeqCst);

        // Create channel for audio data (buffer size: ~100 chunks of 1024 samples)
        let (audio_tx, audio_rx) = mpsc::channel::<Vec<i16>>(100);
        self.audio_sender = Some(audio_tx);

        // Clone for async task
        let is_active = self.is_active.clone();
        let committed_text = self.committed_text.clone();
        let cancel_token = self.cancel_token.clone();
        let app_handle_clone = app_handle.clone();

        // Spawn WebSocket task
        tokio::spawn(async move {
            if let Err(e) = Self::run_websocket_task(
                api_key,
                audio_rx,
                is_active,
                committed_text,
                cancel_token,
                app_handle_clone,
            )
            .await
            {
                tracing::error!("WebSocket task error: {}", e);
            }
        });

        // Mark as active
        self.is_active.store(true, Ordering::SeqCst);

        // Start audio pipeline with callback
        let sender = self.audio_sender.clone().unwrap();
        self.audio_pipeline
            .start(move |pcm_data: Vec<i16>| {
                let _ = sender.blocking_send(pcm_data);
            })
            .map_err(|e| SessionError::AudioCaptureFailed(e.to_string()))?;

        // Emit recording started event
        let _ = app_handle.emit("recording-state-changed", true);

        tracing::info!("Recording session started successfully");
        Ok(())
    }

    /// Run the WebSocket communication task.
    async fn run_websocket_task(
        api_key: String,
        audio_rx: mpsc::Receiver<Vec<i16>>,
        is_active: Arc<AtomicBool>,
        committed_text: Arc<Mutex<String>>,
        cancel_token: Arc<AtomicBool>,
        app_handle: AppHandle,
    ) -> Result<(), SessionError> {
        // Run the transcription task
        let result = run_transcription_task(
            api_key,
            audio_rx,
            committed_text,
            cancel_token,
            app_handle.clone(),
        )
        .await;

        // Reset active state
        is_active.store(false, Ordering::SeqCst);

        // Emit recording stopped event
        let _ = app_handle.emit("recording-state-changed", false);

        result.map_err(SessionError::ConnectionFailed)
    }
}
