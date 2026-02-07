# RaFlow 优化技术架构 v2.0

## 📋 执行摘要

基于对 Wispr Flow、ElevenLabs Scribe v2 Realtime API、以及 Tauri v2 生态的深入研究，本优化架构采用**渐进式重构策略**，在保证快速 MVP 的同时，为生产级性能优化奠定基础。

**核心优化点:**
1. **音频管道**: 从插件快速启动，渐进迁移到 cpal+Tokio 高性能架构
2. **文本注入**: 剪贴板优先策略，配合智能恢复机制
3. **系统稳定性**: 添加健康检查、断线重连、资源监控
4. **可观测性**: 内置性能指标收集，支持实时延迟监控
5. **开发者友好**: 提供调试模式和详细的技术文档

**研究参考资源:**
- [ElevenLabs Scribe v2 Realtime API](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
- [Tauri v2 System Tray 指南](https://medium.com/@sjobeiri/understanding-the-system-tray-from-concept-to-tauri-v2-implementation-252f278bb57c)
- [Wispr Flow 技术挑战](https://wisprflow.ai/post/technical-challenges)
- [Rust 音频流处理](https://dev.to/drsh4dow/the-joy-of-the-unknown-exploring-audio-streams-with-rust-and-circular-buffers-494d)

---

## 🎯 第一阶段: MVP 快速验证 (1-2周)

### 目标
- 验证核心语音转文字流程
- 快速获得用户反馈
- 确认技术可行性

### 技术栈

**前端 (React + TypeScript)**
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "react": "^18.3.0",
    "framer-motion": "^11.0.0",
    "zustand": "^4.5.0"
  }
}
```

**后端 (Rust + Tauri v2)**
```toml
[dependencies]
tauri = { version = "2.0", features = ["tray-icon", "macos-private-api"] }
tauri-plugin-global-shortcut = "2.0"
tauri-plugin-mic-recorder = "2.0"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
tokio-tungstenite = "0.20"
base64 = "0.21"
```

### 核心功能实现

#### A. 快速音频采集

使用 `tauri-plugin-mic-recorder` 插件:

```rust
// src-tauri/src/audio/plugin.rs
use tauri_plugin_mic_recorder::{MicRecorder, RecordingFormat};

#[tauri::command]
async fn start_recording(app: tauri::AppHandle) -> Result<String, String> {
    let recorder = app.state::<MicRecorder>();

    recorder.start_recording(
        RecordingFormat::Wav,
        "temp_audio.wav".to_string()
    ).await.map_err(|e| e.to_string())?;

    Ok("Recording started".to_string())
}

#[tauri::command]
async fn stop_recording(app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    let recorder = app.state::<MicRecorder>();
    let audio_data = recorder.stop_recording()
        .await
        .map_err(|e| e.to_string())?;

    // 转换为 16kHz PCM
    let resampled = resample_to_16khz(&audio_data)?;
    Ok(resampled)
}

// 简单的重采样实现 (MVP 阶段)
fn resample_to_16khz(wav_data: &[u8]) -> Result<Vec<i16>, String> {
    // 跳过 WAV header，读取 PCM 数据
    // 简单线性插值重采样到 16kHz
    // MVP 阶段可接受一定精度损失
    todo!("实现基础重采样")
}
```

#### B. ElevenLabs WebSocket 客户端

```rust
// src-tauri/src/elevenlabs/client.rs
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "message_type")]
enum ScribeMessage {
    #[serde(rename = "input_audio_chunk")]
    AudioChunk {
        audio_base_64: String,
        commit: bool,
    },
    #[serde(rename = "partial_transcript")]
    PartialTranscript {
        text: String,
        created_at_ts: Option<u64>,
    },
    #[serde(rename = "committed_transcript")]
    CommittedTranscript {
        text: String,
        created_at_ts: Option<u64>,
    },
    #[serde(rename = "session_started")]
    SessionStarted {
        session_id: String,
        config: SessionConfig,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionConfig {
    sample_rate: u32,
    model_id: String,
    vad_threshold: f32,
}

pub struct ScribeClient {
    tx: SplitSink<WebSocketStream<...>, Message>,
    rx: SplitStream<WebSocketStream<...>>,
}

impl ScribeClient {
    pub async fn connect(api_key: &str) -> Result<Self, Error> {
        let url = format!(
            "wss://api.elevenlabs.io/v1/speech-to-text/realtime?token={}",
            api_key
        );

        let (ws_stream, _) = connect_async(&url).await?;
        let (tx, rx) = ws_stream.split();

        // 等待 session_started 消息
        // TODO: 添加超时机制

        Ok(Self { tx, rx })
    }

    pub async fn send_audio(&mut self, pcm_data: &[i16]) -> Result<(), Error> {
        let base64_audio = base64::encode(pcm_data);
        let msg = ScribeMessage::AudioChunk {
            audio_base_64: base64_audio,
            commit: false,
        };

        let json = serde_json::to_string(&msg)?;
        self.tx.send(Message::Text(json)).await?;
        Ok(())
    }

    pub async fn commit(&mut self) -> Result<(), Error> {
        let msg = ScribeMessage::AudioChunk {
            audio_base_64: String::new(),
            commit: true,
        };

        let json = serde_json::to_string(&msg)?;
        self.tx.send(Message::Text(json)).await?;
        Ok(())
    }

    pub async fn next_transcript(&mut self) -> Option<TranscriptEvent> {
        // 从 rx 流读取并解析消息
        todo!("实现消息循环")
    }
}

pub enum TranscriptEvent {
    Partial(String),
    Committed(String),
}
```

#### C. 剪贴板注入 (MVP 版本)

```rust
// src-tauri/src/injection/clipboard.rs
use tauri_plugin_clipboard_manager::ClipboardManager;
use enigo::{KeyboardControllable, Key, KeyDirection};

#[derive(Debug, Serialize)]
pub enum InjectResult {
    Injected,
    ClipboardOnly,
    Failed(String),
}

#[tauri::command]
async fn inject_text(
    text: String,
    clipboard: tauri::State<'_, ClipboardManager>
) -> Result<InjectResult, String> {
    // MVP 阶段: 始终使用剪贴板
    clipboard.write_text(text.clone()).await
        .map_err(|e| e.to_string())?;

    // 模拟 Cmd+V (macOS) 或 Ctrl+V (Windows/Linux)
    #[cfg(target_os = "macos")]
    {
        let mut enigo = Enigo::new();
        enigo.key(Key::Meta, KeyDirection::Press);
        enigo.key(Key::Unicode('v'), KeyDirection::Click);
        enigo.key(Key::Meta, KeyDirection::Release);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let mut enigo = Enigo::new();
        enigo.key(Key::Control, KeyDirection::Press);
        enigo.key(Key::Unicode('v'), KeyDirection::Click);
        enigo.key(Key::Control, KeyDirection::Release);
    }

    Ok(InjectResult::Injected)
}
```

#### D. 前端界面

```typescript
// src/components/FloatingWindow.tsx
import { useFloatingWindow } from './hooks/useFloatingWindow';

export function FloatingWindow() {
  const { partialText, committedText, isRecording } = useFloatingWindow();

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2
                    bg-black/80 backdrop-blur-md rounded-2xl
                    px-6 py-4 text-white pointer-events-none">
      {/* 波形动画 */}
      {isRecording && <WaveformVisualizer />}

      {/* 实时转录 (灰色) */}
      {partialText && (
        <p className="text-gray-400 text-sm">{partialText}</p>
      )}

      {/* 确认文本 (白色) */}
      {committedText && (
        <p className="text-white text-base">{committedText}</p>
      )}
    </div>
  );
}

// 简单的波形可视化组件
function WaveformVisualizer() {
  // 使用 framer-motion 实现动态波形
  return (
    <div className="flex items-center gap-1 h-8 mb-2">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-white/60 rounded-full"
          animate={{ height: [8, 24, 8] }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.1
          }}
        />
      ))}
    </div>
  );
}
```

### Tauri 配置

```json
// tauri.conf.json
{
  "productName": "RaFlow",
  "version": "0.1.0",
  "identifier": "com.raflow.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "label": "main",
      "title": "RaFlow",
      "width": 400,
      "height": 150,
      "decorations": false,
      "transparent": true,
      "alwaysOnTop": true,
      "skipTaskbar": true,
      "visible": false
    }],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "global-shortcut": {
      "shortcuts": [
        {
          "command": "toggle_recording",
          "key": "Command+Shift+R",
          "description": "切换录音状态"
        }
      ]
    }
  }
}
```

---

## 🚀 第二阶段: 高性能架构迁移 (2-3周)

### 目标
- 优化音频处理延迟
- 添加性能监控
- 实现断线重连

### 音频管道重构

**移除插件，实现自定义高性能管道:**

```rust
// src-tauri/src/audio/pipeline.rs
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{HeapRb, Producer, Consumer};
use tokio::sync::mpsc;
use rubato::{Resampler, FftFixedIn, InterpolationParameters, InterpolationType, WindowFunction};

