# 悬浮窗设置功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 RaFlow 添加悬浮窗设置功能，支持位置拖拽、文字样式自定义、窗口大小调整、隐藏功能。

**Architecture:** 基于现有 Tauri 2.0 + React 架构，在 config 模块添加窗口设置数据结构，通过托盘菜单触发设置面板，frontend 通过视图切换实现设置 UI。

**Tech Stack:** Tauri 2.0, React, Rust, serde

---

## Task 1: 添加 FloatingWindowSettings 数据结构

**Files:**
- Modify: `src-tauri/src/config/mod.rs`

**Step 1: 添加新结构体**

在 `config/mod.rs` 中 `AppConfig` 结构体后添加：

```rust
/// 窗口位置 (物理像素)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

/// 窗口尺寸
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

fn default_window_width() -> u32 { 440 }
fn default_window_height() -> u32 { 180 }
fn default_font_size() -> u32 { 14 }
fn default_text_color() -> String { "#FFFFFF".to_string() }
fn default_bg_color() -> String { "#1C1C1E".to_string() }
fn default_bg_opacity() -> u32 { 85 }

/// 悬浮窗设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloatingWindowSettings {
    /// 窗口位置 (物理像素)
    #[serde(default)]
    pub position: Option<WindowPosition>,

    /// 窗口尺寸
    #[serde(default = "default_window_size")]
    pub window_size: WindowSize,

    /// 字体大小 (px)
    #[serde(default = "default_font_size")]
    pub font_size: u32,

    /// 文字颜色 (hex)
    #[serde(default = "default_text_color")]
    pub text_color: String,

    /// 背景颜色 (hex)
    #[serde(default = "default_bg_color")]
    pub background_color: String,

    /// 背景透明度 (0-100)
    #[serde(default = "default_bg_opacity")]
    pub background_opacity: u32,

    /// 是否隐藏悬浮窗
    #[serde(default)]
    pub hidden: bool,
}

fn default_window_size() -> WindowSize {
    WindowSize {
        width: default_window_width(),
        height: default_window_height(),
    }
}
```

**Step 2: 修改 AppConfig**

在 `AppConfig` 结构体中添加：

```rust
pub struct AppConfig {
    // ... existing fields
    /// 悬浮窗设置
    #[serde(default)]
    pub floating_window: FloatingWindowSettings,
}
```

**Step 3: 更新 Default 实现**

```rust
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            elevenlabs_api_key: None,
            sample_rate: default_sample_rate(),
            debug_logging: false,
            floating_window: FloatingWindowSettings {
                position: None,
                window_size: default_window_size(),
                font_size: default_font_size(),
                text_color: default_text_color(),
                background_color: default_bg_color(),
                background_opacity: default_bg_opacity(),
                hidden: false,
            },
        }
    }
}
```

**Step 4: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add src-tauri/src/config/mod.rs
git commit -m "feat(config): add FloatingWindowSettings structure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 添加窗口控制 Tauri 命令

**Files:**
- Modify: `src-tauri/src/commands.rs`

**Step 1: 添加新命令**

在 `commands.rs` 中添加：

```rust
use crate::config::{AppConfig, FloatingWindowSettings, WindowPosition, WindowSize};

#[tauri::command]
pub async fn get_window_settings(app: tauri::AppHandle) -> Result<FloatingWindowSettings, String> {
    let config = crate::config::load_config().map_err(|e| e.to_string())?;
    Ok(config.floating_window)
}

#[tauri::command]
pub async fn save_window_settings(
    app: tauri::AppHandle,
    settings: FloatingWindowSettings,
) -> Result<(), String> {
    let mut config = crate::config::load_config().map_err(|e| e.to_string())?;
    config.floating_window = settings;
    crate::config::save_config(&config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_window_position(app: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
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
pub async fn set_window_size(app: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
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
pub async fn show_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_dragging(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.start_dragging().map_err(|e| e.to_string())?;
    Ok(())
}
```

**Step 2: 在 lib.rs 中注册命令**

修改 `src-tauri/src/lib.rs` 的 `invoke_handler`:

```rust
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
])
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(commands): add window control commands

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 创建 SettingsPanel 组件

**Files:**
- Create: `src/components/SettingsPanel.tsx`

**Step 1: 创建设置面板组件**

```tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';

interface WindowSettings {
  position: { x: number; y: number } | null;
  window_size: { width: number; height: number };
  font_size: number;
  text_color: string;
  background_color: string;
  background_opacity: number;
  hidden: boolean;
}

interface SettingsPanelProps {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [settings, setSettings] = useState<WindowSettings>({
    position: null,
    window_size: { width: 440, height: 180 },
    font_size: 14,
    text_color: '#FFFFFF',
    background_color: '#1C1C1E',
    background_opacity: 85,
    hidden: false,
  });
  const [isDragging, setIsDragging] = useState(false);

  // Load settings on mount
  useEffect(() => {
    invoke<WindowSettings>('get_window_settings').then(setSettings).catch(console.error);
  }, []);

  const updateSetting = async <K extends keyof WindowSettings>(key: K, value: WindowSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await invoke('save_window_settings', { settings: newSettings });
  };

