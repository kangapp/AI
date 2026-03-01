# 转录识别率优化设计文档

> 针对"语速快"和"环境噪音"场景的识别率优化方案

---

## 1. 问题背景

### 1.1 现象描述
- 部分词语识别成同音字或其他词
- 问题主要发生在：
  - 语速较快时
  - 环境噪音干扰时

### 1.2 当前架构

```
麦克风(48kHz) → Ring Buffer → 重采样(16kHz) → WebSocket → ElevenLabs API
```

当前 WebSocket 连接使用默认参数，未针对中文和噪音场景优化。

---

## 2. 解决方案：API 参数调优

### 2.1 方案选择

选择 **方案 A: API 参数调优**，原因：
1. 投入产出比最高 - 小改动可能解决 70-80% 的问题
2. 零依赖 - 不需要引入新的音频处理库
3. 可快速验证 - 改完后立即测试效果
4. 可渐进增强 - 如果效果不够，再叠加其他方案

### 2.2 核心改动

#### WebSocket 连接参数

当前：
```
wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime
```

新增：
```
wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&language_hints=["zh"]
```

#### 会话配置参数

| 参数 | 默认值 | 新值 | 调整理由 |
|------|--------|------|----------|
| `language_hints` | - | `["zh"]` | 明确告知 API 使用中文，减少同音字误判 |
| `vad_threshold` | 0.4 | 0.55 | 提高语音检测门槛，噪音需更强信号才被识别为语音 |
| `vad_silence_threshold_secs` | 1.5 | 1.0 | 语速快时更快提交分段，避免长句被截断 |
| `min_speech_duration_ms` | 100 | 80 | 允许更短的语音片段，适应快语速 |
| `min_silence_duration_ms` | 100 | 150 | 稍微延长静音判定，避免语速快时的自然停顿被误判为句子结束 |

---

## 3. 改动范围

| 文件 | 改动内容 |
|------|----------|
| `src-tauri/src/transcription/client.rs` | 连接 URL 添加 language_hints 参数 |
| `src-tauri/src/transcription/types.rs` | OutgoingMessage 添加配置字段 |
| `src-tauri/src/session/websocket_task.rs` | 发送音频时携带配置参数 |
| `src-tauri/src/config/mod.rs` | 添加可配置的 VAD 参数（可选） |

---

## 4. 实现细节

### 4.1 修改连接 URL

```rust
// client.rs
let request = Request::builder()
    .uri("wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&language_hints=[\"zh\"]")
    .header("xi-api-key", &self.api_key)
    .body(())?;
```

### 4.2 扩展消息类型

```rust
// types.rs
pub struct OutgoingMessage {
    pub message_type: &'static str,
    pub audio_base_64: Option<String>,
    pub commit: Option<bool>,
    // 新增配置字段
    pub sample_rate: Option<u32>,
    pub vad_threshold: Option<f32>,
    pub vad_silence_threshold_secs: Option<f32>,
    pub min_speech_duration_ms: Option<u32>,
    pub min_silence_duration_ms: Option<u32>,
}
```

### 4.3 首次音频消息携带配置

首次发送音频时，携带 VAD 配置参数，后续消息只发送音频数据。

---

## 5. 可选：用户可配置

通过环境变量允许用户微调：

```bash
RAFLOW_VAD_THRESHOLD=0.55
RAFLOW_VAD_SILENCE_THRESHOLD=1.0
RAFLOW_LANGUAGE_HINTS=zh
```

---

## 6. 验证方法

### 测试场景
1. **正常语速朗读** - 确保不影响基础识别
2. **快语速连续说话** - 验证长句识别改善
3. **有背景噪音环境** - 验证噪音过滤效果

### 预期效果
- 同音字误判减少 50%+
- 快语速长句截断减少
- 噪音导致的乱码减少

---

## 7. 后续优化路径

如果方案 A 效果不足，可考虑：
- **方案 B**: 客户端音频预处理（RNNoise 降噪）
- **方案 C**: 音量归一化 (AGC) + 直接使用 48kHz

---

*文档创建于 2026-03-01*

---

## 实施状态

- [x] Task 1: 扩展 OutgoingMessage 添加 VAD 配置字段
- [x] Task 2: 修改 WebSocket 连接添加 language_hints
- [x] Task 3: 修改音频发送逻辑携带 VAD 配置
- [x] Task 4: 添加配置测试
- [x] Task 5: 运行完整测试并验证

**实施完成时间**: 2026-03-01
