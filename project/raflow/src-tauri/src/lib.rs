pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod transcription;

use commands::RecordingState;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tracing::{error, info};

pub fn run() {
    // 初始化日志
    tracing_subscriber::fmt::init();
    info!("Starting RaFlow application");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(RecordingState::default())
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
                let state = app_handle.state::<RecordingState>();
                let is_recording = state.is_recording.load(std::sync::atomic::Ordering::SeqCst);

                if is_recording {
                    // Stop recording
                    state.is_recording.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_handle.emit("recording-state-changed", false);
                    info!("Hotkey: Stop recording");
                } else {
                    // Start recording
                    state.is_recording.store(true, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_handle.emit("recording-state-changed", true);
                    info!("Hotkey: Start recording");
                }
            })?;

            info!("Global shortcut registered: Cmd+Shift+H");
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            error!("Failed to run Tauri application: {}", e);
            panic!("Application startup failed: {}", e);
        });
}