pub struct AudioPipeline {
    _stream: cpal::Stream,
    audio_tx: mpsc::Sender<Vec<i16>>,
    is_running: Arc<AtomicBool>,
}

impl AudioPipeline {
    pub fn new() -> Result<Self, Error> {
        let host = cpal::default_host();
        let device = host.default_input_device()
            .ok_or("No input device available")?;
        let config = device.default_input_config()
            .map_err(|e| format!("Failed to get config: {}", e))?;

        // 创建 Ring Buffer (无锁队列)
        let (prod, cons) = HeapRb::<f32>::new(8192).split();

        // 创建音频数据通道
        let (audio_tx, mut audio_rx) = mpsc::channel(32);

        // 配置重采样器
        let input_rate = config.sample_rate().0 as f64;
        let target_rate = 16000.0;
        let chunk_size = 1024;

        let params = InterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: InterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let resampler = FftFixedIn::<f32>::new(
            target_rate / input_rate,
            chunk_size,
            params,
            1, // 单声道
            1  // 渐进处理
        ).map_err(|e| format!("Failed to create resampler: {}", e))?;

        // 启动音频流
        let stream = device.build_input_stream(
            &config.into(),
            {
                let prod = prod.clone();
                move |data: &[f32], _: &_| {
                    // 音频线程: 仅推入数据，绝对不能阻塞
                    let _ = prod.push_slice(data);
                }
            },
            |err| {
                eprintln!("Audio stream error: {}", err);
            },
            None // 无阻塞模式
        ).map_err(|e| format!("Failed to build stream: {}", e))?;

        stream.play()
            .map_err(|e| format!("Failed to play stream: {}", e))?;

        // 启动处理任务 (Tokio 异步)
        let is_running = Arc::new(AtomicBool::new(true));
        let is_running_clone = is_running.clone();

        tokio::spawn(async move {
            let mut resampler = resampler;
            let mut input_buffer = vec![vec![0.0f32; chunk_size]; 1];
            let mut accumulated = Vec::with_capacity(chunk_size);

            while is_running_clone.load(Ordering::Relaxed) {
                // 从 Ring Buffer 读取数据
                if cons.len() >= chunk_size {
                    accumulated.clear();
                    for _ in 0..chunk_size {
                        accumulated.push(cons.pop().unwrap());
                    }
                    input_buffer[0] = accumulated.clone();

                    // 执行重采样
                    match resampler.process(&input_buffer, None) {
                        Ok(output) => {
                            // Float32 -> Int16 PCM 转换
                            let pcm: Vec<i16> = output[0]
                                .iter()
                                .map(|&s| {
                                    let clamped = s.clamp(-1.0, 1.0);
                                    if clamped >= 0.0 {
                                        (clamped * 32767.0) as i16
                                    } else {
                                        (clamped * 32768.0) as i16
                                    }
                                })
                                .collect();

                            // 发送到 WebSocket 线程
                            if audio_tx.send(pcm).await.is_err() {
                                break; // 接收端已关闭
                            }
                        }
                        Err(e) => {
                            eprintln!("Resampling error: {}", e);
                        }
                    }
                } else {
                    // 短暂休眠避免空转
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }
            }
        });

        Ok(Self {
            _stream: stream,
            audio_tx,
            is_running,
        })
    }

