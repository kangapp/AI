# 转录识别率优化实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过调整 ElevenLabs API 参数优化语音识别率，解决语速快和环境噪音导致的识别错误问题。

**Architecture:** 在 WebSocket 连接 URL 添加 language_hints 参数指定中文，在首次音频消息中携带 VAD 配置参数来优化语音检测灵敏度。

**Tech Stack:** Rust, tokio-tungstenite, serde_json

---

## Task 1: 扩展 OutgoingMessage 添加 VAD 配置字段

**Files:**
- Modify: `src-tauri/src/transcription/types.rs:82-123`

**Step 1: 添加 VAD 配置结构体**

在 `types.rs` 中，在 `OutgoingMessage` 结构体之前添加配置结构体：

```rust
/// VAD (Voice Activity Detection) 配置参数
///
/// 用于优化语音检测灵敏度，适应不同语速和噪音环境。
#[derive(Debug, Clone, Serialize)]
pub struct VadConfig {
    /// VAD 置信度阈值 (0.0-1.0)
    /// 更高的值要求更强的信号才被识别为语音
    /// 推荐值: 0.55 (默认 0.4)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_threshold: Option<f32>,

    /// 静音时长阈值（秒）
    /// 超过此时长的静音会触发提交
    /// 推荐值: 1.0 (默认 1.5)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_silence_threshold_secs: Option<f32>,

    /// 最小语音片段时长（毫秒）
    /// 短于此值的语音片段会被忽略
    /// 推荐值: 80 (默认 100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_speech_duration_ms: Option<u32>,

    /// 最小静音片段时长（毫秒）
    /// 短于此值的静音不会被视为句子结束
    /// 推荐值: 150 (默认 100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_silence_duration_ms: Option<u32>,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            vad_threshold: Some(0.55),
            vad_silence_threshold_secs: Some(1.0),
            min_speech_duration_ms: Some(80),
            min_silence_duration_ms: Some(150),
        }
    }
}
```

**Step 2: 扩展 OutgoingMessage 结构体**

修改 `OutgoingMessage` 添加配置字段：

```rust
/// Outgoing message to ElevenLabs WebSocket
#[derive(Debug, Clone, Serialize)]
pub struct OutgoingMessage {
    /// Message type identifier
    pub message_type: &'static str,
    /// Base64-encoded audio data (PCM 16kHz mono)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_base_64: Option<String>,
    /// Whether to commit the current audio buffer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit: Option<bool>,
    /// Audio sample rate in Hz
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    /// VAD configuration (only sent in first message)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_threshold: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_silence_threshold_secs: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_speech_duration_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_silence_duration_ms: Option<u32>,
}
```

**Step 3: 添加带配置的构造函数**

在 `impl OutgoingMessage` 中添加：

```rust
    /// Create an audio chunk message with VAD configuration
    ///
    /// This should be used for the first audio message to configure
    /// the transcription engine.
    #[must_use]
    pub fn audio_with_config(base64: String, config: &VadConfig) -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(base64),
            commit: None,
            sample_rate: Some(16000),
            vad_threshold: config.vad_threshold,
            vad_silence_threshold_secs: config.vad_silence_threshold_secs,
            min_speech_duration_ms: config.min_speech_duration_ms,
            min_silence_duration_ms: config.min_silence_duration_ms,
        }
    }
```

**Step 4: 运行测试验证**

Run: `cd src-tauri && cargo test transcription::types --lib`

Expected: 所有测试通过

**Step 5: Commit**

```bash
git add src-tauri/src/transcription/types.rs
git commit -m "feat(transcription): add VadConfig and extend OutgoingMessage with VAD fields"
```

---

## Task 2: 修改 WebSocket 连接添加 language_hints

**Files:**
- Modify: `src-tauri/src/session/websocket_task.rs:42`

**Step 1: 更新 WebSocket URL**

修改第 42 行的 URL：

```rust
// 旧代码
let ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime";

// 新代码
let ws_url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&language_hints=[\"zh\"]";
```

**Step 2: 运行编译验证**

Run: `cd src-tauri && cargo check`

Expected: 编译成功

**Step 3: Commit**

```bash
git add src-tauri/src/session/websocket_task.rs
git commit -m "feat(transcription): add language_hints=[zh] to WebSocket URL"
```

---

## Task 3: 修改音频发送逻辑携带 VAD 配置

**Files:**
- Modify: `src-tauri/src/session/websocket_task.rs:108-119`

**Step 1: 添加首次发送标志**

在 `run_transcription_task` 函数开始处（session_id 定义之后）添加：

```rust
    tracing::info!("Transcription session started: {}", session_id);

    // 标记是否已发送配置（首次音频消息携带 VAD 配置）
    let mut config_sent = false;

    // 获取默认 VAD 配置
    let vad_config = crate::transcription::VadConfig::default();
    tracing::info!("VAD config: threshold={:?}, silence_threshold={:?}s",
        vad_config.vad_threshold, vad_config.vad_silence_threshold_secs);
```

**Step 2: 修改音频发送逻辑**

替换原有的音频发送代码（约第 107-119 行）：

