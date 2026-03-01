pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod config;
pub mod session;
pub mod transcription;

use session::{RecordingSession, SessionState};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tracing::info;

pub fn run() {
    // 加载 .env 文件
    config::init();

    // 初始化日志
    tracing_subscriber::fmt::init();
    info!("Starting RaFlow application");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(SessionState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_recording,
            commands::stop_recording,
            commands::is_recording,
        ])
        .setup(|app| {
            // Register Cmd+Shift+H shortcut
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyH);

            let app_handle = app.handle().clone();

            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                let app_handle = app_handle.clone();
                // Use tauri::async_runtime::spawn instead of tokio::spawn
                // because hotkey callback is not in tokio runtime context
                tauri::async_runtime::spawn(async move {
                    let state = app_handle.state::<SessionState>();

                    // Quick check with lock - only hold lock for the check
                    let should_stop = {
                        let session_guard = state.session.lock().await;
                        session_guard.as_ref().is_some_and(|s| s.is_active())
                    };

                    if should_stop {
                        // Stop recording - acquire lock only for the stop operation
                        let mut session_guard = state.session.lock().await;
                        if let Some(session) = session_guard.as_mut() {
                            if let Err(e) = session.stop(app_handle.clone()).await {
                                tracing::error!("Failed to stop session: {}", e);
                            }
                        }
                    } else {
                        // Start recording - create session outside lock
                        tracing::info!("Hotkey pressed, creating recording session...");
                        match RecordingSession::new() {
                            Ok(mut session) => {
                                tracing::info!("Session created, starting...");
                                if let Err(e) = session.start(app_handle.clone()).await {
                                    tracing::error!("Failed to start session: {}", e);
                                    // Emit error event to frontend
                                    let error_type = if e.to_string().contains("API key") {
                                        "auth"
                                    } else {
                                        "server"
                                    };
                                    let _ = app_handle.emit("transcription-error", serde_json::json!({
                                        "type": error_type,
                                        "message": e.to_string()
                                    }));
                                } else {
                                    tracing::info!("Session started successfully, storing state");
                                    // Only acquire lock to store the session
                                    let mut session_guard = state.session.lock().await;
                                    *session_guard = Some(session);
                                }
                            }
                            Err(e) => {
                                tracing::error!("Failed to create session: {}", e);
                                // Emit error event to frontend
                                let error_type = if e.to_string().contains("API key") {
                                    "auth"
                                } else {
                                    "server"
                                };
                                let _ = app_handle.emit("transcription-error", serde_json::json!({
                                    "type": error_type,
                                    "message": e.to_string()
                                }));
                            }
                        }
                    }
                });
            })?;

            info!("Global shortcut registered: Cmd+Shift+H");
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to run Tauri application: {}", e);
            panic!("Application startup failed: {}", e);
        });
}
