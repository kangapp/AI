# RaFlow 技术设计文档

**项目**: RaFlow - 语音交互桌面工具
**版本**: 0.1.0 (Phase 1 MVP)
**日期**: 2026-02-07
**状态**: 设计阶段

---

## 1. 项目概述

### 1.1 项目简介

RaFlow 是一款基于 Tauri v2 的桌面语音助手，通过全局热键唤醒，将用户语音实时转换为文本并注入到当前光标位置。项目名称来源于 "Rust" + "Flow"，寓意流畅的语音输入体验。

### 1.2 核心价值

- **系统级服务**: 常驻后台，随时响应语音输入
- **零摩擦体验**: 一个快捷键，说话即完成
- **智能回退**: 可输入时注入，不可输入时复制到剪贴板

### 1.3 技术愿景

Phase 1 构建最小可行产品，验证核心价值链：
```
语音采集 → 实时转录 → 剪贴板回退 → 用户粘贴
```

Phase 2/3 将扩展为完整的生产力工具。

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│  全局热键 (Cmd+Shift+H) → 录音 → 转录 → 剪贴板 → 用户粘贴      │
└─────────────────────────────────────────────────────────────────┘
                              ↑ ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Tauri 桥接层                                │
│  - Commands: start_recording, stop_recording, set_api_key      │
│  - Events: transcript:partial, transcript:committed             │
└─────────────────────────────────────────────────────────────────┘
                              ↑ ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Rust 后端                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐       │
