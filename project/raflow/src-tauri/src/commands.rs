// Tauri commands - Tauri 命令定义
// 暴露给前端的 Rust 函数

use crate::api_config::ApiConfig;
use crate::audio::pipeline::AudioPipeline;
use crate::debug::{DebugState, DebugConfig, LogLevel, global_debug_state};
use crate::injection::{ClipboardInjector, InjectResult, is_editable_element};
use crate::perf::{Metrics, MetricsSnapshot, MetricType};
use crate::system_tray;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::str::FromStr;
use tauri::{Emitter, Manager};

/// 音频录制状态
struct AudioState {
    /// 音频管道（使用 Arc<Mutex<>> 以确保 Send + Sync）
    pipeline: Arc<Mutex<AudioPipeline>>,
    /// 是否正在录音（使用 AtomicBool 以便跨线程访问）
    is_recording: Arc<AtomicBool>,
}

impl AudioState {
    fn new() -> Self {
        Self {
            pipeline: Arc::new(Mutex::new(AudioPipeline::with_default_config())),
            is_recording: Arc::new(AtomicBool::new(false)),
        }
    }
}

// 实现 Send + Sync 以便在 Tauri 状态中使用
unsafe impl Send for AudioState {}
unsafe impl Sync for AudioState {}

/// 转录状态
struct TranscriptionState {
    // TODO: 添加转录客户端实例
    is_transcribing: Arc<AtomicBool>,
}

// 实现 Send + Sync 以便在 Tauri 状态中使用
unsafe impl Send for TranscriptionState {}
unsafe impl Sync for TranscriptionState {}

/// 性能指标状态
struct MetricsState {
    /// 性能指标收集器（使用 Arc<Mutex<>> 以确保 Send + Sync）
    metrics: Arc<Mutex<Metrics>>,
}

impl MetricsState {
    fn new() -> Self {
        Self {
            metrics: Arc::new(Mutex::new(Metrics::new())),
        }
    }
}

// 实现 Send + Sync 以便在 Tauri 状态中使用
unsafe impl Send for MetricsState {}
unsafe impl Sync for MetricsState {}

/// 开始录音
#[tauri::command]
async fn start_recording(
    state: tauri::State<'_, AudioState>,
    metrics_state: tauri::State<'_, MetricsState>,
) -> Result<(), String> {
    // 检查是否已经在录音
    if state.is_recording.load(Ordering::Relaxed) {
        return Err("Already recording".to_string());
    }

    // 启动音频管道
    {
        let mut audio = state.pipeline.lock();
        audio.start()
            .map_err(|e| format!("Failed to start audio pipeline: {}", e))?;
    }

    // 更新录音状态
    state.is_recording.store(true, Ordering::Relaxed);

    // 记录启动时间（通过 metrics）- 在独立的代码块中
    {
        let metrics = metrics_state.metrics.lock();
        let _timer = metrics.timer(MetricType::AudioLatency);
        // Timer 会在代码块结束时自动记录延迟
    }

    Ok(())
}

/// 停止录音
#[tauri::command]
async fn stop_recording(state: tauri::State<'_, AudioState>) -> Result<(), String> {
    // 检查是否正在录音
    if !state.is_recording.load(Ordering::Relaxed) {
        return Err("Not recording".to_string());
    }

    // 停止音频管道
    {
        let mut audio = state.pipeline.lock();
        audio.stop();
    }

    // 更新录音状态
    state.is_recording.store(false, Ordering::Relaxed);

    Ok(())
}

/// 获取录音状态
#[tauri::command]
async fn get_recording_status(state: tauri::State<'_, AudioState>) -> Result<bool, String> {
    Ok(state.is_recording.load(Ordering::Relaxed))
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

/// 获取性能指标快照
#[tauri::command]
async fn get_metrics(metrics_state: tauri::State<'_, MetricsState>) -> Result<MetricsSnapshot, String> {
    let metrics = metrics_state.metrics.lock();
    Ok(metrics.snapshot())
}

/// 重置性能指标
#[tauri::command]
async fn reset_metrics(metrics_state: tauri::State<'_, MetricsState>) -> Result<(), String> {
    let metrics = metrics_state.metrics.lock();
    metrics.reset();
    Ok(())
}

/// 获取音频管道状态
#[tauri::command]
async fn get_pipeline_status(state: tauri::State<'_, AudioState>) -> Result<PipelineStatus, String> {
    let audio = state.pipeline.lock();
    Ok(PipelineStatus {
        is_running: audio.is_running(),
        total_frames: audio.total_frames(),
        elapsed_seconds: audio.elapsed_seconds(),
        available_frames: audio.available_frames(),
        buffer_usage: audio.buffer_usage(),
    })
}

/// 音频管道状态
#[derive(serde::Serialize)]
struct PipelineStatus {
    is_running: bool,
    total_frames: u64,
    elapsed_seconds: Option<f64>,
    available_frames: usize,
    buffer_usage: f64,
}

/// 调试状态快照
#[derive(serde::Serialize)]
struct DebugStatus {
    /// 是否启用调试模式
    enabled: bool,
    /// 日志级别
    log_level: String,
    /// 包含的目标模块
    include_targets: Vec<String>,
    /// 排除的目标模块
    exclude_targets: Vec<String>,
}

impl From<&DebugState> for DebugStatus {
    fn from(state: &DebugState) -> Self {
        DebugStatus {
            enabled: state.is_enabled(),
            log_level: state.log_level().to_string(),
            include_targets: state.include_targets().iter().cloned().collect(),
            exclude_targets: state.exclude_targets().iter().cloned().collect(),
        }
    }
}

/// 启用调试模式
#[tauri::command]
async fn enable_debug_mode() -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.enable();
    Ok(DebugStatus::from(&*state))
}

