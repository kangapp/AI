# 技术发现 - RaFlow

> 记录研究结论、API 结构、技术决策依据

---

## 1. 核心引擎：ElevenLabs Scribe v2 Realtime API

### 1.1 API 特性

| 特性 | 指标 | 备注 |
|------|------|------|
| 延迟 | <150ms (不含网络) | "负延迟"概念，具备下一词预测能力 |
| 音频格式 | PCM 16-bit, 16kHz (推荐) | 客户端需进行本地重采样 |
| VAD | 内置且可配置 | 支持 Push-to-Talk 模式 |
| 输出事件 | partial / committed | UI 实现灰字变黑字效果 |
| 语言 | 90+ 语言，自动检测 | 无需手动切换 |

### 1.2 WebSocket 协议

**端点**: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`

**鉴权方式**:
- HTTP Header: `xi-api-key`
- URL 参数: `?token=xxx`

**消息类型**:

```typescript
// 服务端 → 客户端
interface SessionStarted {
  message_type: 'session_started';
  session_id: string;
  config: { sample_rate: number; model_id: string; vad_threshold: number };
}

interface PartialTranscript {
  message_type: 'partial_transcript';
  text: string;
  created_at_ts?: number;
}

interface CommittedTranscript {
  message_type: 'committed_transcript';
  text: string;
  created_at_ts?: number;
}

// 客户端 → 服务端
interface InputAudioChunk {
  message_type: 'input_audio_chunk';
  audio_base_64: string;
  commit?: boolean;
}
```

### 1.3 通信流程

```
1. 建立 WebSocket 连接
2. 等待 session_started 消息
3. 流式发送 input_audio_chunk (commit: false)
4. 接收 partial_transcript (实时更新 UI)
5. 用户停止时发送 commit: true
6. 接收 committed_transcript (最终结果)
7. 触发文本注入
```

---

## 2. 音频处理管道

### 2.1 线程模型

```
[音频线程 - cpal] → [Ring Buffer] → [消费者线程 - tokio]
     高优先级           无锁              重采样 + 发送
```

**关键约束**:
- 音频回调中禁止阻塞操作
- 使用 Ring Buffer 解耦生产/消费
- 重采样在独立线程执行

### 2.2 重采样配置

```rust
// 输入: 48kHz (麦克风默认)
// 输出: 16kHz (API 要求)
// 算法: FftFixedIn (确定性延迟)
// 块大小: 1024 帧
```

### 2.3 PCM 转换

```rust
// Float32 → Int16
fn float_to_i16(s: f32) -> i16 {
    let s = s.clamp(-1.0, 1.0);
    if s >= 0.0 { (s * 32767.0) as i16 }
    else { (s * 32768.0) as i16 }
}
```

---

## 3. 文本注入策略

### 3.1 可编辑性探测 (macOS)

```rust
// 使用 Accessibility API
fn is_editable_element() -> bool {
    // 1. 获取系统级 AXUIElement
    // 2. 查询 kAXFocusedUIElementAttribute
    // 3. 检查 kAXSelectedTextRangeAttribute 是否存在
    // 存在 → 可编辑
}
```

### 3.2 注入流程

```
1. 保存当前剪贴板内容
2. 将转录文本写入剪贴板
3. 检测可编辑性:
   - 可编辑: 模拟 Cmd+V, 等待 50ms, 恢复原剪贴板
   - 不可编辑: 保留文本在剪贴板, 发送通知
