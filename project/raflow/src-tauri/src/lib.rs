pub mod audio;
pub mod commands;
pub mod transcription;

use commands::RecordingState;
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
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            error!("Failed to run Tauri application: {}", e);
            panic!("Application startup failed: {}", e);
        });
}
