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
