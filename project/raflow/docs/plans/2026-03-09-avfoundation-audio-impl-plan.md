# AVAudioEngine 音频捕获实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 AVAudioEngine 替换 cpal，解决 macOS open 启动时麦克风无声问题

**Architecture:** 创建新的 capture_avaudio.rs 模块，使用 AVAudioEngine API 进行音频捕获，保持与现有 pipeline 的接口兼容

**Tech Stack:** Rust, AVAudioEngine (av-foundation crate), Tauri v2

---

## Task 1: 添加 av-foundation 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: 修改 Cargo.toml**

打开 `src-tauri/Cargo.toml`，找到 cpal 依赖行，添加 av-foundation：

```toml
# 现有依赖
cpal = "0.15"

# 添加新依赖（在 cpal 下方）
av-foundation = "0.2"
```

**Step 2: 运行 cargo fetch 更新依赖**

```bash
cd src-tauri && cargo fetch
```

Expected: 下载 av-foundation crate

**Step 3: 提交**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(audio): add av-foundation dependency for AVAudioEngine"
```

---

## Task 2: 创建 AVAudioEngine 捕获模块

**Files:**
- Create: `src-tauri/src/audio/capture_avaudio.rs`

**Step 1: 创建基础结构**

创建文件 `src-tauri/src/audio/capture_avaudio.rs`：

```rust
//! Audio capture using AVAudioEngine
//!
//! This module provides macOS-specific audio capture using AVAudioEngine,
//! bypassing cpal which has issues with `open` launch.

use av_foundation::AVAudioEngine;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;

/// Audio capture errors
#[derive(Error, Debug)]
pub enum CaptureError {
    /// No input device available
    #[error("No input device available")]
    NoInputDevice,

    /// Microphone permission denied
    #[error("Microphone permission denied")]
    PermissionDenied,

    /// Failed to start audio engine
    #[error("Failed to start audio engine: {0}")]
    EngineStartFailed(String),

    /// Failed to build input stream
    #[error("Failed to build input stream: {0}")]
    StreamBuild(String),
}

/// Audio capture handle
pub struct AudioCapture {
    /// The AVAudioEngine
    engine: AVAudioEngine,
    /// Ring buffer for audio data
    buffer: Arc<Mutex<Vec<f32>>>,
    /// Sample rate
    sample_rate: u32,
    /// Number of channels
    channels: u16,
    /// Flag indicating if capture is active
    is_capturing: Arc<AtomicBool>,
}

