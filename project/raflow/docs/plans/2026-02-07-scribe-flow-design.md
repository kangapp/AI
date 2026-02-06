# Scribe Flow macOS 桌面听写工具设计文档

**日期**: 2026-02-07
**版本**: 1.0
**状态**: 设计阶段

---

## 1. 项目概述

### 1.1 目标

构建一个 macOS 系统托盘应用程序，实现类似 "Wisper Flow" 的语音听写功能，使用 ElevenLabs Scribe v2 Realtime API 提供低延迟语音转文本服务。

### 1.2 核心功能

- **全局快捷键控制**：按住说话 / 切换模式（用户可选）
- **低延迟语音捕获**：基于 cpal 的实时录音
- **实时云端转录**：ElevenLabs Scribe v2 WebSocket API
- **智能文本插入**：辅助功能 API 优先，剪贴板回退
- **可视化反馈**：状态指示 + 转录预览 + 音量条 + 波形图 + VAD 指示器

### 1.3 使用场景

个人生产力工具：日常写文档、编程注释、快速笔记

### 1.4 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Rust + Tauri v2 |
| 前端 | TypeScript + React + Vite |
| 音频 | cpal + rubato + ringbuf |
| 网络 | tokio-tungstenite |
| 系统 | macOS Accessibility API |

---

## 2. 架构设计

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────┐
│                   用户交互层                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  系统托盘菜单  │  │   可视化窗口   │  │   设置界面   │ │
│  │  (TrayIcon)   │  │  (Overlay)    │  │  (WebView)  │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
                         ↕ (Tauri IPC)
┌─────────────────────────────────────────────────────┐
│                    核心服务层                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  状态管理器   │  │  权限检测器   │  │  设置存储   │ │
│  │ (StateManager)│  │(PermissionMgr)│  │  (Store)   │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│                    业务逻辑层                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  音频采集     │  │  网络客户端   │  │  文本注入   │ │
│  │ (AudioEngine) │  │(WSClient)     │  │(Injector)  │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 | 文件 |
|------|------|------|
| `main.rs` | 应用入口，Tauri setup，生命周期管理 | 入口 |
| `state.rs` | 应用状态机（Idle/Recording/Processing/Error） | 状态 |
| `audio.rs` | cpal 录音流，环形缓冲，重采样 | 音频 |
| `analyzer.rs` | 音量分析，VAD 检测 | 音频分析 |
| `network.rs` | WebSocket 连接，消息收发，错误重连 | 网络 |
| `injector.rs` | AX API 文本注入，剪贴板回退 | 注入 |
| `permissions.rs` | 权限检测，引导弹窗 | 权限 |
| `tray.rs` | 托盘图标，菜单构建 | 托盘 |
| `overlay.rs` | 可视化窗口管理 | 反馈 |

---

## 3. 状态机设计

### 3.1 状态定义

```rust
pub enum AppState {
    Idle,                    // 空闲：等待用户触发
    Connecting,              // 连接中：正在建立 WebSocket
    Recording,               // 录音中：音频流传输
    Processing,              // 处理中：等待最终转录结果
    Error(String),           // 错误状态：记录错误信息
}
```

### 3.2 状态转换

```
Idle → Connecting (用户按下快捷键)
Connecting → Recording (WebSocket 连接成功)
Connecting → Error (连接失败)
Recording → Processing (用户停止，发送 commit)
Recording → Error (网络断开/音频错误)
Processing → Idle (收到结果并插入文本)
Processing → Error (超时/插入失败)
Error → Idle (用户重试或自动恢复)
```

---

## 4. 数据流设计

### 4.1 音频数据流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  cpal 录音   │ ──▶ │ Ring Buffer │ ──▶ │  重采样器    │ ──▶ │ WebSocket   │
│  (48kHz f32) │     │  (无锁队列)  │     │ (48→16kHz)  │     │  上行发送    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**关键参数**：
- 环形缓冲区：10 秒容量（480,000 个 f32 样本）
- 发送块大小：4KB（约 125ms @ 16kHz）
- 编码格式：Base64(JSON) / PCM

### 4.2 转录结果流

```
WebSocket 下行 → 消息解析 → 事件分发
                              ├─ Partial → 实时显示
                              ├─ Final → 文本注入
                              └─ Error → 错误处理
```

---

## 5. 核心模块设计

### 5.1 音频引擎

```rust
pub struct AudioEngine {
    _stream: cpal::Stream,
    producer: ringbuf::HeapRbProducer<f32>,
    sample_rate: u32,
}

pub struct AudioAnalyzer {
    rms_window: Vec<f32>,
    peak_level: f32,
    threshold: f32,
}

pub struct VoiceActivityDetector {
    threshold: f32,
    speech_frames: usize,
    silence_frames: usize,
    state: VadState,
}
```

