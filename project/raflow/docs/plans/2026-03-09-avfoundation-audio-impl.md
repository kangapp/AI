# AVAudioEngine 音频捕获实现设计

> 日期: 2026-03-09
> 目标: 使用 AVAudioEngine 替换 cpal，解决 macOS open 启动时麦克风无声问题

## 1. 架构

```
[AVAudioEngine] -> [Ring Buffer] -> [Processor Thread] -> [Callback]
  (48kHz)                          (Resample to 16kHz)
```

**与现有架构完全一致**，只是替换底层捕获实现。

## 2. 模块结构

创建新文件: `src-tauri/src/audio/capture_avaudio.rs`

```rust
// 核心类型
pub struct AudioCapture {
    engine: AVAudioEngine,
    input_node: AVAudioInputNode,
    buffer: Arc<Mutex<Vec<f32>>>,  // 与 cpal 版本一致
    sample_rate: u32,
    channels: u16,
    is_capturing: AtomicBool,
}
```

## 3. 公开接口（保持不变）

```rust
impl AudioCapture {
    pub fn new() -> Result<Self, CaptureError>  // 请求麦克风权限
    pub fn sample_rate(&self) -> u32
    pub fn channels(&self) -> u16
    pub fn buffer(&self) -> Arc<Mutex<Vec<f32>>>
    pub fn is_capturing(&self) -> bool
    pub fn start(&mut self) -> Result<(), CaptureError>
    pub fn stop(&mut self)
    pub fn device_name(&self) -> String
}
```

## 4. 关键实现细节

### 4.1 麦克风权限请求

使用 `AVAudioApplication` (macOS 14+) 或 `AVAudioSession` (旧版) 请求麦克风权限。

### 4.2 音频格式

```swift
// 使用 48kHz Float32，与 cpal 默认一致
let format = AVAudioFormat(standardFormatWithSampleRate: 48000)!
```

### 4.3 回调处理

```rust
input_node.installTap(onFormat: format, bufferSize: 1024) { buffer, time in
    // 将 AVAudioPCMBuffer 转换为 Vec<f32>
    // 写入 ring buffer
}
```

## 5. 错误处理

### CaptureError 枚举扩展

```rust
#[derive(Error, Debug)]
pub enum CaptureError {
    // ... 现有错误 ...

    #[error("Microphone permission denied")]
    PermissionDenied,

    #[error("Audio engine failed to start: {0}")]
    EngineStartFailed(String),
}
```

### 错误弹窗

通过 Tauri 命令触发前端弹窗：
```rust
#[tauri::command]
fn show_permission_error() {
    // 发送事件到前端，显示错误弹窗
}
```

## 6. 依赖变更

```toml
# Cargo.toml
# 移除 cpal（不再需要）
# cpal = "0.15"  # 删除

# 添加 av-foundation
av-foundation = "0.2"  # macOS only
```

## 7. mod.rs 修改

```rust
// src-tauri/src/audio/mod.rs
#[cfg(target_os = "macos")]
mod capture_avaudio;  // 新增 AVAudioEngine 实现

#[cfg(target_os = "macos")]
pub use capture_avaudio::*;  // 替换 cpal 实现
```

## 8. 测试计划

| 启动方式 | 麦克风 | 预期结果 |
|----------|--------|----------|
| 直接运行 | iPhone | ✅ 正常 |
| 直接运行 | MacBook | ✅ 正常 |
| open 启动 | iPhone | ✅ 正常 |
| open 启动 | MacBook | ✅ 正常 |