impl AudioCapture {
    /// Create a new audio capture
    pub fn new() -> Result<Self, CaptureError> {
        // Request microphone permission
        // Note: AVAudioEngine will prompt automatically on first use
        let engine = AVAudioEngine::new();

        // Get the input node
        let input_node = engine.input_node();

        // Get the input format
        let input_format = input_node.input_format(for_bus: 0);

        if input_format.channel_count == 0 {
            return Err(CaptureError::NoInputDevice);
        }

        let sample_rate = input_format.sample_rate as u32;
        let channels = input_format.channel_count as u16;

        tracing::info!(
            "[CAPTURE] AVAudioEngine initialized: {} channels, {} Hz",
            channels,
            sample_rate
        );

        Ok(Self {
            engine,
            buffer: Arc::new(Mutex::new(Vec::with_capacity(16384))),
            sample_rate,
            channels,
            is_capturing: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get the sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Get the number of channels
    pub fn channels(&self) -> u16 {
        self.channels
    }

    /// Get the buffer for external access
    pub fn buffer(&self) -> Arc<Mutex<Vec<f32>>> {
        self.buffer.clone()
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }

    /// Start capturing audio
    pub fn start(&mut self) -> Result<(), CaptureError> {
        if self.is_capturing() {
            tracing::warn!("Audio capture already in progress");
            return Ok(());
        }

        // Clear buffer
        {
            let mut buf = self.buffer.lock().unwrap();
            buf.clear();
        }

        let buffer = self.buffer.clone();

        // Get input node and format
        let input_node = self.engine.input_node();
        let input_format = input_node.input_format(for_bus: 0);

        // Install tap on input node
        input_node.install_tap(
            on: 0,
            buffer_size: 1024,
            format: input_format,
            callback: move |buffer, _time| {
                // Get the float channel data
                if let Some(channel_data) = buffer.float_channel_data() {
                    let frame_count = buffer.frame_length() as usize;
                    let samples = std::slice::from_raw_parts(
                        channel_data[0],
                        frame_count,
                    );

                    // Write to buffer
                    if let Ok(mut buf) = buffer.lock() {
                        for &sample in samples {
                            buf.push(sample);
                        }
                    }
                }
            },
        );

        // Start the engine
        self.engine.start().map_err(|e| {
            CaptureError::EngineStartFailed(e.to_string())
        })?;

        self.is_capturing.store(true, Ordering::SeqCst);

        tracing::info!("Audio capture started");

        Ok(())
    }

    /// Stop capturing audio
    pub fn stop(&mut self) {
        if !self.is_capturing() {
            return;
        }

        // Remove tap and stop engine
        self.engine.input_node().remove_tap(on: 0);
        self.engine.stop();

        self.is_capturing.store(false, Ordering::SeqCst);

        tracing::info!("Audio capture stopped");
    }

    /// Get the name of the input device
    pub fn device_name(&self) -> String {
        // AVAudioEngine doesn't easily expose device name
        // Return a generic name
        "AVAudioEngine Input".to_string()
    }
}

impl Default for AudioCapture {
    fn default() -> Self {
        Self::new().expect("Failed to initialize default audio capture")
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}
```

**Step 2: 提交**

```bash
git add src-tauri/src/audio/capture_avaudio.rs
git commit -m "feat(audio): create AVAudioEngine capture module"
```

---

## Task 3: 修改 mod.rs 切换实现

**Files:**
- Modify: `src-tauri/src/audio/mod.rs:1-16`

**Step 1: 修改 mod.rs**

替换现有的 capture 模块为 AVAudioEngine 版本：

```rust
//! Audio capture and processing pipeline

#[cfg(target_os = "macos")]
mod capture_avaudio;
#[cfg(not(target_os = "macos"))]
mod capture;
mod pipeline;
mod resampler;

#[cfg(target_os = "macos")]
pub use capture_avaudio::*;
#[cfg(not(target_os = "macos"))]
pub use capture::*;
pub use pipeline::*;
pub use resampler::*;
```

**Step 2: 编译检查**

```bash
cd src-tauri && cargo check
```

Expected: 可能有编译错误，需要根据实际 API 调整

**Step 3: 提交**

```bash
git add src-tauri/src/audio/mod.rs
git commit -m "feat(audio): switch to AVAudioEngine implementation"
```

---

## Task 4: 修复编译错误

**Files:**
- Modify: `src-tauri/src/audio/capture_avaudio.rs`

**Step 1: 检查编译错误**

运行 `cargo check` 查看具体错误，然后逐一修复。可能的问题：
- av-foundation API 与预期不同
- 回调签名不正确
- 类型转换问题

**Step 2: 提交**

```bash
git add src-tauri/src/audio/capture_avaudio.rs
git commit -m "fix(audio): fix AVAudioEngine compilation errors"
```

---

## Task 5: 测试 open 启动

**Files:**
- Build and test

**Step 1: 构建 release 版本**

```bash
cd src-tauri && cargo build --release
```

**Step 2: 测试直接运行**

```bash
./target/release/raflow
```

Expected: 麦克风正常工作

**Step 3: 测试 open 启动**

```bash
open ./target/release/raflow.app
```

Expected: 麦克风正常工作（这是关键测试）

**Step 4: 提交**

```bash
git commit -m "test(audio): verify AVAudioEngine works with open launch"
```

---

## 错误处理选项

如果 Task 4 或 Task 5 遇到问题：

### 选项 A: 调试 AVAudioEngine

- 检查麦克风权限
- 验证音频格式
- 添加更多日志

### 选项 B: 回退到 AudioUnit

如果 AVAudioEngine 也有问题，可以尝试方案 2（使用现有的 capture_avfoundation.rs）

### 选项 C: 寻求帮助

在 task_plan.md 中记录错误，询问用户

---

**Plan complete and saved to `docs/plans/2026-03-09-avfoundation-audio-impl.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
