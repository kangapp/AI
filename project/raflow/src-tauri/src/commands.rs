//! Tauri commands for frontend communication

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

/// Global state for recording
pub struct RecordingState {
    pub is_recording: Arc<AtomicBool>,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Start recording
#[tauri::command]
pub async fn start_recording(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RecordingState>();

    if state.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".into());
    }

    state.is_recording.store(true, Ordering::SeqCst);

    // Emit event to frontend
    app.emit("recording-state-changed", true)
        .map_err(|e| e.to_string())?;

    tracing::info!("Recording started");
    Ok("Recording started".into())
}

/// Stop recording
#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RecordingState>();

    if !state.is_recording.load(Ordering::SeqCst) {
        return Err("Not recording".into());
    }

    state.is_recording.store(false, Ordering::SeqCst);

    // Emit event to frontend
    app.emit("recording-state-changed", false)
        .map_err(|e| e.to_string())?;

    tracing::info!("Recording stopped");
    Ok("Recording stopped".into())
}

/// Get recording state
#[tauri::command]
pub fn is_recording(app: AppHandle) -> bool {
    let state = app.state::<RecordingState>();
    state.is_recording.load(Ordering::SeqCst)
}