### 5.2 网络客户端

```rust
pub struct ElevenLabsClient {
    api_key: String,
    ws_url: String,
}

// 上行消息
pub enum ClientMessage {
    Start { audio_format: AudioFormat },
    AudioInput { audio: String },
    Commit,
}

// 下行消息
pub struct ServerMessage {
    pub msg_type: String,
    pub text: Option<String>,
    pub is_final: Option<bool>,
}
```

### 5.3 文本注入器

```rust
pub struct TextInjector;

pub enum InjectError {
    NoFocusedElement,
    NotEditable,
    ClipboardFailed,
    KeyboardFailed,
}
```

**策略**：AX API 直接插入 → 失败 → 剪贴板 + Cmd+V 模拟

---

## 6. 可视化反馈设计

### 6.1 窗口特性

- **位置**：跟随焦点窗口（顶部中央）
- **尺寸**：自适应（最小 200x60，最大 500x160）
- **样式**：透明背景，毛玻璃效果，点击穿透

### 6.2 UI 状态

| 状态 | 视觉特征 |
|------|----------|
| Idle | 灰色/绿色圆点，半透明，3秒后淡出 |
| Recording | 红色呼吸圆点，显示实时预览 |
| Processing | 橙色圆点，加载指示器 |
| Error | 红色背景，错误消息 + 操作按钮 |

### 6.3 高级可视化

**音量条**：
- 渐变填充（绿→橙→红）
- 扫光动画效果
- 可拖动阈值线
- 峰值指示器（带衰减动画）

**波形图**：
- Canvas 渲染
- 渐变色彩 + 发光效果
- 网格线背景（科技感）
- 下采样优化（约 250 点）

**VAD 指示器**：
- 三种状态图标（静音/说话/处理）
- 脉冲动画
- 位置：状态栏右侧

### 6.4 完整布局

```
┌─────────────────────────────────────────────────┐
│  ● 正在录音  🟢 检测到语音                        │ ← 状态栏 + VAD
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ ← 音量条
│  ╱╲╱╲╱╲╱╲╱╲╱╲___╱╲╱╲╱╲╱╲___                  │ ← 波形图
│  "你好，我是正在测试的文本..."                    │ ← 转录预览
└─────────────────────────────────────────────────┘
```

---

## 7. 权限管理

### 7.1 必需权限

| 权限 | 用途 | Info.plist Key |
|------|------|-----------------|
| 麦克风 | 录音 | `NSMicrophoneUsageDescription` |
| 辅助功能 | 文本注入 | `NSAccessibilityUsageDescription` |

### 7.2 检测与引导

1. App 启动时检查权限
2. 缺失权限 → 强制显示设置界面 + 黄色警告条
3. 点击"打开系统设置" → 调用 `openPrivacyPreferences()`
4. 用户授权后提示重启 App

---

## 8. 设置界面

### 8.1 配置项

| 设置项 | 默认值 | 存储键 |
|--------|--------|--------|
| API Key | - | `elevenlabs_api_key` |
| 快捷键 | `Cmd+Shift+Space` | `global_shortcut` |
| 交互模式 | `toggle` | `recording_mode` |
| 语言 | `auto` | `language_code` |
| 恢复剪贴板 | `true` | `restore_clipboard` |
| VAD 阈值 | `0.02` | `vad_threshold` |

### 8.2 UI 结构

```
┌─────────────────────────────────────┐
│  ⚙️ Scribe Flow 设置                 │
├─────────────────────────────────────┤
│  [⚠️ 需要 辅助功能 权限]             │
├─────────────────────────────────────┤
│  API 密钥                            │
│  [________________________]         │
│                    [验证]            │
├─────────────────────────────────────┤
│  快捷键                               │
│  ◯ 按住说话  ⦿ 切换模式              │
│  [ Cmd + Shift + Space ]            │
├─────────────────────────────────────┤
│  语言                                 │
│  [ 自动检测 ▼ ]                      │
├─────────────────────────────────────┤
│  音频灵敏度                            │
│  ━━━━━●━━━━  20%                    │
├─────────────────────────────────────┤
│  ☑ 粘贴后恢复剪贴板                   │
├─────────────────────────────────────┤
│        [ 保存 ]  [ 取消 ]            │
└─────────────────────────────────────┘
```

---

## 9. 错误处理

### 9.1 错误分类

| 类型 | 处理方式 |
|------|----------|
| 可恢复错误 | 自动重试（网络抖动、临时超时） |
| 需用户干预 | 显示提示（权限缺失、API Key 无效） |
| 致命错误 | 停止录音，返回 Idle（设备断开） |

### 9.2 错误响应

```rust
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}
```

---

## 10. 项目结构

