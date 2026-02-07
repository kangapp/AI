// system_tray.rs - 系统托盘模块
//
// 功能:
// - 创建系统托盘图标和菜单
// - 处理托盘图标事件（左键点击、双击）
// - 处理菜单项事件（开始/停止录音、退出）
// - 与录音状态集成

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

/// 托盘菜单项 ID
const MENU_TOGGLE_RECORDING: &str = "toggle_recording";
const MENU_SHOW_WINDOW: &str = "show_window";
const MENU_HIDE_WINDOW: &str = "hide_window";
const MENU_QUIT: &str = "quit";

/// 创建系统托盘图标和菜单
pub fn create_system_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // 创建菜单项
    let toggle_recording = MenuItemBuilder::with_id(MENU_TOGGLE_RECORDING, "开始录音")
        .build(app)?;
    let show_window = MenuItemBuilder::with_id(MENU_SHOW_WINDOW, "显示窗口")
        .build(app)?;
    let hide_window = MenuItemBuilder::with_id(MENU_HIDE_WINDOW, "隐藏窗口")
        .build(app)?;
    let quit = MenuItemBuilder::with_id(MENU_QUIT, "退出")
        .build(app)?;

    // 创建菜单
    let menu = MenuBuilder::new(app)
        .items(&[
            &toggle_recording,
            &show_window,
            &hide_window,
        ])
        .separator()
        .items(&[&quit])
        .build()?;

    // 创建托盘图标
    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("RaFlow - 实时语音转文字")
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(handle_tray_icon_event)
        .build(app)?;

    Ok(())
}

/// 处理托盘菜单事件
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        MENU_TOGGLE_RECORDING => {
            // 切换录音状态
            if let Some(window) = app.get_webview_window("main") {
                // 发送事件到前端
                let _ = window.emit("toggle-recording", ());
            }
        }
        MENU_SHOW_WINDOW => {
            show_window(app);
        }
        MENU_HIDE_WINDOW => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        MENU_QUIT => {
            app.exit(0);
        }
        _ => {}
    }
}

/// 处理托盘图标事件
fn handle_tray_icon_event(tray: &tauri::tray::TrayIcon, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            // 左键点击：显示/隐藏窗口
            let app = tray.app_handle();
            toggle_window_visibility(&app);
        }
        TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } => {
            // 双击：总是显示窗口
            let app = tray.app_handle();
            show_window(&app);
        }
        _ => {}
    }
}

/// 显示窗口
fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 切换窗口可见性
fn toggle_window_visibility(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show_window(app);
        }
    }
}

/// 更新托盘菜单项状态
pub fn update_tray_menu_state(_app: &AppHandle, is_recording: bool) {
    // TODO: 实现菜单项文本更新
    // 需要保存菜单项引用以便后续更新
    let _text = if is_recording { "停止录音" } else { "开始录音" };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_menu_item_ids() {
        assert_eq!(MENU_TOGGLE_RECORDING, "toggle_recording");
        assert_eq!(MENU_SHOW_WINDOW, "show_window");
        assert_eq!(MENU_HIDE_WINDOW, "hide_window");
        assert_eq!(MENU_QUIT, "quit");
    }

    #[test]
    fn test_recording_text() {
        let text = if true { "停止录音" } else { "开始录音" };
        assert_eq!(text, "停止录音");

        let text = if false { "停止录音" } else { "开始录音" };
        assert_eq!(text, "开始录音");
    }
}
