//! Tauri commands for frontend communication

use crate::config::{FloatingWindowSettings, WindowPosition, WindowSize};
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

#[tauri::command]
pub async fn get_window_settings(_app: AppHandle) -> Result<FloatingWindowSettings, String> {
    let config = crate::config::load_config().map_err(|e| e.to_string())?;
    Ok(config.floating_window)
}

#[tauri::command]
pub async fn save_window_settings(
    _app: AppHandle,
    settings: FloatingWindowSettings,
) -> Result<(), String> {
    let mut config = crate::config::load_config().map_err(|e| e.to_string())?;
    config.floating_window = settings;
    crate::config::save_config(&config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_window_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())?;

    // Save to config
    let mut config = crate::config::load_config().map_err(|e| e.to_string())?;
    config.floating_window.position = Some(WindowPosition { x, y });
    crate::config::save_config(&config).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_window_size(app: AppHandle, width: u32, height: u32) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())?;

    // Save to config
    let mut config = crate::config::load_config().map_err(|e| e.to_string())?;
    config.floating_window.window_size = WindowSize { width, height };
    crate::config::save_config(&config).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn show_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn hide_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_dragging(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.start_dragging().map_err(|e| e.to_string())?;
    Ok(())
}