```
scribe-flow-macos/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── state.rs
│   │   ├── errors.rs
│   │   ├── audio/
│   │   │   ├── mod.rs
│   │   │   ├── engine.rs
│   │   │   ├── analyzer.rs
│   │   │   └── vad.rs
│   │   ├── network.rs
│   │   ├── injector.rs
│   │   ├── permissions.rs
│   │   ├── tray.rs
│   │   └── overlay.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── Info.plist
│   └── entitlements.plist
│
├── src/
│   ├── main.tsx
│   ├── components/
│   │   ├── Settings.tsx
│   │   ├── PermissionWarning.tsx
│   │   └── ShortcutEditor.tsx
│   ├── hooks/
│   │   ├── useAppState.ts
│   │   └── useSettings.ts
│   └── styles/
│
├── src-overlay/
│   ├── index.html
│   ├── index.ts
│   ├── components/
│   │   ├── VolumeBar.tsx
│   │   ├── Waveform.tsx
│   │   └── VADIndicator.tsx
│   └── styles.css
│
└── package.json
```

---

## 11. 依赖项

### 11.1 Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2.0.0", features = ["tray-icon", "image-png"] }
tauri-plugin-global-shortcut = "2.0.0"
tauri-plugin-macos-permissions = "2.0.0"
tauri-plugin-store = "2.0.0"

serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.20", features = ["native-tls"] }

cpal = "0.15"
rubato = "0.14"
ringbuf = "0.3"

accessibility-sys = "0.1"
core-foundation = "0.9"
cocoa = "0.25"
objc = "0.2"
arboard = "3.2"
enigo = "0.2"
active-win-pos-rs = "0.8"
```

### 11.2 前端 (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^18.0",
    "react-dom": "^18.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@vitejs/plugin-react": "^4.0",
    "typescript": "^5.0",
    "vite": "^5.0"
  }
}
```

---

## 12. 实施路线图

### 第 1 周：基础框架 + 权限管理
- [ ] Tauri v2 项目初始化
- [ ] 配置 Info.plist 和 entitlements.plist
- [ ] 实现系统托盘（LSUIElement，隐藏 Dock）
- [ ] 实现权限检测模块
- [ ] 创建设置界面基础框架

### 第 2 周：音频 + 网络
- [ ] 实现 cpal 录音 + Ring Buffer
- [ ] 实现音频重采样 (48kHz → 16kHz)
- [ ] 实现 ElevenLabs WebSocket 客户端
- [ ] 实现消息协议（start/audio_input/commit）
- [ ] 编写测试脚本验证端到端转录

### 第 3 周：文本注入 + 可视化
- [ ] 实现 AX API 文本注入
- [ ] 实现剪贴板回退机制
- [ ] 创建 Overlay 可视化窗口
- [ ] 实现基础可视化（状态 + 预览）
- [ ] 集成全局快捷键

### 第 4 周：高级可视化 + 优化
- [ ] 实现音量条 + 波形图 + VAD
- [ ] 完整流程测试
- [ ] 错误处理完善
- [ ] 延迟优化（目标：<500ms）
- [ ] UI/UX 细节打磨
- [ ] 打包 DMG 分发版本

---

## 13. 测试策略

### 13.1 单元测试
- 状态转换测试
- 音频重采样测试
- VAD 算法测试

### 13.2 集成测试
- WebSocket 协议验证（TypeScript 测试脚本）
- 端到端转录测试

### 13.3 手动测试清单

| 测试项 | 预期结果 |
|--------|----------|
| 按下快捷键开始 | Overlay 显示红点，状态变为 Recording |
| 说话时 | Partial 实时显示，波形图跳动 |
| 松开快捷键 | 状态变为 Processing，约 300ms 后文本上屏 |
| 无权限时启动 | 强制显示设置界面，黄色警告条 |
| 网络断开时 | 显示错误提示，自动重试 3 次 |
| 切换到不可编辑窗口 | 自动回退到剪贴板模式 |

---

## 14. 性能目标

| 指标 | 目标值 |
|------|--------|
| 端到端延迟 | < 500ms |
| 音频缓冲延迟 | < 50ms |
| UI 响应延迟 | < 100ms |
| 内存占用 | < 100MB (空闲) |
| CPU 占用 | < 5% (录音中) |

---

## 15. 附录

### 15.1 ElevenLabs API 端点

```
wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime
```

### 15.2 麦克风权限字符串

```
我们需要访问麦克风以将您的语音实时转录为文本。
```

### 15.3 辅助功能权限字符串

```
我们需要辅助功能权限以检测当前输入框并将文本插入其中。
```

---

**文档版本**: 1.0
**最后更新**: 2026-02-07
**作者**: Claude Code + 用户协作设计