```

### 3.3 权限要求

| 平台 | 权限 | 用途 |
|------|------|------|
| macOS | NSMicrophoneUsageDescription | 麦克风访问 |
| macOS | Accessibility (辅助功能) | 模拟键盘/获取窗口信息 |
| Windows | 无特殊声明 | 但 Defender 可能报警 |

---

## 4. 依赖清单

### 4.1 Rust Crates

```toml
[dependencies]
tauri = { version = "2.0", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2.0"
tauri-plugin-clipboard-manager = "2.0"
cpal = "0.15"
rubato = "0.14"
ringbuf = "0.3"
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.20"
enigo = "0.2"
arboard = "3.3"
active-win = "0.4"
```

### 4.2 Frontend Packages

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0",
    "react": "^18",
    "framer-motion": "^11",
    "clsx": "^2",
    "tailwind-merge": "^2"
  }
}
```

---

## 5. 待解决问题

- [x] ElevenLabs API Key 安全存储方案 → 已实现 config 模块 (.env + config.json)
- [ ] 多麦克风设备选择 UI
- [ ] 离线模式支持？
- [ ] Windows 平台 Accessibility 实现

---

## 6. Phase 8 集成发现

### 6.1 cpal::Stream 线程安全

**问题**: `cpal::Stream` 不是 `Send + Sync`，无法存储在 Tauri 状态中。

**解决方案**: 在专用线程中创建和管理 `AudioPipeline`，通过 `mpsc::channel` 传递音频数据。

```rust
// AudioPipeline 在专用线程中运行
let handle = thread::spawn(move || {
    let mut pipeline = AudioPipeline::new().unwrap();
    pipeline.start(|pcm| {
        let _ = sender.blocking_send(pcm);
    });
    // 等待取消信号
    while !cancel_token.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(100));
    }
    pipeline.stop();
});
```

### 6.2 WebSocket 双向通信

**问题**: `TranscriptionClient` 在 `connect()` 时 split 了 WebSocket，无法同时发送和接收。

**解决方案**: 创建独立的 `websocket_task.rs` 模块，使用 `tokio::select!` 实现双向通信。

```rust
tokio::select! {
    // 发送音频
    Some(pcm) = audio_rx.recv() => {
        sender.send(WsMessage::Text(json)).await?;
    }
    // 接收转录
    msg = receiver.next() => {
        // 处理 incoming message
    }
    // commit 信号
    _ = commit_rx.recv() => {
        sender.send(WsMessage::Text(commit_json)).await?;
    }
}
```

```
tokio::select! {
    // 发送音频
    Some(pcm) = audio_rx.recv() => {
        sender.send(WsMessage::Text(json)).await?;
    }
    // 接收转录
    msg = receiver.next() => {
        // 处理 incoming message
    }
    // commit 信号
    _ = commit_rx.recv() => {
        sender.send(WsMessage::Text(commit_json)).await?;
    }
}
```

### 6.3 异步锁最佳实践

**问题**: 在热键处理中持有锁时间过长，阻塞 UI。

**解决方案**: 最小化锁作用域，将耗时操作移到锁外执行。

```rust
// 快速检查
let should_stop = {
    let guard = state.session.lock().await;
    guard.as_ref().map_or(false, |s| s.is_active())
};

// 在锁外执行耗时操作
if should_stop {
    let mut guard = state.session.lock().await;
    session.stop(app_handle).await?;
}
```

### 6.4 阻塞操作在异步上下文

**问题**: `JoinHandle::join()` 是阻塞调用，在异步函数中会阻塞 tokio runtime。

**解决方案**: 使用 `tokio::task::spawn_blocking` 包装阻塞操作。

```rust
tokio::task::spawn_blocking(move || {
    let _ = handle.join();
}).await;
```

### 6.5 架构总结

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Application                        │
├─────────────────────────────────────────────────────────────────┤
│  SessionState (Arc<Mutex<Option<RecordingSession>>>)            │
│      │                                                          │
│      ▼                                                          │
│  RecordingSession                                               │
│      ├── audio_thread_handle: JoinHandle<()>                    │
│      ├── audio_sender: mpsc::Sender<Vec<i16>>                   │
│      ├── commit_sender: mpsc::Sender<()>                        │
│      ├── is_active: Arc<AtomicBool>                             │
│      └── committed_text: Arc<Mutex<String>>                     │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────┐     │
│  │   Audio Thread      │    │   WebSocket Task (tokio)    │     │
│  │   (cpal + rubato)   │───►│   (tokio-tungstenite)       │     │
│  │                     │    │                             │     │
│  │   48kHz → 16kHz     │    │   send: audio_base64        │     │
│  │   mpsc::Sender      │    │   recv: partial/committed   │     │
│  └─────────────────────┘    │   emit: Tauri events        │     │
│                              └─────────────────────────────┘     │
│                                          │                      │
│                                          ▼                      │
│                              ┌─────────────────────────────┐     │
│                              │   Frontend (React)          │     │
│                              │   useTranscription hook     │     │
│                              │   partial/committed display │     │
│                              └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 6.6 ElevenLabs API 认证修复

**问题链**:
1. WebSocket 连接缺少 `model_id` 参数
2. 使用 `Request::builder()` 缺少 `sec-websocket-key` header
3. API Key 通过 URL 参数传递认证失败

**最终解决方案**:
使用 `into_client_request()` 自动生成所有必需的 WebSocket headers，然后添加自定义认证 header：

```rust
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, http, Message as WsMessage};

// 使用 into_client_request() 自动设置所有 WebSocket headers
let ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime";
let mut request = ws_url.into_client_request()
    .map_err(|e| format!("Failed to create request: {}", e))?;

// 添加 xi-api-key header 进行认证
request.headers_mut().insert("xi-api-key", api_key.parse()?);

// 连接
let (ws_stream, _) = tokio_tungstenite::connect_async(request).await?;
```

**关键发现**:
- `tokio-tungstenite` 0.26 的 `connect_async()` 需要使用 `into_client_request()` 来自动生成 WebSocket 必需的 headers
- ElevenLabs API 使用 `xi-api-key` HTTP Header 认证，而非 URL 参数
- `model_id=scribe_v2_realtime` 必须作为 URL 参数传递

**来源**: [ElevenLabs Scribe v2 Realtime API](https://elevenlabs.io/docs/speech-to-text/websockets), [tokio-tungstenite 文档](https://docs.rs/tokio-tungstenite)

---

## 7. Phase 10 转录优化发现

### 7.1 ElevenLabs API 可配置参数

**WebSocket URL 参数**:
| 参数 | 说明 | 示例值 |
|------|------|--------|
| `model_id` | 模型标识 | `scribe_v2_realtime` |
| `language_hints` | 语言提示数组 | `["zh"]` |
| `include_timestamps` | 包含时间戳 | `true` |

**消息级 VAD 配置** (首次 audio_chunk 携带):
| 参数 | 类型 | 默认值 | 推荐值 | 作用 |
|------|------|--------|--------|------|
| `vad_threshold` | f32 | 0.4 | 0.55 | VAD 灵敏度，越高越严格 |
| `vad_silence_threshold_secs` | f32 | 1.5 | 1.0 | 静音判定时长阈值 |
| `min_speech_duration_ms` | u32 | 100 | 80 | 最小语音片段时长 |
| `min_silence_duration_ms` | u32 | 100 | 150 | 最小静音片段时长 |

### 7.2 优化策略

**问题**: 语速快 + 环境噪音导致识别错误（同音字、误判）

**方案 A (已选择)**: API 参数调优
- 添加 `language_hints=["zh"]` 指定中文优先
- 调整 VAD 参数适应快语速和噪音过滤
- 零依赖、快速验证、可渐进增强

**参数调优逻辑**:
```
语速快 → 降低 vad_silence_threshold_secs (1.5→1.0)
       → 降低 min_speech_duration_ms (100→80)
       → 提高 min_silence_duration_ms (100→150)

噪音大 → 提高 vad_threshold (0.4→0.55)
```

### 7.3 实现位置

| 文件 | 改动 |
|------|------|
| `src-tauri/src/transcription/types.rs` | 添加 VadConfig 结构体，扩展 OutgoingMessage |
| `src-tauri/src/session/websocket_task.rs` | URL 添加 language_hints，首次消息携带 VAD 配置 |

**来源**: [ElevenLabs Scribe v2 Realtime API](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-to-text/realtime/transcripts-and-commit-strategies)

---

## 8. Phase 11-13 Bug 修复与 UI 优化发现

### 8.1 URL 编码问题

**问题**: `language_hints=["zh"]` 中的 `[` `]` `"` 字符在 URL 中非法

**解决方案**: URL 编码
```
["zh"] → %5B%22zh%22%5D
```

### 8.2 错误事件传递

**问题**: WebSocket 连接失败时，前端不知道发生了什么

**解决方案**: 在 WebSocket 任务失败时发送 `transcription-error` 事件

```rust
// recording.rs - run_websocket_task
if let Err(ref e) = result {
    let error_type = if e.contains("Authentication") { "auth" }
                    else if e.contains("Connection") { "network" }
                    else { "server" };
    let _ = app_handle.emit("transcription-error", json!({
        "type": error_type,
        "message": e
    }));
}
```

### 8.3 macOS 弹性滚动问题

**问题**: macOS 的弹性滚动 (rubber banding) 导致滚动到底部会回弹

**解决方案**:
```css
/* 禁用弹性滚动 */
overflow-y: auto;
overscroll-behavior: none;
-webkit-overflow-scrolling: auto; /* 不使用 touch */
```

### 8.4 滚动到底部不完整

**问题**: 滚动到底部后，最后一行文字被截断

**解决方案**:
1. 添加底部内边距 `pb-4` (16px)
2. 直接设置 `scrollTop` 而非使用平滑滚动

```tsx
// 直接滚动，避免回弹
container.scrollTop = content.scrollHeight - container.clientHeight;
```

### 8.5 Apple 风格 UI 设计系统

**颜色系统** (macOS 系统色):
| 颜色 | 色值 | 用途 |
|------|------|------|
| Blue | #007AFF | 主色调，录音状态 |
| Orange | #FF9500 | 连接中 |
| Purple | #AF52DE | 处理中 |
| Red | #FF3B30 | 错误 |
| Gray | #8E8E93 | 空闲 |

**视觉效果**:
```css
/* 毛玻璃效果 */
backdrop-filter: blur(50px) saturate(180%);

/* 圆角 */
border-radius: 18px;

/* 阴影 */
box-shadow:
  0 0 0 0.5px rgba(255,255,255,0.1),
  0 30px 60px -15px rgba(0,0,0,0.5);
```

**字体**:
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text";
```

---

## 9. Phase 15 Bug 修复发现

### 9.1 全局快捷键重复触发问题

**问题**: 按一次 Cmd+Shift+H 后，状态变为 "Connecting"，然后又立即回到 "Ready"

**原因**:
- `tauri-plugin-global-shortcut` 在快捷键 **按下** 和 **释放** 时都会触发回调
- 第一次触发 (Pressed) 开始录音
- 第二次触发 (Released) 停止录音
- 两次事件间隔约 100ms

**解决方案**:
```rust
app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
    // 只在按下时处理，忽略释放事件
    if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
        return;
    }
    // ... 处理录音逻辑
});
```

### 9.2 复制文字不完整问题

**问题**: 转录过程中部分文字已确认(VAD commit)，但停止时复制的文字不完整

**原因**: commit 信号发送后等待时间太短 (500ms)，服务器可能还在处理

**解决方案**: 增加等待时间到 2 秒
```rust
// 原来: tokio::time::sleep(Duration::from_millis(500)).await;
// 修改后:
tokio::time::sleep(Duration::from_millis(2000)).await;
```

---

## 10. 悬浮窗设置功能设计

### 10.1 需求汇总

| 功能 | 描述 |
|------|------|
| 设置入口 | 系统托盘菜单 → "设置" |
| 位置设置 | 任意位置拖拽，保存位置 |
| 文字样式 | 字体大小、文字颜色、背景颜色/透明度 |
| 窗口大小 | 宽度/高度可调 |
| 隐藏功能 | 可隐藏悬浮窗，隐藏后托盘图标+菜单栏显示状态 |

### 10.2 UI 架构

```
┌─────────────────────────────────┐
│  [状态指示器]  [⚙️设置图标]      │  ← 点击设置图标切换视图
├─────────────────────────────────┤
│                                 │
│      主界面：转录文字/波形        │
│                                 │
└─────────────────────────────────┘
           ↓ 切换到设置
