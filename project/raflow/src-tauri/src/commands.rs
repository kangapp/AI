// Tauri commands - Tauri 命令定义
// 暴露给前端的 Rust 函数

use crate::injection::{ClipboardInjector, InjectResult, is_editable_element};
use crate::system_tray;
use tauri::{Emitter, Manager};

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

/// 注入文本到剪贴板
///
/// 参数:
/// - text: 要注入的文本
///
/// 返回:
/// - InjectResult: 注入结果（Injected, ClipboardOnly, 或 Failed）
#[tauri::command]
async fn inject_text(text: String) -> Result<InjectResult, String> {
    // 创建剪贴板注入器
    let mut injector = ClipboardInjector::new()?;

    // 检查可编辑性
    let can_inject = is_editable_element();

    if can_inject {
        // TODO: 添加键盘模拟粘贴
        // 目前只返回 ClipboardOnly
        Ok(injector.inject_text(&text))
    } else {
        // 不可编辑，只复制到剪贴板
        injector.write_to_clipboard(&text)?;
        Ok(InjectResult::ClipboardOnly)
    }
}

/// 检查剪贴板内容（用于测试）
#[tauri::command]
async fn check_clipboard() -> Result<String, String> {
    let injector = ClipboardInjector::new()?;
    injector.read_from_clipboard()
}

/// 主运行函数 - Tauri 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                use tauri_plugin_global_shortcut::ShortcutState;

                match event.state() {
                    ShortcutState::Pressed => {
                        // 快捷键按下时切换录音状态
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("toggle-recording", ());
                        }
                    }
                    ShortcutState::Released => {
                        // 可以在这里处理释放事件
                    }
                }
            })
            .build())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            start_transcription,
            stop_transcription,
            inject_text,
            check_clipboard,
        ])
        .setup(|app| {
            // 初始化应用状态
            app.manage(AudioState {});
            app.manage(TranscriptionState {});

            // 初始化系统托盘
            let app_handle = app.handle().clone();
            if let Err(e) = system_tray::create_system_tray(&app_handle) {
                eprintln!("Failed to create system tray: {}", e);
            }

            // 注册全局快捷键 (Command+Shift+R on macOS, Ctrl+Shift+R on others)
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

                #[cfg(target_os = "macos")]
                let shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyR);
                #[cfg(not(target_os = "macos"))]
                let shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::CONTROL), Code::KeyR);

                if let Err(e) = app.global_shortcut().register(shortcut) {
                    eprintln!("Failed to register global shortcut: {}", e);
                }
            }

            // macOS: 设置为辅助应用（不在 Dock 中显示）
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
