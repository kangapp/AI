//! Recording session implementation.

use crate::clipboard;
use crate::config;
use crate::session::websocket_task::run_transcription_task;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
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
///
/// This struct is designed to be `Send + Sync` so it can be safely
/// stored in Tauri's state management. The non-Send/Sync components
/// (audio stream) are managed in separate threads.
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
///
/// This struct is designed to be `Send + Sync` by spawning audio capture
/// in a dedicated thread and communicating via channels.
pub struct RecordingSession {
    /// Channel sender for audio data.
    audio_sender: Option<mpsc::Sender<Vec<i16>>>,
    /// Channel sender for commit signals.
    commit_sender: Option<mpsc::Sender<()>>,
    /// Flag indicating if session is active.
    is_active: Arc<AtomicBool>,
    /// Latest committed transcript text.
    committed_text: Arc<Mutex<String>>,
    /// Cancellation token for stopping tasks.
    cancel_token: Arc<AtomicBool>,
    /// Audio pipeline thread handle.
    audio_thread_handle: Option<thread::JoinHandle<()>>,
}

impl RecordingSession {
    /// Create a new recording session.
    ///
    /// # Errors
    ///
    /// Returns [`SessionError::ApiKeyMissing`] if API key is not configured.
    pub fn new() -> Result<Self, SessionError> {
        // Check API key first
        let _api_key = config::get_api_key()
            .map_err(|e| SessionError::ConnectionFailed(e.to_string()))?
            .ok_or(SessionError::ApiKeyMissing)?;

        Ok(Self {
            audio_sender: None,
            commit_sender: None,
            is_active: Arc::new(AtomicBool::new(false)),
            committed_text: Arc::new(Mutex::new(String::new())),
            cancel_token: Arc::new(AtomicBool::new(false)),
            audio_thread_handle: None,
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
        self.audio_sender = Some(audio_tx.clone());

        // Create channel for commit signals
        let (commit_tx, commit_rx) = mpsc::channel::<()>(1);
        self.commit_sender = Some(commit_tx);

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
                commit_rx,
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

        // 发送会话启动事件（在主线程中）
        let _ = app_handle.emit("session-starting", 1);

        // Spawn audio pipeline in a dedicated thread
        // This is necessary because cpal::Stream is not Send
        let audio_cancel_token = self.cancel_token.clone();
        let audio_cancel_token_for_callback = self.cancel_token.clone();
        let app_handle_for_audio = app_handle.clone();
        let handle = thread::spawn(move || {
            use crate::audio::AudioPipeline;
            use std::sync::Mutex;

            // 发送音频线程启动事件
            let _ = app_handle_for_audio.emit("audio-thread-started", 1);
            tracing::info!("[AUDIO-THREAD] Thread started, creating pipeline...");

            // Shared RMS value for throttled emit (protected by Mutex)
            let latest_rms = Arc::new(Mutex::new(0.0f64));
            let latest_rms_clone = latest_rms.clone();
            let app_handle_for_timer = app_handle_for_audio.clone();

            // Spawn a timer thread to emit audio-level events at 20 FPS (every 50ms)
            // This avoids high-frequency emit from audio callback which may not work in production
            let timer_cancel_token = audio_cancel_token.clone();
            let timer_handle = thread::spawn(move || {
                // 发送 timer 线程启动事件
                let _ = app_handle_for_timer.emit("audio-timer-started", 1);

                while !timer_cancel_token.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_millis(50));
                    if timer_cancel_token.load(Ordering::SeqCst) {
                        break;
                    }
                    let rms = *latest_rms_clone.lock().unwrap();
                    // 始终发送事件
                    let _ = app_handle_for_timer.emit("audio-level", rms);
                }
                tracing::debug!("Audio level timer thread stopped");
            });

            // Create audio pipeline in this thread
            let mut pipeline = match AudioPipeline::new() {
                Ok(p) => {
                    tracing::info!("[AUDIO-THREAD] Pipeline created successfully");
                    let _ = app_handle_for_audio.emit("audio-pipeline-created", 1);
                    p
                },
                Err(e) => {
                    tracing::error!("Failed to create audio pipeline: {}", e);
                    let _ = app_handle_for_audio.emit("audio-pipeline-failed", e.to_string());
                    return;
                }
            };

            // Start audio capture
            if let Err(e) = pipeline.start(move |pcm_data: Vec<i16>| {
                if audio_cancel_token_for_callback.load(Ordering::SeqCst) {
                    return;
                }

                // Calculate audio level (RMS)
                let rms = if !pcm_data.is_empty() {
                    let sum_of_squares: f64 = pcm_data
                        .iter()
                        .map(|&s| {
                            let normalized = f64::from(s) / 32768.0;
                            normalized * normalized
                        })
                        .sum();
                    let calc_rms = (sum_of_squares / pcm_data.len() as f64).sqrt();
                    // DEBUG: 始终打印 RMS 计算结果
                    tracing::info!("[RMS] pcm_size={}, rms={:.6}", pcm_data.len(), calc_rms);
                    calc_rms
                } else {
                    0.0
                };

                // Update shared RMS value (timer thread will emit it)
                *latest_rms.lock().unwrap() = rms;

                // Send audio data to WebSocket task
                let _ = audio_tx.blocking_send(pcm_data);
            }) {
                tracing::error!("Failed to start audio pipeline: {}", e);
                return;
            }

            // Keep thread alive until cancelled
            while !audio_cancel_token.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_millis(100));
            }

            // Stop pipeline
            pipeline.stop();

            // Wait for timer thread
            let _ = timer_handle.join();

            tracing::debug!("Audio pipeline thread stopped");
        });

        self.audio_thread_handle = Some(handle);

        // Emit recording started event
        let _ = app_handle.emit("recording-state-changed", true);

        tracing::info!("Recording session started successfully");
        Ok(())
    }

    /// Run the WebSocket communication task.
    async fn run_websocket_task(
        api_key: String,
        audio_rx: mpsc::Receiver<Vec<i16>>,
        commit_rx: mpsc::Receiver<()>,
        is_active: Arc<AtomicBool>,
        committed_text: Arc<Mutex<String>>,
        cancel_token: Arc<AtomicBool>,
        app_handle: AppHandle,
    ) -> Result<(), SessionError> {
        // Run the transcription task
        let result = run_transcription_task(
            api_key,
            audio_rx,
            commit_rx,
            committed_text,
            cancel_token,
            app_handle.clone(),
        )
        .await;

        // Reset active state
        is_active.store(false, Ordering::SeqCst);

        // Note: Don't emit recording-state-changed here, let the stop() method handle it
        // This prevents duplicate events and ensures proper state synchronization

        // Emit error event if failed
        if let Err(ref e) = result {
            tracing::error!("Transcription task failed: {}", e);
            let error_type = if e.contains("Authentication") || e.contains("API key") {
                "auth"
            } else if e.contains("Connection") || e.contains("network") {
                "network"
            } else {
                "server"
            };
            let _ = app_handle.emit("transcription-error", serde_json::json!({
                "type": error_type,
                "message": e
            }));
        }

        result.map_err(SessionError::ConnectionFailed)
    }

    /// Stop the recording session.
    ///
    /// This commits the transcription, stops audio capture, and copies
    /// the final text to the clipboard.
    ///
    /// # Errors
    ///
    /// Returns [`SessionError::NotActive`] if no session is active.
    /// Returns [`SessionError::Clipboard`] if clipboard write fails.
    pub async fn stop(&mut self, app_handle: AppHandle) -> Result<String, SessionError> {
        if !self.is_active.load(Ordering::SeqCst) {
            return Err(SessionError::NotActive);
        }

        tracing::info!("Stopping recording session...");

        // Send commit signal before stopping
        if let Some(tx) = &self.commit_sender {
            let _ = tx.send(()).await;
            tracing::debug!("Sent commit signal");
            // Wait a bit for the committed transcript
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        // Signal cancellation (this will stop the audio thread)
        self.cancel_token.store(true, Ordering::SeqCst);

        // Wait for audio thread to finish
        // Use spawn_blocking to avoid blocking tokio runtime
        if let Some(handle) = self.audio_thread_handle.take() {
            let _ = tokio::task::spawn_blocking(move || {
                let _ = handle.join();
            })
            .await;
        }

        // Clear audio sender
        self.audio_sender = None;

        // Clear commit sender
        self.commit_sender = None;

        // Mark as inactive
        self.is_active.store(false, Ordering::SeqCst);

        // Get committed text
        let text = self.committed_text.lock().await.clone();

        // Copy to clipboard if not empty
        if !text.is_empty() {
            clipboard::write_to_clipboard(&text)
                .map_err(|e| SessionError::Clipboard(e.to_string()))?;
            tracing::info!("Copied transcription to clipboard: {} chars", text.len());
        }

        // Clear committed text for next session
        self.committed_text.lock().await.clear();

        // Emit recording stopped event
        let _ = app_handle.emit("recording-state-changed", false);

        tracing::info!("Recording session stopped");
        Ok(text)
    }
}