    pub async fn send_audio(&self, data: Vec<i16>) -> Result<(), Error> {
        self.audio_tx.send(data)
            .await
            .map_err(|e| format!("Failed to send audio: {}", e).into())
    }

    pub fn stop(self) {
        self.is_running.store(false, Ordering::Relaxed);
    }
}
```

### 性能监控系统

```rust
// src-tauri/src/telemetry/metrics.rs
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub audio_latency_p50: Duration,
    pub audio_latency_p99: Duration,
    pub transcription_latency_p50: Duration,
    pub transcription_latency_p99: Duration,
    pub injection_latency_p50: Duration,
    pub injection_latency_p99: Duration,
    pub websocket_connected: bool,
    pub audio_buffer_size: usize,
}

// 简单的直方图实现
struct Histogram {
    values: Vec<Duration>,
    max_size: usize,
}

impl Histogram {
    fn new(max_size: usize) -> Self {
        Self {
            values: Vec::with_capacity(max_size),
            max_size,
        }
    }

    fn record(&mut self, value: Duration) {
        if self.values.len() >= self.max_size {
            self.values.remove(0);
        }
        self.values.push(value);
    }

    fn percentile(&self, p: f64) -> Duration {
        if self.values.is_empty() {
            return Duration::ZERO;
        }

        let mut sorted = self.values.clone();
        sorted.sort();
        let index = ((sorted.len() as f64) * p / 100.0) as usize;
        sorted.get(index.min(sorted.len() - 1)).copied()
            .unwrap_or(Duration::ZERO)
    }
}

pub struct Metrics {
    audio_latency: Arc<Mutex<Histogram>>,
    transcription_latency: Arc<Mutex<Histogram>>,
    injection_latency: Arc<Mutex<Histogram>>,
    websocket_connected: Arc<AtomicBool>,
    audio_buffer_size: Arc<AtomicUsize>,
}