┌─────────────────────────────────┐
│  [←返回]      设置              │
├─────────────────────────────────┤
│  位置    [📍] 自由拖拽          │
│  大小    [滑块] W: 440 H: 180   │
│  ─────────────────────────────  │
│  字体大小    [====●====] 16px   │
│  文字颜色    [●●●●●●] #FFFFFF  │
│  背景颜色    [●●●●●●] #000000  │
│  背景透明度  [====●====] 80%   │
│  ─────────────────────────────  │
│  [✓] 隐藏悬浮窗                 │
└─────────────────────────────────┘
```

### 10.3 数据结构

```rust
// config/mod.rs - 新增 FloatingWindowSettings
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}
```

### 10.4 托盘菜单设计

```
┌─────────────────────┐
│ RaFlow             │
├─────────────────────┤
│ ● 录音中...         │  ← 状态显示
├─────────────────────┤
│ 打开悬浮窗          │  ← 隐藏时显示
│ 设置...             │
├─────────────────────┤
│ 退出                 │
└─────────────────────┘
```

### 10.5 隐藏状态反馈

| 状态 | 托盘图标 | 菜单栏 |
|------|----------|--------|
| 空闲 | 灰色图标 | RaFlow - Ready |
| 录音中 | 红色图标 | RaFlow - Recording |
| 连接中 | 橙色图标 | RaFlow - Connecting |
| 处理中 | 紫色图标 | RaFlow - Processing |
| 错误 | 红色图标 | RaFlow - Error |

### 10.6 实现文件清单

| 文件 | 改动 |
|------|------|
| `src-tauri/src/config/mod.rs` | 添加 FloatingWindowSettings 结构体 |
| `src-tauri/src/commands.rs` | 添加窗口位置/大小读写命令 |
| `src-tauri/src/lib.rs` | 初始化托盘菜单，响应设置事件 |
| `src/App.tsx` | 添加视图切换状态 |
| `src/components/SettingsPanel.tsx` | 新建设置面板组件 |
| `src/hooks/useSettings.ts` | 新建设置 Hook |

### 10.7 拖拽实现

使用 Tauri Window API:
- `startDragging()` - 开始拖拽
- `outerPosition()` - 获取窗口物理位置
- `setPosition()` - 设置窗口位置
- `setSize()` - 设置窗口大小

### 10.8 持久化策略

- 设置变更后立即保存到 config.json
- 应用启动时加载设置并应用到窗口

---

## 11. Phase 16 Bug 修复发现

### 11.1 主题网格没有自适应

**问题**: 主题网格始终显示 3 列，无法根据窗口宽度自适应

**原因**:
- Tailwind 的 `sm:grid-cols-5` 基于**视口宽度**而非容器实际宽度
- 浮动窗口 440px < Tailwind sm 断点 640px

**解决方案**: 使用 ResizeObserver 监听容器宽度
```tsx
const gridRef = useRef<HTMLDivElement>(null);
const [gridCols, setGridCols] = useState(3);