```rust
            // Send audio
            Some(pcm_data) = audio_rx.recv() => {
                let base64_audio = encode_pcm_to_base64(&pcm_data);

                // 首次发送携带 VAD 配置
                let message = if config_sent {
                    OutgoingMessage::audio(base64_audio)
                } else {
                    config_sent = true;
                    OutgoingMessage::audio_with_config(base64_audio, &vad_config)
                };

                let json = serde_json::to_string(&message)
                    .map_err(|e| format!("Serialize error: {}", e))?;

                sender
                    .send(WsMessage::Text(json.into()))
                    .await
                    .map_err(|e| format!("Send error: {}", e))?;
            }
```

**Step 3: 添加 use 声明**

在文件顶部的 use 语句中，确保导入 `VadConfig`：

```rust
use crate::transcription::{IncomingMessage, OutgoingMessage, VadConfig};
```

**Step 4: 运行编译验证**

Run: `cd src-tauri && cargo check`

Expected: 编译成功

**Step 5: Commit**

```bash
git add src-tauri/src/session/websocket_task.rs
git commit -m "feat(transcription): send VAD config in first audio message"
```

---

## Task 4: 添加配置测试

**Files:**
- Modify: `src-tauri/src/transcription/types.rs` (测试部分)

**Step 1: 添加 VadConfig 测试**

在 `types.rs` 的 `#[cfg(test)] mod tests` 中添加：

```rust
    #[test]
    fn test_vad_config_default() {
        let config = VadConfig::default();
        assert_eq!(config.vad_threshold, Some(0.55));
        assert_eq!(config.vad_silence_threshold_secs, Some(1.0));
        assert_eq!(config.min_speech_duration_ms, Some(80));
        assert_eq!(config.min_silence_duration_ms, Some(150));
    }

    #[test]
    fn test_outgoing_message_audio_with_config() {
        let config = VadConfig::default();
        let msg = OutgoingMessage::audio_with_config("dGVzdA==".to_string(), &config);

        assert_eq!(msg.message_type, "input_audio_chunk");
        assert_eq!(msg.audio_base_64, Some("dGVzdA==".to_string()));
        assert_eq!(msg.sample_rate, Some(16000));
        assert_eq!(msg.vad_threshold, Some(0.55));
        assert_eq!(msg.vad_silence_threshold_secs, Some(1.0));
        assert_eq!(msg.min_speech_duration_ms, Some(80));
        assert_eq!(msg.min_silence_duration_ms, Some(150));
    }

    #[test]
    fn test_outgoing_message_audio_with_config_serialization() {
        let config = VadConfig::default();
        let msg = OutgoingMessage::audio_with_config("dGVzdA==".to_string(), &config);
        let json = serde_json::to_string(&msg).unwrap();

        assert!(json.contains(r#""message_type":"input_audio_chunk""#));
        assert!(json.contains(r#""audio_base_64":"dGVzdA==""#));
        assert!(json.contains(r#""sample_rate":16000"#));
        assert!(json.contains(r#""vad_threshold":0.55"#));
    }
```

**Step 2: 运行测试**

Run: `cd src-tauri && cargo test transcription::types --lib`

Expected: 所有测试通过，包括新测试

**Step 3: Commit**

```bash
git add src-tauri/src/transcription/types.rs
git commit -m "test(transcription): add tests for VadConfig and audio_with_config"
```

---

## Task 5: 运行完整测试并验证

**Step 1: 运行所有测试**

Run: `cd src-tauri && cargo test`

Expected: 所有测试通过

**Step 2: 运行 clippy 检查**

Run: `cd src-tauri && cargo clippy -- -D warnings`

Expected: 无警告

**Step 3: 构建验证**

Run: `cd src-tauri && cargo build`

Expected: 构建成功

---

## Task 6: 更新设计文档标记完成

**Files:**
- Modify: `docs/plans/2026-03-01-transcription-optimization-design.md`

**Step 1: 在文档末尾添加实施状态**

```markdown
---

## 实施状态

- [x] Task 1: 扩展 OutgoingMessage 添加 VAD 配置字段
- [x] Task 2: 修改 WebSocket 连接添加 language_hints
- [x] Task 3: 修改音频发送逻辑携带 VAD 配置
- [x] Task 4: 添加配置测试
- [x] Task 5: 运行完整测试并验证

**实施完成时间**: 2026-03-01
```

**Step 2: Commit**

```bash
git add docs/plans/2026-03-01-transcription-optimization-design.md
git commit -m "docs: mark transcription optimization as implemented"
```

---

## 验证清单

实施完成后，请验证以下场景：

1. **编译通过**: `cargo build` 无错误
2. **测试通过**: `cargo test` 全部通过
3. **功能验证**:
   - 启动应用，进行语音转录测试
   - 对比优化前后的识别效果
   - 特别关注语速快和环境噪音场景

---

## 参数调优建议

如果效果仍不理想，可调整 `VadConfig::default()` 中的参数：

| 场景 | 参数调整建议 |
|------|-------------|
| 噪音仍导致误识别 | 提高 `vad_threshold` 至 0.6-0.7 |
| 长句被截断 | 降低 `vad_silence_threshold_secs` 至 0.8 |
| 短词被漏识别 | 降低 `min_speech_duration_ms` 至 50 |
| 自然停顿被切断 | 提高 `min_silence_duration_ms` 至 200 |

---

*计划创建于 2026-03-01*
