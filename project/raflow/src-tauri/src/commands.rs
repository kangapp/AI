//! Tauri commands for frontend communication

use crate::session::{RecordingSession, SessionState};
use tauri::{AppHandle, Manager};

/// Start recording
#[tauri::command]
pub async fn start_recording(app: AppHandle) -> Result<String, String> {
    let state = app.state::<SessionState>();
    let mut session_guard = state.session.lock().await;

    // Check if already recording
    if let Some(session) = session_guard.as_ref() {
        if session.is_active() {
            return Err("Already recording".into());
        }
    }

    // Create new session
    let mut session = RecordingSession::new()
        .map_err(|e| e.to_string())?;

    // Start the session
    session.start(app.clone()).await
        .map_err(|e| e.to_string())?;

    // Store session
    *session_guard = Some(session);

    tracing::info!("Recording started via command");
    Ok("Recording started".into())
}

/// Stop recording
#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<String, String> {
    let state = app.state::<SessionState>();
    let mut session_guard = state.session.lock().await;

    let session = session_guard.as_mut()
        .ok_or_else(|| "No active session".to_string())?;

    if !session.is_active() {
        return Err("Not recording".into());
    }

    // Stop the session and get transcribed text
    let text = session.stop(app.clone()).await
        .map_err(|e| e.to_string())?;

    tracing::info!("Recording stopped via command, text length: {}", text.len());
    Ok(text)
}

/// Check if currently recording
#[tauri::command]
pub async fn is_recording(app: AppHandle) -> bool {
    let state = app.state::<SessionState>();
    let session_guard = state.session.lock().await;

    session_guard.as_ref().is_some_and(|s| s.is_active())
}
