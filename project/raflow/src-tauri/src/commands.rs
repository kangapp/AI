// Tauri commands - Tauri 命令定义
// 暴露给前端的 Rust 函数

use tauri::Manager;

// 音频录制状态
struct AudioState {
    // TODO: 添加录音器实例
}

// 转录状态
struct TranscriptionState {
    // TODO: 添加转录客户端实例
}

/// 开始录音
#[tauri::command]
async fn start_recording() -> Result<(), String> {
    // TODO: 实现录音功能
    Ok(())
}

/// 停止录音
#[tauri::command]
async fn stop_recording() -> Result<(), String> {
    // TODO: 实现停止录音功能
    Ok(())
}

/// 开始转录
#[tauri::command]
async fn start_transcription(_api_key: String) -> Result<(), String> {
    // TODO: 实现 WebSocket 连接和转录
    Ok(())
}

/// 停止转录
#[tauri::command]
async fn stop_transcription() -> Result<(), String> {
    // TODO: 实现停止转录功能
    Ok(())
}

/// 主运行函数 - Tauri 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            start_transcription,
            stop_transcription,
        ])
        .setup(|app| {
            // 初始化应用状态
            app.manage(AudioState {});
            app.manage(TranscriptionState {});

            // 初始化系统托盘（将在后续阶段实现）
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
