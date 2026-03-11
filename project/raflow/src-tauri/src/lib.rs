pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod config;
pub mod session;
pub mod transcription;

use session::{RecordingSession, SessionState};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
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
            commands::get_window_settings,
            commands::save_window_settings,
            commands::set_window_position,
            commands::set_window_size,
            commands::show_window,
            commands::hide_window,
            commands::start_dragging,
            commands::save_window_position,
        ])
        .setup(|app| {
            // Register Cmd+Shift+H shortcut
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyH);

            let app_handle = app.handle().clone();

            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                let app_handle = app_handle.clone();

                // Only handle on Pressed, ignore Released to prevent double-trigger
                if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    return;
                }

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

            // 创建托盘菜单
            let show_item = MenuItem::with_id(app, "show", "打开悬浮窗", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "设置...", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .menu(&menu)
                .tooltip("RaFlow - Ready")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "settings" => {
                            // 发送事件到前端切换到设置视图
                            let _ = app.emit("open-settings", ());
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            info!("Tray icon created");

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to run Tauri application: {}", e);
            panic!("Application startup failed: {}", e);
        });
}