useEffect(() => {
  const updateGridCols = () => {
    if (!gridRef.current) return;
    const width = gridRef.current.offsetWidth;
    if (width >= 350) setGridCols(5);
    else if (width >= 250) setGridCols(4);
    else setGridCols(3);
  };

  const resizeObserver = new ResizeObserver(updateGridCols);
  resizeObserver.observe(gridRef.current);
  return () => resizeObserver.disconnect();
}, []);
```

### 11.2 就绪状态接收转录

**问题**: idle 状态也接收并显示转录内容，光标闪烁

**原因**: 前端事件监听器没有检查当前状态

**解决方案**: 双重保护
1. **数据层** (useTranscription.ts): 事件处理增加状态检查
2. **UI 层** (TranscriptDisplay.tsx): 渲染时增加状态检查

```tsx
// 数据层
if (prev.status !== "recording" && prev.status !== "connecting") {
  return prev; // 忽略 idle 状态的事件
}

// UI 层
{status === "recording" && <motion.span>光标</motion.span>}
```

### 11.3 已确认和转中文字颜色相同

**问题**: committed 和 partial text 使用相同颜色，无法区分

**解决方案**: 使用透明度区分
```tsx
// committed: 使用用户自定义颜色或状态颜色
const mainColor = textColor || getTextColor(status);
// partial: 使用半透明版本
const partialColor = textColor ? `${textColor}80` : getPartialColor(status);
```

### 11.4 调整窗口大小时抖动

**问题**: 拖动滑块时窗口实时调整，导致抖动

**原因**: 每次 onChange 都调用后端保存和调整窗口

**解决方案**: 分离交互
- `onChange`: 只更新本地预览状态 (sizePreview)
- `onMouseUp`/`onTouchEnd`: 释放时保存到后端

```tsx
// 拖动时只更新预览
onChange={(e) => setSizePreview({ width: Number(e.target.value), ... })};

// 释放时才保存
onMouseUp={(e) => {
  updateSetting('window_size', { width: Number(e.target.value), ... });
  setSizePreview(null);
}}
```