│  │ AudioEngine │→ │ ScribeClient │→ │ ClipboardManager│       │
│  │  (cpal)     │  │  (WebSocket) │  │   (arboard)     │       │
│  └─────────────┘  └──────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↑ ↓
┌─────────────────────────────────────────────────────────────────┐
│                    外部服务                                       │
│  ElevenLabs Scribe v2 Realtime API (wss://...)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 | 依赖 |
|------|------|------|
| **AudioEngine** | 音频采集、重采样 | cpal, rubato, ringbuf |
| **ScribeClient** | WebSocket 通信、消息解析 | tokio-tungstenite |
| **ClipboardManager** | 剪贴板读写、通知 | arboard |
| **HotkeyManager** | 全局热键注册 | tauri-plugin-global-shortcut |
| **ConfigManager** | 配置持久化 | serde_json, dirs |

---

## 3. 核心模块设计

### 3.1 音频处理管道

**设计决策**: 使用 Ring Buffer 分离音频线程和处理线程

```rust
pub struct AudioEngine {
    // 音频输入流
    stream: Option<cpal::Stream>,
    // 无锁环形缓冲区 (8192 帧 ≈ 170ms @ 48kHz)
    producer: HeapRb<f32>::Producer,
    // 重采样器 (48kHz → 16kHz)
    resampler: Resampler,
    // 处理线程句柄
    handle: Option<JoinHandle<()>>,
}
```

**数据流**:
```
麦克风 (48kHz Float32)
    ↓
[音频线程] push_slice() → Ring Buffer
    ↓
[处理线程] pop() → rubato 重采样
    ↓
Float32 → Int16 PCM
    ↓
回调发送
```

**关键参数**:
- Ring Buffer 容量: 8192 帧
- 重采样块大小: 1024 帧
- 目标采样率: 16000 Hz

### 3.2 ElevenLabs 客户端

**WebSocket 协议**:

客户端发送:
```json
{
  "message_type": "input_audio_chunk",
  "audio_base_64": "<base64 encoded PCM>",
  "commit": false
}
```

服务端返回:
```json
{
  "message_type": "partial_transcript",
  "text": "你好，我正在"
}
```

```json
{
  "message_type": "committed_transcript",
  "text": "你好，我正在测试语音输入。"
}
```

**状态管理**:
```rust
pub enum ScribeState {
    Disconnected,
    Connecting,
    Connected,
    Recording,
    Error(String),
}
```

### 3.3 剪贴板管理

**Phase 1 简化策略**:
```rust
impl ClipboardManager {
    pub fn write_transcript(&self, text: &str) -> Result<()> {
        // 1. 写入剪贴板
        self.clipboard.set_text(text)?;

        // 2. 发送系统通知
        self.show_notification("文本已复制到剪贴板")?;

        Ok(())
    }
}
```

**通知内容**:
- 成功: "文本已复制到剪贴板"
- 长文本: "长文本已复制 (123 字符)"
- 错误: "转录失败，请重试"

---

## 4. Tauri 集成

### 4.1 Commands

```rust
// 录音控制
#[tauri::command]
async fn start_recording(app: AppHandle) -> Result<(), String>;

#[tauri::command]
async fn stop_recording(app: AppHandle) -> Result<(), String>;

// 配置管理
#[tauri::command]
async fn get_config() -> Result<AppConfig, String>;

#[tauri::command]
async fn set_api_key(key: String) -> Result<(), String>;

// 权限检查
#[tauri::command]
async fn check_permissions() -> Result<PermissionsStatus, String>;
```

### 4.2 Events

```rust
// 转录事件
app.emit("transcript:partial", PartialText { text: "..." })?;
app.emit("transcript:committed", CommittedText { text: "..." })?;

// 状态事件
app.emit("recording:started", ())?;
app.emit("recording:stopped", ())?;

// 错误事件
app.emit("error", ErrorMessage { code: "AUDIO_ERROR" })?;
```

---

## 5. 前端设计

### 5.1 组件结构

```
App.tsx
├── FloatingWindow.tsx (主界面)
│   ├── RecordingIndicator.tsx (录音状态)
│   ├── TranscriptDisplay.tsx (转录文本)
│   └── ControlButtons.tsx (控制按钮)
└── SettingsPanel.tsx (设置)
    └── ApiKeyInput.tsx
```

### 5.2 状态管理

使用 React Hooks + Tauri Events:

```typescript
function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [committedText, setCommittedText] = useState('');

  useEffect(() => {
    const unlisten = listen('transcript:partial', (e) => {
      setPartialText(e.payload.text);
    });
    return () => unlisten.then(fn => fn());
  }, []);

  return { isRecording, partialText, committedText };
}
```

### 5.3 UI 规格

**悬浮窗**:
- 尺寸: 420 x 180 px
- 位置: 底部居中
- 样式: 毛玻璃效果 (glassmorphism)
- 穿透: 默认鼠标穿透，控制按钮可交互

**转录文本**:
- Partial: 灰色 + 闪烁光标
- Committed: 黑色 + 2秒后淡出

---

## 6. 数据流

### 6.1 录音流程

```
1. 用户按下 Cmd+Shift+H
   ↓
2. HotkeyManager 触发 "hotkey:press"
   ↓
3. AudioEngine.start_capture()
   ↓
4. ScribeClient.connect()
   ↓
5. 音频数据 → WebSocket (流式)
   ↓
6. 接收 partial_transcript 事件
   ↓
7. 前端显示灰色文本
```

### 6.2 停止流程

```
1. 用户松开 Cmd+Shift+H
   ↓
2. HotkeyManager 触发 "hotkey:release"
   ↓
3. 发送 commit 消息给 ElevenLabs
   ↓
4. 接收 committed_transcript 事件
   ↓
5. ClipboardManager.write_transcript()
   ↓
6. 显示系统通知
   ↓
7. 前端显示最终文本并淡出
```

---

## 7. 错误处理

### 7.1 错误分类

```rust
pub enum RaFlowError {
    // 音频错误
    AudioNoDevice,
    AudioStreamError(String),

    // 网络错误
    WebSocketConnectFailed,
    WebSocketSendFailed,
    ApiKeyInvalid,

    // 剪贴板错误
    ClipboardAccessDenied,

    // 配置错误
    ConfigLoadFailed,
    ConfigSaveFailed,
}
```

### 7.2 错误恢复

| 错误类型 | 恢复策略 |
|---------|---------|
| 音频设备丢失 | 提示用户检查设备，自动重试 |
| WebSocket 断开 | 自动重连 (3次)，失败则提示用户 |
| API Key 无效 | 打开设置面板，提示重新输入 |
| 剪贴板失败 | 降级为日志记录 |

---

## 8. 配置管理

### 8.1 配置文件

**位置**: `~/.config/raflow/config.json`

```json
{
  "version": "0.1.0",
  "apiKey": "",
  "hotkey": "Cmd+Shift+H",
  "language": "auto",
  "notifications": true
}
```

### 8.2 默认值

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| hotkey | Cmd+Shift+H | 全局录音快捷键 |
| language | auto | 自动检测语言 |
| notifications | true | 显示系统通知 |

---

## 9. 安全考虑

### 9.1 API Key 存储

- 本地明文存储 (Phase 1)
- 文件权限: 用户只读 (0600)
- 不上传到云端

### 9.2 网络安全

- WSS 加密连接
- API Key 通过 URL 参数传递 (token)
- 不缓存音频数据

### 9.3 隐私

- 音频数据实时发送，不本地存储
- 转录文本仅在内存中临时保存
- 用户可随时停止录音

---

## 10. 性能目标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 冷启动时间 | < 500ms | 从命令到录音开始 |
| 首字延迟 | < 300ms | 说话到首字显示 |
| 端到端延迟 | < 500ms | 说话到剪贴板 |
| 内存占用 | < 50MB | 空闲时 |
| CPU 占用 | < 5% | 录音时 |

---

## 11. 测试策略

### 11.1 单元测试

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_resampler() {
        let mut resampler = Resampler::new(48000, 16000, 1024).unwrap();
        let input = vec![0.0f32; 1024];
        let output = resampler.process(&input).unwrap();
        assert_eq!(output.len(), 341); // 1024 * 16000 / 48000
    }
}
```

### 11.2 集成测试

- 模拟 WebSocket 服务器
- 测试音频采集 → 发送完整流程
- 测试剪贴板读写

### 11.3 手动测试

| 场景 | 预期结果 |
|------|----------|
| 快速按下/松开 | 无转录，无错误 |
| 长时间录音 (5min) | 稳定转录，内存不泄漏 |
| 无网络时启动 | 提示网络错误，不崩溃 |
| API Key 错误 | 提示重新输入 |

---

## 12. 发布计划

### 12.1 Phase 1 (v0.1.0)

**时间**: 4 周

**功能**:
- ✅ 全局热键录音
- ✅ 实时转录显示
- ✅ 剪贴板回退
- ✅ API Key 配置
- ✅ 系统通知

**限制**:
- 仅 macOS
- 仅剪贴板回退
- 仅在线模式

### 12.2 Phase 2 (v0.2.0)

**新增功能**:
- 光标位置注入 (Accessibility API)
- 应用黑名单
- 离线 Whisper 备用

### 12.3 Phase 3 (v0.3.0)

**新增功能**:
- Windows 支持
- 高级编辑命令
- 云同步配置

---

## 13. 技术债务与风险

### 13.1 已知限制

1. **全局热键优先级**
   - 问题: 系统快捷键可能覆盖
   - 影响: 部分应用中热键失效
   - 缓解: 提示用户更改快捷键

2. **全屏应用遮挡**
   - 问题: macOS 全屏应用覆盖置顶窗口
   - 影响: 用户看不到转录结果
   - 缓解: Phase 2 使用 Dock 图标显示

3. **网络依赖**
   - 问题: 无网络时无法使用
   - 影响: 离线场景不可用
   - 缓解: Phase 2 添加离线模式

### 13.2 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| ElevenLabs API 变更 | 中 | 高 | 版本锁定，迁移计划 |
| 音频驱动兼容性 | 低 | 中 | 多设备测试 |
| macOS 权限变更 | 中 | 中 | 权限检查引导 |

---

## 14. 参考资源

### 14.1 技术文档

- [ElevenLabs Scribe v2 API](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [cpal Audio Library](https://github.com/RustAudio/cpal)
- [arboard Clipboard](https://github.com/1Password/arboard)

### 14.2 参考项目

- [Handy - Offline Speech-to-Text](https://github.com/cjpais/Handy)
- [Wispr Flow](https://wisprflow.ai/)
- [whisper-stream-rs](https://lib.rs/crates/whisper-stream-rs)

---

## 15. 附录

### 15.1 术语表

| 术语 | 说明 |
|------|------|
| PCM | Pulse Code Modulation，脉冲编码调制音频 |
| RMS | Root Mean Square，音频能量值 |
| VAD | Voice Activity Detection，语音活动检测 |
| Accessibility | macOS 辅助功能 API |
| Ring Buffer | 环形缓冲区，无锁队列 |

### 15.2 变更日志

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-02-07 | 0.1.0 | 初始设计文档 |

---

**文档状态**: 待审核
**下一步**: Phase 1 开发启动
**负责人**: TBC
