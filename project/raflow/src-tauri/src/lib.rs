pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod config;
pub mod session;
pub mod transcription;

use session::{RecordingSession, SessionState};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tracing::info;

pub fn run() {
    // 最早打印 - 使用 eprintln 确保输出
    eprintln!("[EARLY] RaFlow starting...");

    // 加载 .env 文件
    config::init();

    // 初始化日志 - 同时输出到文件和 stderr
    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/raflow.log")
        .unwrap_or_else(|_| std::fs::File::create("/tmp/raflow.log").unwrap());

    eprintln!("[EARLY] Log file opened");

    tracing_subscriber::fmt()
        .with_writer(std::sync::Mutex::new(file))
        .with_ansi(false)
        .init();

    info!("Starting RaFlow application");

    // DEBUG: 打印启动信息
    if let Ok(cwd) = std::env::current_dir() {
        info!("[DEBUG] CWD: {:?}", cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        info!("[DEBUG] EXE: {:?}", exe);
    }
    info!("[DEBUG] Args: {:?}", std::env::args().collect::<Vec<_>>());

    // 如果 CWD 是根目录，尝试切换到用户目录
    if let Ok(cwd) = std::env::current_dir() {
        if cwd == std::path::Path::new("/") {
            if let Ok(home) = std::env::var("HOME") {
                let home_path = std::path::Path::new(&home);
                info!("[DEBUG] Changing CWD from / to {:?}", home_path);
                let _ = std::env::set_current_dir(home_path);
            }
        }
    }

    // Debounce state for hotkey
    let last_trigger = Arc::new(std::sync::Mutex::new(Instant::now()));
    let is_processing = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(SessionState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_recording,
            commands::stop_recording,
            commands::is_recording,
        ])
        .setup(move |app| {
            // Register Cmd+Shift+H shortcut
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyH);

            let app_handle = app.handle().clone();
            let heartbeat_handle = app.handle().clone();
            let last_trigger = last_trigger.clone();
            let is_processing = is_processing.clone();

            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                let app_handle = app_handle.clone();
                let last_trigger = last_trigger.clone();
                let is_processing = is_processing.clone();

                // Debounce: ignore if triggered within 300ms
                {
                    let mut last = last_trigger.lock().unwrap();
                    let now = Instant::now();
                    if now.duration_since(*last) < Duration::from_millis(300) {
                        tracing::debug!("Hotkey debounced, ignoring");
                        return;
                    }
                    *last = now;
                }

                // Check if already processing
                if is_processing.load(Ordering::SeqCst) {
                    tracing::debug!("Already processing, ignoring hotkey");
                    return;
                }

                tauri::async_runtime::spawn(async move {
                    is_processing.store(true, Ordering::SeqCst);

                    // 发送测试事件确认热键触发
                    let _ = app_handle.emit("hotkey-triggered", 1);

                    let state = app_handle.state::<SessionState>();

                    // Check if session is active and stop it
                    {
                        let mut session_guard = state.session.lock().await;
                        if let Some(session) = session_guard.as_ref() {
                            if session.is_active() {
                                tracing::info!("Stopping active session...");
                                if let Some(session) = session_guard.as_mut() {
                                    if let Err(e) = session.stop(app_handle.clone()).await {
                                        tracing::error!("Failed to stop session: {}", e);
                                    }
                                }
                                *session_guard = None;
                                is_processing.store(false, Ordering::SeqCst);
                                return;
                            } else {
                                // Session exists but is not active (e.g., WebSocket disconnected)
                                // Clean up the stale session
                                tracing::info!("Cleaning up inactive session...");
                                *session_guard = None;
                            }
                        }
                    }

                    // Start new session
                    tracing::info!("Hotkey pressed, creating recording session...");
                    match RecordingSession::new() {
                        Ok(mut session) => {
                            tracing::info!("Session created, starting...");
                            if let Err(e) = session.start(app_handle.clone()).await {
                                tracing::error!("Failed to start session: {}", e);
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
                                let mut session_guard = state.session.lock().await;
                                *session_guard = Some(session);
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to create session: {}", e);
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

                    is_processing.store(false, Ordering::SeqCst);
                });
            })?;

            info!("Global shortcut registered: Cmd+Shift+H");

            // 启动心跳定时器，测试事件系统
            std::thread::spawn(move || {
                let mut count = 0u64;
                loop {
                    std::thread::sleep(Duration::from_secs(1));
                    count += 1;
                    if let Err(e) = heartbeat_handle.emit("heartbeat", count) {
                        tracing::error!("[HEARTBEAT] Failed to emit: {:?}", e);
                    } else {
                        tracing::info!("[HEARTBEAT] Sent heartbeat #{}", count);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to run Tauri application: {}", e);
            panic!("Application startup failed: {}", e);
        });
}
