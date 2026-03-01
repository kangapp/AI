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

- [ ] ElevenLabs API Key 安全存储方案
- [ ] 多麦克风设备选择 UI
- [ ] 离线模式支持？
- [ ] Windows 平台 Accessibility 实现