  const handleDragStart = async () => {
    setIsDragging(true);
    await invoke('start_dragging');
  };

  const handleDragEnd = async () => {
    setIsDragging(false);
    // Position will be saved by the drag end handler in Rust
  };

  return (
    <motion.div
      className="flex flex-col h-full px-4 py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <span className="text-[13px]-white">设置</span>
        <div className="w-10" />
      </div>

      {/* Position */}
       font-semibold text<div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-gray-400">位置</span>
        <button
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
            isDragging
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          拖拽移动
        </button>
      </div>

      {/* Size */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] text-gray-400">大小</span>
          <span className="text-[11px] text-gray-500">
            W: {settings.window_size.width} × H: {settings.window_size.height}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="range"
              min="300"
              max="600"
              value={settings.window_size.width}
              onChange={(e) =>
                updateSetting('window_size', {
                  ...settings.window_size,
                  width: Number(e.target.value),
                })
              }
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div className="flex-1">
            <input
              type="range"
              min="100"
              max="400"
              value={settings.window_size.height}
              onChange={(e) =>
                updateSetting('window_size', {
                  ...settings.window_size,
                  height: Number(e.target.value),
                })
              }
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700/50 my-2" />

      {/* Font Size */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] text-gray-400">字体大小</span>
          <span className="text-[11px] text-gray-500">{settings.font_size}px</span>
        </div>
        <input
          type="range"
          min="10"
          max="24"
          value={settings.font_size}
          onChange={(e) => updateSetting('font_size', Number(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Text Color */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-gray-400">文字颜色</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.text_color}
            onChange={(e) => updateSetting('text_color', e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0"
          />
          <span className="text-[11px] text-gray-500">{settings.text_color}</span>
        </div>
      </div>

      {/* Background Color */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-gray-400">背景颜色</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.background_color}
            onChange={(e) => updateSetting('background_color', e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0"
          />
          <span className="text-[11px] text-gray-500">{settings.background_color}</span>
        </div>
      </div>

      {/* Background Opacity */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] text-gray-400">背景透明度</span>
          <span className="text-[11px] text-gray-500">{settings.background_opacity}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.background_opacity}
          onChange={(e) => updateSetting('background_opacity', Number(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700/50 my-2" />

      {/* Hidden Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-400">隐藏悬浮窗</span>
        <button
          onClick={() => updateSetting('hidden', !settings.hidden)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.hidden ? 'bg-blue-500' : 'bg-gray-700'
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.hidden ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat(ui): add SettingsPanel component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 修改 App.tsx 集成设置面板

**Files:**
- Modify: `src/App.tsx`

**Step 1: 添加视图状态和设置入口**

在 `App.tsx` 中：

```tsx
import { SettingsPanel } from './components/SettingsPanel';

// 在 App 组件中添加状态
const [view, setView] = useState<'main' | 'settings'>('main');

// 在标题栏添加设置按钮
// 将 StatusIndicator 那一行改为：
<div className="flex items-center justify-between mb-1.5">
  <StatusIndicator status={status} />
  <button
    onClick={() => setView('settings')}
    className="p-1 rounded-md hover:bg-gray-700/50 transition-colors"
  >
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </button>
</div>
```

**Step 2: 修改主界面渲染逻辑**

将 return 部分改为：

```tsx
return (
  <motion.div
    className="window-container"
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
  >
    {view === 'main' ? (
      <>
        {/* Header: Status indicator + Settings */}
        <div className="flex items-center justify-between mb-1.5">
          <StatusIndicator status={status} />
          <button
            onClick={() => setView('settings')}
            className="p-1 rounded-md hover:bg-gray-700/50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Waveform visualizer */}
        <div className="flex-shrink-0">
          <WaveformVisualizer level={audioLevel} status={status} />
        </div>

        {/* Transcript display - flexible height with scroll */}
        <div className="flex-1 min-h-0 w-full flex items-start justify-center overflow-hidden">
          <TranscriptDisplay
            partial={partialText}
            committed={committedText}
            status={status}
          />
        </div>

        {/* Error toast */}
        <AnimatePresence>
          {showError && error && (
            <ErrorToast message={error.message} onDismiss={() => setShowError(false)} />
          )}
        </AnimatePresence>
      </>
    ) : (
      <SettingsPanel onBack={() => setView('main')} />
    )}
  </motion.div>
);
```

**Step 3: 验证编译**

Run: `pnpm build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): integrate SettingsPanel with view switching

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 实现拖拽位置保存

**Files:**
- Modify: `src-tauri/src/commands.rs`

**Step 1: 添加拖拽结束位置保存命令**

在 `commands.rs` 中添加：

```rust
#[tauri::command]
pub async fn save_window_position(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let position = window.outer_position().map_err(|e| e.to_string())?;

    // Save to config
    let mut config = crate::config::load_config().map_err(|e| e.to_string())?;
    config.floating_window.position = Some(WindowPosition {
        x: position.x,
        y: position.y,
    });
    crate::config::save_config(&config).map_err(|e| e.to_string())?;

    Ok(())
}
```

**Step 2: 注册命令**

在 `lib.rs` 中添加 `commands::save_window_position` 到 invoke_handler。

**Step 3: 修改前端拖拽处理**

更新 `SettingsPanel.tsx` 的 `handleDragStart`:

```tsx
const handleDragStart = async () => {
  setIsDragging(true);
  await invoke('start_dragging');
};

// Add a useEffect to save position after drag ends
useEffect(() => {
  const handleDragEnd = async () => {
    if (isDragging) {
      setIsDragging(false);
      await invoke('save_window_position');
      // Reload settings to get new position
      const newSettings = await invoke<WindowSettings>('get_window_settings');
      setSettings(newSettings);
    }
  };

  window.addEventListener('mouseup', handleDragEnd);
  return () => window.removeEventListener('mouseup', handleDragEnd);
}, [isDragging]);
```

**Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src/components/SettingsPanel.tsx
git commit -m "feat: implement drag position saving

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 实现托盘菜单和隐藏功能

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: 添加托盘菜单和状态更新**

修改 `lib.rs` 添加托盘功能：

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub fn run() {
    // ... existing code ...

    tauri::Builder::default()
        // ... existing plugins ...
        .setup(|app| {
            // ... existing shortcut registration ...

            // 创建托盘菜单
            let show_item = MenuItem::with_id(app, "show", "打开悬浮窗", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "设置...", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
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
```

**Step 2: 添加托盘图标更新命令**

在 `commands.rs` 中添加：

```rust
#[tauri::command]
pub async fn update_tray_tooltip(app: tauri::AppHandle, status: String) -> Result<(), String> {
    // 托盘tooltip会在托盘事件处理中更新，这里预留接口
    Ok(())
}
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add tray menu with settings

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 实现隐藏状态反馈（托盘图标变化）

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: 添加托盘图标切换功能**

需要准备不同状态的托盘图标（灰色、红色、橙色、紫色），然后在状态变化时切换。

由于托盘图标需要预先准备，这里先用 tooltip 文本区分不同状态。

**Step 2: 监听录音状态变化**

在 frontend 的 `useTranscription` 中，当状态变化时触发托盘更新。

```tsx
// 在 useTranscription 中
useEffect(() => {
    // 当隐藏悬浮窗时，通过托盘更新状态
    if (settings.hidden) {
        invoke('update_tray_status', { status }).catch(console.error);
    }
}, [status, settings.hidden]);
```

**Step 3: 在 commands.rs 添加状态更新命令**

```rust
#[tauri::command]
pub async fn update_tray_status(app: tauri::AppHandle, status: String) -> Result<(), String> {
    let tooltip = match status.as_str() {
        "recording" => "RaFlow - 录音中",
        "connecting" => "RaFlow - 连接中",
        "processing" => "RaFlow - 处理中",
        "error" => "RaFlow - 错误",
        _ => "RaFlow - Ready",
    };

    // 更新托盘 tooltip
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

**Step 4: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: add tray status update command

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 集成隐藏功能与状态同步

**Files:**
- Modify: `src/App.tsx`, `src/components/SettingsPanel.tsx`

**Step 1: 隐藏时自动隐藏窗口**

在 `SettingsPanel.tsx` 的 `updateSetting` 中，当 `hidden` 变为 `true` 时隐藏窗口：

```tsx
const updateSetting = async <K extends keyof WindowSettings>(key: K, value: WindowSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await invoke('save_window_settings', { settings: newSettings });

    // 当隐藏设置变化时，同步窗口显示状态
    if (key === 'hidden') {
        if (value) {
            await invoke('hide_window');
        } else {
            await invoke('show_window');
        }
    }
};
```

**Step 2: 加载设置时应用窗口状态**

在 `App.tsx` 中，初始化时加载设置并应用：

```tsx
useEffect(() => {
    invoke<WindowSettings>('get_window_settings').then((settings) => {
        if (settings.hidden) {
            invoke('hide_window');
        }
    }).catch(console.error);
}, []);
```

**Step 3: 验证功能**

Run: `pnpm tauri dev`
- 点击设置按钮 → 进入设置面板
- 拖拽按钮 → 可以拖动窗口
- 调整滑块 → 窗口大小变化
- 颜色选择 → 实时预览
- 隐藏开关 → 窗口隐藏，托盘菜单显示"打开悬浮窗"

**Step 4: Commit**

```bash
git add src/App.tsx src/components/SettingsPanel.tsx
git commit -m "feat: integrate hidden window functionality

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

1. ✅ 托盘菜单有"设置..."选项，点击打开设置面板
2. ✅ 设置面板可拖拽移动窗口位置
3. ✅ 滑块可调整窗口宽度(300-600)和高度(100-400)
4. ✅ 字体大小滑块可调(10-24px)
5. ✅ 文字颜色和背景颜色可选
6. ✅ 背景透明度可调(0-100%)
7. ✅ 隐藏开关可隐藏悬浮窗
8. ✅ 隐藏后托盘菜单显示"打开悬浮窗"可恢复
9. ✅ 所有设置自动保存到 config.json
10. ✅ 重新启动应用后设置保持