impl Metrics {
    pub fn new() -> Self {
        Self {
            audio_latency: Arc::new(Mutex::new(Histogram::new(1000))),
            transcription_latency: Arc::new(Mutex::new(Histogram::new(1000))),
            injection_latency: Arc::new(Mutex::new(Histogram::new(1000))),
            websocket_connected: Arc::new(AtomicBool::new(false)),
            audio_buffer_size: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub fn record_audio_latency(&self, latency: Duration) {
        self.audio_latency.lock().unwrap().record(latency);
    }

    pub fn record_transcription_latency(&self, latency: Duration) {
        self.transcription_latency.lock().unwrap().record(latency);
    }

    pub fn record_injection_latency(&self, latency: Duration) {
        self.injection_latency.lock().unwrap().record(latency);
    }

    pub fn set_websocket_connected(&self, connected: bool) {
        self.websocket_connected.store(connected, Ordering::Relaxed);
    }

    pub fn set_audio_buffer_size(&self, size: usize) {
        self.audio_buffer_size.store(size, Ordering::Relaxed);
    }

    pub fn get_snapshot(&self) -> MetricsSnapshot {
        let audio = self.audio_latency.lock().unwrap();
        let transcription = self.transcription_latency.lock().unwrap();
        let injection = self.injection_latency.lock().unwrap();

        MetricsSnapshot {
            audio_latency_p50: audio.percentile(50.0),
            audio_latency_p99: audio.percentile(99.0),
            transcription_latency_p50: transcription.percentile(50.0),
            transcription_latency_p99: transcription.percentile(99.0),
            injection_latency_p50: injection.percentile(50.0),
            injection_latency_p99: injection.percentile(99.0),
            websocket_connected: self.websocket_connected.load(Ordering::Relaxed),
            audio_buffer_size: self.audio_buffer_size.load(Ordering::Relaxed),
        }
    }
}

// Tauri 命令: 获取指标
#[tauri::command]
fn get_metrics(metrics: tauri::State<'_, Metrics>) -> MetricsSnapshot {
    metrics.get_snapshot()
}

// 辅助宏: 测量代码块执行时间
macro_rules! measure {
    ($metrics:expr, $metric:ident, $block:expr) => {{
        let start = Instant::now();
        let result = $block;
        let latency = start.elapsed();
        $metrics.$metric(latency);
        result
    }};
}
```

### 断线重连机制

```rust
// src-tauri/src/elevenlabs/robust_client.rs
use tokio_tungstenite::tungstenite;
use std::time::Duration;

pub struct ReconnectStrategy {
    max_retries: usize,
    base_backoff: Duration,
    max_backoff: Duration,
}

impl ReconnectStrategy {
    fn next_backoff(&mut self, retry_count: usize) -> Duration {
        if retry_count >= self.max_retries {
            return Duration::MAX; // 停止重试
        }

        let backoff = self.base_backoff * 2_u32.pow(retry_count as u32);
        backoff.min(self.max_backoff)
    }
}

pub struct RobustScribeClient {
    client: Option<ScribeClient>,
    api_key: String,
    reconnect_strategy: ReconnectStrategy,
    retry_count: usize,
}

impl RobustScribeClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: None,
            api_key,
            reconnect_strategy: ReconnectStrategy {
                max_retries: 10,
                base_backoff: Duration::from_millis(100),
                max_backoff: Duration::from_secs(30),
            },
            retry_count: 0,
        }
    }

    async fn ensure_connected(&mut self) -> Result<&mut ScribeClient, Error> {
        if self.client.is_none() || !self.client.as_ref().unwrap().is_connected() {
            self.connect().await?;
        }
        Ok(self.client.as_mut().unwrap())
    }

    async fn connect(&mut self) -> Result<(), Error> {
        let backoff = self.reconnect_strategy.next_backoff(self.retry_count);

        if backoff == Duration::MAX {
            return Err("Max retries exceeded".into());
        }

        if self.retry_count > 0 {
            tokio::time::sleep(backoff).await;
        }

        match ScribeClient::connect(&self.api_key).await {
            Ok(client) => {
                self.client = Some(client);
                self.retry_count = 0;
                Ok(())
            }
            Err(e) => {
                self.retry_count += 1;
                Err(format!("Connection failed: {}", e).into())
            }
        }
    }

    pub async fn send_audio(&mut self, data: Vec<i16>) -> Result<(), Error> {
        let client = self.ensure_connected().await?;
        client.send_audio(&data).await
    }

    pub async fn commit(&mut self) -> Result<(), Error> {
        let client = self.ensure_connected().await?;
        client.commit().await
    }
}
```

### Tauri 后端集成

```rust
// src-tauri/src/main.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let metrics = Metrics::new();

    tauri::Builder::default()
        .manage(metrics)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            // 录音控制
            start_recording,
            stop_recording,
            toggle_recording,
            // 文本注入
            inject_text,
            // 指标查询
            get_metrics,
        ])
        .setup(|app| {
            // 初始化系统托盘
            let tray = SystemTray::new()
                .with_menu(tray_menu());

            tray.on_event(|app, event| {
                match event {
                    SystemTrayEvent::LeftClick { .. } => {
                        let window = app.get_webview_window("main").unwrap();
                        window.show().unwrap();
                    }
                    SystemTrayEvent::MenuItemClick { id, .. } => {
                        match id.as_str() {
                            "quit" => std::process::exit(0),
                            "toggle" => {
                                // 切换录音
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn tray_menu() -> SystemTrayMenu {
    SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("toggle", "开始/停止录音"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "退出"))
}
```

---

## 🔧 第三阶段: 生产级优化 (3-4周)

### 目标
- 智能可编辑性检测
- 高级剪贴板管理
- 多语言支持
- 权限引导流程

### 可编辑性检测 (macOS)

```rust
// src-tauri/src/injection/accessibility.rs
#[cfg(target_os = "macos")]
use cocoa::base::id;
use cocoa::appkit::*;

/// 检测当前聚焦的元素是否可编辑
#[cfg(target_os = "macos")]
pub fn is_editable_element() -> bool {
    unsafe {
        let app = NSApp();
        let focused_app: id = msg_send![app, focusedApplication];

        if focused_app.is_null() {
            return false;
        }

        // 检查应用是否在白名单中
        let bundle_id: id = msg_send![focused_app, bundleIdentifier];
        let bundle_str = NSString::UTF8String(bundle_id);

        if is_blacklisted_app(bundle_str) {
            return false;
        }

        // 获取系统级聚焦元素
        let system_wide = AXUIElementCreateSystemWide();
        let focused_element: id = msg_send![system_wide,
            attribute: kAXFocusedUIElementAttribute];

        if focused_element.is_null() {
            return false;
        }

        // 检查是否有选区范围属性 (可编辑文本框的典型特征)
        let has_selection: bool = msg_send![focused_element,
            attribute: kAXSelectedTextRangeAttribute];

        // 备选检查: 是否有 Value 属性
        if !has_selection {
            let has_value: bool = msg_send![focused_element,
                attribute: kAXValueAttribute];
            return has_value;
        }

        has_selection
    }
}

#[cfg(target_os = "macos")]
fn is_blacklisted_app(bundle_id: &str) -> bool {
    // 黑名单应用列表
    const BLACKLIST: &[&str] = &[
        "com.apple.GameCenterUI",
        "com.apple.ScreenSaver.Engine",
    ];

    BLACKLIST.contains(&bundle_id)
}

#[cfg(not(target_os = "macos"))]
pub fn is_editable_element() -> bool {
    // Windows/Linux 实现待定
    // 始终返回 true，依赖剪贴板回退
    true
}
```

### 智能剪贴板管理

```rust
// src-tauri/src/injection/smart_clipboard.rs
use arboard::Clipboard;
use std::time::Duration;

pub struct SmartClipboard {
    clipboard: Clipboard,
    last_known: Option<String>,
    injected_marker: String,
    injection_timeout: Duration,
}

impl SmartClipboard {
    pub fn new() -> Result<Self, Error> {
        Ok(Self {
            clipboard: Clipboard::new()?,
            last_known: None,
            injected_marker: String::new(),
            injection_timeout: Duration::from_millis(150),
        })
    }

    pub async fn inject_text(&mut self, text: String) -> InjectResult {
        // 1. 保存当前剪贴板内容
        let original = self.clipboard.get_text().ok();
        self.last_known = original.clone();

        // 2. 设置注入标记 (用于检测用户是否进行了新的复制操作)
        self.injected_marker = format!("\0__RAFLOW_INJECTED__\0{}", &text[..text.len().min(20)]);
        self.clipboard.set_text(&self.injected_marker).ok();
        self.clipboard.set_text(&text).ok();

        // 3. 检测可编辑性
        if is_editable_element() {
            // 模拟粘贴
            simulate_paste().await?;

            // 等待粘贴完成
            tokio::time::sleep(self.injection_timeout).await;

            // 异步恢复剪贴板
            let original = original.clone();
            let injected_marker = self.injected_marker.clone();
            tokio::spawn(async move {
                // 延迟恢复，给系统足够时间处理粘贴
                tokio::time::sleep(Duration::from_millis(50)).await;

                if let Ok(mut clipboard) = Clipboard::new() {
                    // 检查用户是否进行了新的复制操作
                    if let Ok(current) = clipboard.get_text() {
                        if current != injected_marker {
                            // 用户进行了新的复制操作，不恢复
                            return;
                        }
                    }

                    // 恢复原内容
                    if let Some(orig) = original {
                        let _ = clipboard.set_text(orig);
                    }
                }
            });

            InjectResult::Injected
        } else {
            // 不可编辑，文本保留在剪贴板
            // 发送系统通知
            send_notification("文本已复制到剪贴板");
            InjectResult::ClipboardOnly
        }
    }
}

async fn simulate_paste() -> Result<(), Error> {
    #[cfg(target_os = "macos")]
    {
        use enigo::{Enigo, KeyboardControllable, Key, KeyDirection};

        tokio::task::spawn_blocking(|| {
            let mut enigo = Enigo::new();
            enigo.key(Key::Meta, KeyDirection::Press);
            enigo.key(Key::Unicode('v'), KeyDirection::Click);
            enigo.key(Key::Meta, KeyDirection::Release);
        }).await?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        use enigo::{Enigo, KeyboardControllable, Key, KeyDirection};

        tokio::task::spawn_blocking(|| {
            let mut enigo = Enigo::new();
            enigo.key(Key::Control, KeyDirection::Press);
            enigo.key(Key::Unicode('v'), KeyDirection::Click);
            enigo.key(Key::Control, KeyDirection::Release);
        }).await?;
    }

    Ok(())
}

fn send_notification(message: &str) {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::*;
        use cocoa::foundation::*;

        unsafe {
            let notification = NSUserNotification::alloc(nil);
            notification.setTitle_(NSString::alloc(nil).init_str("RaFlow"));
            notification.setInformativeText_(NSString::alloc(nil).init_str(message));

            let center: id = msg_send![class!(NSUserNotificationCenter), defaultUserNotificationCenter];
            msg_send![center, deliverNotification: notification];
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // 使用系统通知库
        println!("Notification: {}", message);
    }
}
```

### 多语言支持

```rust
// src-tauri/src/elevenlabs/language.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageConfig {
    pub primary_language: String,
    pub enable_auto_detection: bool,
    pub supported_languages: Vec<String>,
}

impl Default for LanguageConfig {
    fn default() -> Self {
        Self {
            primary_language: "zh-CN".to_string(),
            enable_auto_detection: true,
            supported_languages: vec![
                "zh-CN".to_string(), // 中文 (简体)
                "en-US".to_string(), // 英语 (美国)
                "ja-JP".to_string(), // 日语
                "ko-KR".to_string(), // 韩语
            ],
        }
    }
}

// 在 WebSocket 连接建立时发送语言配置
impl ScribeClient {
    pub async fn configure_language(&mut self, config: &LanguageConfig) -> Result<(), Error> {
        let msg = json!({
            "message_type": "config",
            "language": config.primary_language,
            "enable_auto_language_detection": config.enable_auto_detection
        });

        self.tx.send(Message::Text(msg.to_string())).await?;
        Ok(())
    }
}
```

### 权限引导流程

```rust
// src-tauri/src/permissions/guide.rs
#[tauri::command]
async fn check_permissions() -> PermissionStatus {
    PermissionStatus {
        microphone: check_microphone_permission().await,
        accessibility: check_accessibility_permission(),
    }
}

#[derive(Debug, Serialize)]
struct PermissionStatus {
    microphone: bool,
    accessibility: bool,
}

async fn check_microphone_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        use cocoa::foundation::*;
        use cocoa::appkit::*;

        tokio::task::spawn_blocking(|| {
            unsafe {
                let status: i32 = msg_send![
                    class!(AVAudioSession),
                    sharedInstance
                ];
                status > 0
            }
        }).await.unwrap_or(false)
    }

    #[cfg(not(target_os = "macos"))]
    {
        // 其他平台的检测逻辑
        true
    }
}

#[cfg(target_os = "macos")]
fn check_accessibility_permission() -> bool {
    use cocoa::foundation::*;

    unsafe {
        let options = kAXTrustedCheckOptionPrompt::default();
        let trusted: bool = msg_send![
            class!(AXIsProcessTrusted),
            trusted
        ];
        trusted
    }
}

#[cfg(not(target_os = "macos"))]
fn check_accessibility_permission() -> bool {
    true
}

#[tauri::command]
async fn request_accessibility_permission() {
    #[cfg(target_os = "macos")]
    {
        use cocoa::foundation::*;

        unsafe {
            // 打开系统偏好设置的辅助功能页面
            let url = NSString::alloc(nil).init_str(
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            );
            let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
            msg_send![workspace, openURL: NSURL::alloc(nil).initWithString_(url)];
        }
    }
}
```

### 前端权限引导组件

```typescript
// src/components/PermissionGuide.tsx
import { usePermissions } from './hooks/usePermissions';

export function PermissionGuide() {
  const { status, requestMicrophone, requestAccessibility } = usePermissions();

  if (status.microphone && status.accessibility) {
    return null; // 所有权限已授予
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="max-w-md bg-gray-900 rounded-2xl p-8 text-white">
        <h2 className="text-2xl font-bold mb-6">欢迎使用 RaFlow</h2>
        <p className="text-gray-400 mb-8">
          需要以下系统权限才能正常工作:
        </p>

        <div className="space-y-4">
          <PermissionStep
            title="麦克风权限"
            description="用于语音输入"
            granted={status.microphone}
            onGrant={requestMicrophone}
            icon={<MicrophoneIcon />}
          />

          <PermissionStep
            title="辅助功能权限"
            description="用于智能文本注入"
            granted={status.accessibility}
            onGrant={requestAccessibility}
            icon={<AccessibilityIcon />}
          />
        </div>

        <p className="text-sm text-gray-500 mt-6">
          授予权限后，请重启应用
        </p>
      </div>
    </div>
  );
}

function PermissionStep({
  title,
  description,
  granted,
  onGrant,
  icon
}: PermissionStepProps) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl ${
      granted ? 'bg-green-900/30' : 'bg-gray-800'
    }`}>
      <div className={`p-3 rounded-full ${
        granted ? 'bg-green-500' : 'bg-gray-700'
      }`}>
        {icon}
      </div>

      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>

      {granted ? (
        <CheckCircle className="text-green-500" />
      ) : (
        <button
          onClick={onGrant}
          className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600"
        >
          授予权限
        </button>
      )}
    </div>
  );
}

// hooks/usePermissions.ts
export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus>({
    microphone: false,
    accessibility: false,
  });

  useEffect(() => {
    // 检查权限状态
    invoke<PermissionStatus>('check_permissions').then(setStatus);
  }, []);

  const requestMicrophone = async () => {
    try {
      await invoke('request_microphone_permission');
      setStatus((s) => ({ ...s, microphone: true }));
    } catch (e) {
      console.error('Failed to request microphone permission:', e);
    }
  };

  const requestAccessibility = async () => {
    try {
      await invoke('request_accessibility_permission');
      // 辅助功能权限需要用户手动操作，不自动更新状态
    } catch (e) {
      console.error('Failed to request accessibility permission:', e);
    }
  };

  return {
    status,
    requestMicrophone,
    requestAccessibility,
  };
}
```

---

## 📊 技术决策对比

| 方面 | 文档原方案 | 优化方案 | 理由 |
|------|-----------|----------|------|
| **音频采集** | 直接 cpal + rubato | 渐进: 插件 → 自定义 | 平衡速度与性能 |
| **线程模型** | std::thread | Tokio async 任务 | 避免事件循环冲突 |
| **错误恢复** | 未提及 | 断线重连 + 看门狗 | 生产级稳定性 |
| **性能监控** | 无 | 内置指标收集 | 支持持续优化 |
| **剪贴板** | 简单恢复 | 智能恢复 + 竞态检测 | 更好的用户体验 |
| **权限管理** | 静态检查 | 动态检测 + 引导 | 降低使用门槛 |
| **国际化** | 未提及 | 可插拔语言检测 | 面向全球开发者 |

---

## 📈 性能目标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| **端到端延迟** | <200ms | 从说话开始到文本显示的时间 |
| **音频采集延迟** | <50ms | 麦克风到 WebSocket 发送 |
| **转录延迟** | <150ms | 音频到达 ElevenLabs 到返回结果 |
| **内存占用** | <100MB (空闲) | 后台运行时的常驻内存 |
| **CPU 占用** | <5% (录音时) | 音频重采样 + 网络传输 |
| **正常运行时间** | >99% | 无崩溃连续运行时间 |

---

## 🎁 开发者体验

### 调试模式

```rust
// src-tauri/src/debug/mod.rs
#[cfg(debug_assertions)]
pub fn enable_debug_mode(app: &mut tauri::App) {
    // 启用详细日志
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("debug")
    ).init();

    println!("🔧 RaFlow Debug Mode Enabled");

    // 注册调试命令
    app.manage(DebugState::default());
}

#[derive(Default)]
pub struct DebugState {
    audio_buffer: Arc<Mutex<Vec<f32>>>,
    websocket_messages: Arc<Mutex<Vec<String>>>,
}

#[tauri::command]
fn debug_get_audio_buffer(state: tauri::State<'_, DebugState>) -> Vec<f32> {
    state.audio_buffer.lock().unwrap().clone()
}

#[tauri::command]
fn debug_get_websocket_state(state: tauri::State<'_, DebugState>) -> Vec<String> {
    state.websocket_messages.lock().unwrap().clone()
}
```

### 前端调试面板

```typescript
// src/components/DebugPanel.tsx
import { useMetrics } from './hooks/useMetrics';

export function DebugPanel() {
  const metrics = useMetrics();

  return (
    <div className="fixed top-4 right-4 bg-black/80 backdrop-blur-md
                    rounded-lg p-4 text-xs font-mono text-green-400 z-50">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <span>🔧</span> Debug Panel
      </h3>

      <div className="space-y-2">
        <Metric
          label="Audio Latency"
          value={metrics.audio_latency_p50}
          target="<50ms"
          unit="ms"
        />
        <Metric
          label="Transcription"
          value={metrics.transcription_latency_p50}
          target="<150ms"
          unit="ms"
        />
        <Metric
          label="Injection"
          value={metrics.injection_latency_p50}
          target="<100ms"
          unit="ms"
        />

        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="flex justify-between">
            <span>WebSocket:</span>
            <span className={metrics.websocket_connected ? 'text-green-400' : 'text-red-400'}>
              {metrics.websocket_connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Buffer Size:</span>
            <span>{metrics.audio_buffer_size}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, target, unit }: MetricProps) {
  const valueInMs = value.asMillis();
  const isGood = valueInMs < parseInt(target.replace(/[<ms]/g, ''));

  return (
    <div className="flex justify-between items-center">
      <span>{label}:</span>
      <span className={isGood ? 'text-green-400' : 'text-yellow-400'}>
        {valueInMs}{unit} <span className="text-gray-500">({target})</span>
      </span>
    </div>
  );
}

// hooks/useMetrics.ts
export function useMetrics() {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const snapshot = await invoke<MetricsSnapshot>('get_metrics');
      setMetrics(snapshot);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return metrics || defaultMetrics;
}
```

---

## 📁 项目结构

```
raflow/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                 # Tauri 主入口
│   │   ├── audio/
│   │   │   ├── mod.rs
│   │   │   ├── plugin.rs           # MVP: 插件封装
│   │   │   └── pipeline.rs         # V2: 自定义管道
│   │   ├── elevenlabs/
│   │   │   ├── mod.rs
│   │   │   ├── client.rs           # WebSocket 客户端
│   │   │   ├── robust_client.rs    # 断线重连
│   │   │   └── language.rs         # 多语言支持
│   │   ├── injection/
│   │   │   ├── mod.rs
│   │   │   ├── clipboard.rs        # 剪贴板注入
│   │   │   ├── smart_clipboard.rs  # 智能剪贴板
│   │   │   └── accessibility.rs    # 可编辑性检测
│   │   ├── telemetry/
│   │   │   ├── mod.rs
│   │   │   └── metrics.rs          # 性能指标
│   │   ├── permissions/
│   │   │   ├── mod.rs
│   │   │   └── guide.rs            # 权限引导
│   │   └── debug/
│   │       ├── mod.rs
│   │       └── panel.rs            # 调试面板
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── FloatingWindow.tsx      # 悬浮窗
│   │   ├── PermissionGuide.tsx     # 权限引导
│   │   └── DebugPanel.tsx          # 调试面板
│   ├── hooks/
│   │   ├── usePermissions.ts
│   │   ├── useMetrics.ts
│   │   └── useFloatingWindow.ts
│   ├── lib.ts
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 📚 参考资料

本次优化方案基于以下资源的研究:

1. **ElevenLabs 文档**
   - [Scribe v2 Realtime API](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
   - [WebSocket 实现指南](https://docs.soca.ai/api-reference/voice/voice-stream)

2. **Tauri 生态**
   - [System Tray 实现](https://medium.com/@sjobeiri/understanding-the-system-tray-from-concept-to-tauri-v2-implementation-252f278bb57c)
   - [tauri-plugin-mic-recorder](https://crates.io/crates/tauri-plugin-mic-recorder)
   - [Tauri v2 文档](https://v2.tauri.app/)

3. **Wispr Flow 研究**
   - [技术挑战文章](https://wisprflow.ai/post/technical-challenges)
   - [无障碍工具创新](https://wisprflow.ai/post/accessibility-voice-tools)

4. **音频处理**
   - [Rust 音频流与环形缓冲区](https://dev.to/drsh4dow/the-joy-of-the-unknown-exploring-audio-streams-with-rust-and-circular-buffers-494d)
   - [cpal 文档](https://docs.rs/cpal/)
   - [rubato 重采样库](https://docs.rs/rubato/)

5. **实时通信**
   - [OpenAI Realtime API 实现示例](https://medium.com/@anirudhgangwal/real-time-speech-transcription-with-openai-and-websockets-76eccf4fe51a)
   - [WebSocket 最佳实践](https://developers.telnyx.com/docs/voice/programmable-voice/stt-standalone)

---

## ✅ 总结

这份优化后的架构方案具有以下优势:

1. ✅ **保留快速迭代能力** - MVP 阶段使用现成插件
2. ✅ **避免技术债积累** - 渐进式迁移到高性能架构
3. ✅ **面向开发者优化** - 内置调试工具和性能监控
4. ✅ **生产级稳定性** - 断线重连、错误恢复、资源管理
5. ✅ **基于成熟实践** - 参考了 Wispr Flow 和 ElevenLabs 的生产经验

---

**文档版本**: v2.0
**创建日期**: 2026-02-07
**最后更新**: 2026-02-07
**作者**: RaFlow Team
