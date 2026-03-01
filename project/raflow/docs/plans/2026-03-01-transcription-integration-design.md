# 设计文档: 语音转录端到端集成

> 日期: 2026-03-01
> 状态: 已批准

---

## 1. 概述

### 1.1 目标

将现有独立模块串联成完整的语音转录流程：

```
热键触发 → 音频采集 → WebSocket 转录 → 结果显示 → 剪贴板输出
```

### 1.2 背景

各模块已实现但未集成：
- ✅ 音频采集 (cpal + ringbuf)
- ✅ 音频重采样 (rubato 48→16kHz)
- ✅ WebSocket 客户端 (tokio-tungstenite)
- ✅ 剪贴板模块 (arboard)
- ✅ 配置模块 (dotenv)
- ❌ 端到端流程串联

---

## 2. 架构设计

### 2.1 方案选择

采用 **状态机模式** (方案 A)，理由：
- 架构简单，状态清晰
- 易于调试和测试
- 资源管理可控

### 2.2 核心结构

```rust
// src-tauri/src/session/mod.rs
pub struct RecordingSession {
    state: Arc<SessionState>,
    audio_pipeline: Option<AudioPipeline>,
    ws_client: Option<TranscriptionClient>,
    app_handle: AppHandle,
}

pub struct SessionState {
    is_active: AtomicBool,
    api_key: String,
}
```

### 2.3 模块关系

```
commands.rs
    │
    ▼
RecordingSession (状态机)
    │
    ├─► AudioPipeline (音频采集 + 重采样)
    │       │
    │       └─► 回调: PCM 数据 → WebSocket
    │
    ├─► TranscriptionClient (WebSocket)
    │       │
    │       ├─► send_audio (发送音频)
    │       └─► 接收任务: emit 事件到前端
    │
    └─► Clipboard (剪贴板输出)
```

---

## 3. 生命周期

### 3.1 启动流程 (start)

```
start_recording()
    │
    ├─ 1. 检查 API Key (config::get_api_key)
    │      └─ 缺失 → 返回错误
    │
    ├─ 2. 连接 WebSocket
    │      └─ TranscriptionClient::connect()
    │
    ├─ 3. 启动音频管道
    │      └─ AudioPipeline::start(callback)
    │          └─ 回调: ws_client.send_audio(pcm)
    │
    ├─ 4. 启动接收任务 (tokio::spawn)
    │      └─ 循环接收 WebSocket 消息
    │          ├─ partial_transcript → emit 到前端
    │          └─ committed_transcript → 保存 + emit
    │
    └─ 5. emit("recording-state-changed", true)
```

### 3.2 停止流程 (stop)

```
stop_recording()
    │
    ├─ 1. 发送 commit
    │      └─ TranscriptionClient::commit()
    │
    ├─ 2. 等待最终结果 (5秒超时)
    │      └─ 接收 committed_transcript
    │
    ├─ 3. 停止音频管道
    │      └─ AudioPipeline::stop()
    │
    ├─ 4. 关闭 WebSocket
    │      └─ TranscriptionClient::close()
    │
    ├─ 5. 复制到剪贴板
    │      └─ clipboard::write_to_clipboard(text)
    │
    └─ 6. emit("recording-state-changed", false)
```

---

## 4. 事件流

### 4.1 后端 → 前端事件

| 事件名 | 数据 | 用途 |
|--------|------|------|
| `recording-state-changed` | `bool` | 显示/隐藏录音窗口 |
| `partial-transcript` | `string` | 实时更新 (灰色文本) |
| `committed-transcript` | `string` | 最终结果 (白色文本) |
| `audio-level` | `number` | 波形可视化 |

### 4.2 前端监听

前端 `useTranscription.ts` 已实现事件监听，无需修改。

---

## 5. 错误处理

### 5.1 错误场景

| 场景 | 处理 | 用户反馈 |
|------|------|----------|
| API Key 缺失 | 返回错误 | 前端提示配置 |
| WebSocket 连接失败 | 重试 3 次 | 通知用户检查网络 |
| 音频采集失败 | 停止会话 | 通知用户检查麦克风权限 |
| 超时无响应 | 5 秒超时 | 通知用户重试 |

### 5.2 错误类型

```rust
#[derive(Error, Debug)]
pub enum SessionError {
    #[error("API key not configured")]
    ApiKeyMissing,

    #[error("WebSocket connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Audio capture failed: {0}")]
    AudioCaptureFailed(String),

    #[error("Operation timed out")]
    Timeout,
}
```

---

## 6. 文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src-tauri/src/session/mod.rs` | 新建 | RecordingSession 状态机 |
| `src-tauri/src/lib.rs` | 修改 | 管理 SessionState |
| `src-tauri/src/commands.rs` | 修改 | 调用 RecordingSession |
| `src-tauri/src/audio/pipeline.rs` | 修改 | 添加 stop 方法 |
| `task_plan.md` | 更新 | 添加 Phase 8 任务 |

---

## 7. 测试策略

### 7.1 单元测试

- `RecordingSession::start()` 状态转换
- `RecordingSession::stop()` 资源清理
- 错误处理路径

### 7.2 集成测试

- 端到端流程 (mock WebSocket)
- 超时处理
- 并发安全

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| WebSocket 延迟 | 用户体验差 | 显示连接状态 |
| 音频缓冲溢出 | 数据丢失 | 使用足够大的 ringbuf |
| 状态不一致 | 功能异常 | 原子操作 + 状态检查 |
