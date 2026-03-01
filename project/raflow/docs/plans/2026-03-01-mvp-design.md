# RaFlow MVP 设计文档

> 基于 Tauri v2 与 ElevenLabs Scribe v2 的实时语音转录工具

---

## 1. 概述

### 1.1 项目目标

构建一个类似 Wispr Flow 的 macOS 语音听写工具，实现：
- 全局热键触发录音 (Cmd+Shift+H)
- 实时语音转文字 (<150ms 延迟)
- 转录文本自动复制到剪贴板
- 最小悬浮窗显示转录状态

### 1.2 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 启动策略 | MVP 优先 | 快速验证核心功能 |
| API Key | 硬编码/环境变量 | 个人工具定位 |
| 目标平台 | macOS 优先 | 用户主要使用环境 |
| 输出方式 | 纯剪贴板 | 简单稳定 |
| UI 复杂度 | 最小悬浮窗 | 满足基本反馈需求 |
| 架构方案 | Rust 全栈 | 后台稳定，性能最优 |

---

## 2. 项目结构

```
raflow/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs              # 入口 + Tauri 配置
│   │   ├── lib.rs               # 模块导出
│   │   ├── audio/               # 音频管道
│   │   │   ├── mod.rs
│   │   │   ├── capture.rs       # cpal 麦克风采集
│   │   │   ├── resampler.rs     # rubato 重采样
│   │   │   └── pipeline.rs      # Ring Buffer 管道
│   │   ├── transcription/       # 转录服务
│   │   │   ├── mod.rs
│   │   │   ├── client.rs        # WebSocket 客户端
│   │   │   └── types.rs         # 消息类型定义
│   │   ├── clipboard/           # 剪贴板操作
│   │   │   └── mod.rs
│   │   ├── hotkey/              # 全局热键
│   │   │   └── mod.rs
│   │   └── commands.rs          # Tauri 命令
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # React 前端
│   ├── App.tsx
│   ├── components/
│   │   ├── FloatingWindow.tsx   # 悬浮窗容器
│   │   ├── TranscriptDisplay.tsx # 转录文本显示
│   │   └── WaveformVisualizer.tsx # 音量波形
│   ├── hooks/
│   │   └── useTranscription.ts  # 转录状态管理
│   └── main.tsx
├── package.json
└── tailwind.config.js
```

---

## 3. 数据流架构

```
用户按下热键 (Cmd+Shift+H)
         │
         ▼
    HotkeyService ──────► 启动录音会话
         │
         ▼
┌─────────────────────────────────────────┐
│           Audio Pipeline (Rust)          │
│  cpal → RingBuf → rubato (48→16kHz)     │
└─────────────────────────────────────────┘
         │ PCM Int16
         ▼
┌─────────────────────────────────────────┐
│       TranscriptionClient (Rust)         │
│  Base64 Encode → WebSocket → ElevenLabs │
└─────────────────────────────────────────┘
         │
         ▼
  partial_transcript / committed_transcript
         │
    ┌────┴────┐
    ▼         ▼
 Tauri     Clipboard
 Event     写入文本
    │
    ▼
悬浮窗 UI 更新
```

**关键设计点**：
- **推挽分离**：音频线程只写 Ring Buffer，消费者线程处理重采样和网络发送
- **事件驱动**：Rust 通过 Tauri Events 推送状态到前端
- **热键控制**：按下开始，松开提交

---

## 4. 核心模块设计

### 4.1 音频管道

```rust
/// 音频管道核心结构
pub struct AudioPipeline {
    stream: Option<cpal::Stream>,
    producer: Producer<f32>,
    is_capturing: Arc<AtomicBool>,
}

impl AudioPipeline {
    pub fn start(&mut self) -> Result<Consumer<f32>>;
    pub fn stop(&mut self);
}
```

```rust
/// 重采样器：48kHz → 16kHz
pub struct AudioResampler {
    resampler: FftFixedIn<f32>,
    chunk_size: usize,  // 1024 帧
}

impl AudioResampler {
    pub fn process(&mut self, input: &[f32]) -> Vec<i16>;
}
```

### 4.2 转录客户端

```rust
/// ElevenLabs WebSocket 客户端
pub struct TranscriptionClient {
    ws: Option<WebSocketStream>,
    api_key: String,
}

impl TranscriptionClient {
    pub async fn connect(&mut self) -> Result<()>;
    pub async fn send_audio(&mut self, pcm_data: &[i16], commit: bool);
    pub async fn receive(&mut self) -> Result<TranscriptEvent>;
    pub async fn close(&mut self);
}

pub enum TranscriptEvent {
    Partial { text: String },
    Committed { text: String },
    SessionStarted { session_id: String },
    Error { message: String },
}
```

### 4.3 热键服务

```rust
/// 全局热键管理
pub struct HotkeyService {
    is_recording: Arc<AtomicBool>,
}

impl HotkeyService {
    pub fn register(&self, on_start: impl Fn(), on_stop: impl Fn());
    pub fn unregister(&self);
}
```

### 4.4 前端组件

```typescript
const FloatingWindow: FC = () => {
  const { status, partialText, committedText, audioLevel } = useTranscription();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
      <WaveformVisualizer level={audioLevel} />
      <TranscriptDisplay partial={partialText} committed={committedText} />
    </div>
  );
};
```

---

## 5. 技术依赖

### 5.1 Rust 依赖 (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-notification = "2"

cpal = "0.15"
rubato = "0.14"
ringbuf = "0.3"

tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.21"
futures-util = "0.3"

arboard = "3.4"
base64 = "0.22"

serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tracing = "0.1"
```

### 5.2 前端依赖 (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^11.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### 5.3 Tauri 配置

- 悬浮窗：透明、无边框、始终置顶
- macOS 权限：麦克风 (NSMicrophoneUsageDescription)
- 快捷键：Cmd+Shift+H

---

## 6. MVP 开发阶段

| Phase | 名称 | 交付物 |
|-------|------|--------|
| 1 | 项目初始化 | 可运行的空白悬浮窗 |
| 2 | 音频管道 | 可采集并输出 16kHz PCM |
| 3 | WebSocket 转录 | 可实时转录语音 |
| 4 | 全局热键 | 热键控制录音会话 |
| 5 | 剪贴板输出 | 转录文本自动复制 |
| 6 | UI 完善 | 完整 MVP 功能 |

---

## 7. MVP 功能范围

### 包含

- [x] Cmd+Shift+H 热键触发
- [x] 实时语音采集 (48kHz → 16kHz)
- [x] ElevenLabs WebSocket 连接
- [x] partial/committed 转录事件
- [x] 转录文本 → 剪贴板
- [x] 系统通知
- [x] 悬浮窗 UI
- [x] 音量波形

### 不包含 (后续版本)

- [ ] 智能文本注入 (Accessibility API)
- [ ] 多语言支持配置
- [ ] 设置面板
- [ ] 历史记录
- [ ] Windows 支持

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 音频线程阻塞导致爆音 | 高 | Ring Buffer 解耦，消费者线程处理 |
| WebSocket 连接不稳定 | 中 | 实现自动重连机制 |
| macOS 权限拒绝 | 中 | 启动时检测并引导用户开启 |
| ElevenLabs API 限流 | 低 | 错误提示，用户稍后重试 |

---

*文档创建于 2026-03-01*
