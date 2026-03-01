pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod config;
pub mod session;
pub mod transcription;

use session::{RecordingSession, SessionState};
use tauri::Manager;
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
                tokio::spawn(async move {
                    let state = app_handle.state::<SessionState>();
                    let mut session_guard = state.session.lock().await;

                    if let Some(session) = session_guard.as_ref() {
                        if session.is_active() {
                            // Stop recording
                            if let Some(session) = session_guard.as_mut() {
                                let _ = session.stop(app_handle.clone()).await;
                            }
                            return;
                        }
                    }

                    // Start recording
                    let mut session = match RecordingSession::new() {
                        Ok(s) => s,
                        Err(e) => {
                            tracing::error!("Failed to create session: {}", e);
                            return;
                        }
                    };

                    if let Err(e) = session.start(app_handle.clone()).await {
                        tracing::error!("Failed to start session: {}", e);
                        return;
                    }

                    *session_guard = Some(session);
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