/// 禁用调试模式
#[tauri::command]
async fn disable_debug_mode() -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.disable();
    Ok(DebugStatus::from(&*state))
}

/// 切换调试模式
#[tauri::command]
async fn toggle_debug_mode() -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.toggle();
    Ok(DebugStatus::from(&*state))
}

/// 获取调试状态
#[tauri::command]
async fn get_debug_status() -> Result<DebugStatus, String> {
    let state = global_debug_state().lock();
    Ok(DebugStatus::from(&*state))
}

/// 设置调试日志级别
#[tauri::command]
async fn set_debug_log_level(level: String) -> Result<DebugStatus, String> {
    let log_level = LogLevel::from_str(&level)
        .map_err(|e| format!("Invalid log level: {}", e))?;

    let mut state = global_debug_state().lock();
    state.set_log_level(log_level);
    Ok(DebugStatus::from(&*state))
}

/// 添加包含的目标模块
#[tauri::command]
async fn add_debug_include_target(target: String) -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.add_include_target(target);
    Ok(DebugStatus::from(&*state))
}

/// 移除包含的目标模块
#[tauri::command]
async fn remove_debug_include_target(target: String) -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.remove_include_target(&target);
    Ok(DebugStatus::from(&*state))
}

/// 添加排除的目标模块
#[tauri::command]
async fn add_debug_exclude_target(target: String) -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.add_exclude_target(target);
    Ok(DebugStatus::from(&*state))
}

/// 移除排除的目标模块
#[tauri::command]
async fn remove_debug_exclude_target(target: String) -> Result<DebugStatus, String> {
    let mut state = global_debug_state().lock();
    state.remove_exclude_target(&target);
    Ok(DebugStatus::from(&*state))
}

/// API 配置状态
#[derive(Debug, Clone, serde::Serialize)]
pub struct ApiConfigStatus {
    pub has_api_key: bool,
    pub key_preview: String,  // 前 8 个字符，用于显示
}

impl From<&ApiConfig> for ApiConfigStatus {
    fn from(config: &ApiConfig) -> Self {
        let key_preview = if config.api_key.len() > 8 {
            format!("{}...", &config.api_key[..8])
        } else {
            config.api_key.clone()
        };

        Self {
            has_api_key: !config.api_key.is_empty(),
            key_preview,
        }
    }
}

/// 获取 API 配置状态
#[tauri::command]
async fn get_api_config_status() -> Result<ApiConfigStatus, String> {
    let config = ApiConfig::load()?;
    Ok(ApiConfigStatus::from(&config))
}

/// 保存 API 密钥
#[tauri::command]
async fn save_api_key(api_key: String) -> Result<ApiConfigStatus, String> {
    let config = ApiConfig::load()?;
    let updated_config = config.set_api_key(api_key)?;
    Ok(ApiConfigStatus::from(&updated_config))
}

/// 验证 API 密钥
#[tauri::command]
async fn validate_api_key(api_key: String) -> Result<bool, String> {
    match ApiConfig::validate_key(&api_key) {
        Ok(()) => Ok(true),
        Err(_e) => Ok(false),
    }
}

/// 主运行函数 - Tauri 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
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
            get_recording_status,
            start_transcription,
            stop_transcription,
            inject_text,
            check_clipboard,
            get_metrics,
            reset_metrics,
            get_pipeline_status,
            enable_debug_mode,
            disable_debug_mode,
            toggle_debug_mode,
            get_debug_status,
            set_debug_log_level,
            add_debug_include_target,
            remove_debug_include_target,
            add_debug_exclude_target,
            remove_debug_exclude_target,
            get_api_config_status,
            save_api_key,
            validate_api_key,
        ])
        .setup(|app| {
            // 初始化应用状态
            app.manage(AudioState::new());
            app.manage(TranscriptionState {
                is_transcribing: Arc::new(AtomicBool::new(false)),
            });
            app.manage(MetricsState::new());

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
