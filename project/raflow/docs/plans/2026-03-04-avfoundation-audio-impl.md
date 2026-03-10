# AVAudioEngine 音频捕获方案实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 av-foundation crate 直接调用 macOS AVAudioEngine API，绕过 cpal 在 `open` 启动时的麦克风输入为零的问题。

**Architecture:** 创建新的 `AudioCaptureAvfoundation` 实现，保留现有的 cpal 实现作为跨平台备选。在 macOS 上使用条件编译切换到 AVAudioEngine。

**Tech Stack:** Rust, av-foundation crate, AVAudioEngine (macOS)

---

## Task 1: 添加 av-foundation 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: 添加依赖**

在 Cargo.toml 中添加 av-foundation 依赖（仅 macOS）：

```toml
[target.'cfg(target_os = "macos")'.dependencies]
av-foundation = "0.7"
```

**Step 2: 验证依赖可以下载**

Run: `cd src-tauri && cargo fetch`
Expected: 成功下载 av-foundation 及其依赖

**Step 3: 提交**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore(deps): add av-foundation for macOS audio capture"
```

---

## Task 2: 创建 AVAudioEngine 音频捕获实现

**Files:**
- Create: `src-tauri/src/audio/capture_avfoundation.rs`

**Step 1: 写入基础结构**

创建 `src-tauri/src/audio/capture_avfoundation.rs`：

```rust
//! Audio capture using AVAudioEngine for macOS
//!
//! This module provides macOS-specific audio capture using the AVAudioEngine API.
//! It bypasses cpal to avoid issues with `open` application launch.

use av_foundation::AVAudioEngine;
use ringbuf::traits::Producer;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

/// Audio capture errors
#[derive(Error, Debug)]
pub enum CaptureError {
    #[error("No input device available")]
    NoInputDevice,

    #[error("Failed to start audio engine: {0}")]
    EngineStart(String),

    #[error("Failed to install tap: {0}")]
    TapInstall(String),
}

/// Audio capture handle using AVAudioEngine
pub struct AudioCaptureAvfoundation {
    engine: AVAudioEngine,
    is_capturing: Arc<AtomicBool>,
}

impl AudioCaptureAvfoundation {
    /// Create a new audio capture from default input device
    pub fn new() -> Result<Self, CaptureError> {
        let engine = AVAudioEngine::new();
        Ok(Self {
            engine,
            is_capturing: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get the sample rate
    pub fn sample_rate(&self) -> u32 {
        // 44100 is standard for input
        44100
    }

    /// Get the number of channels
    pub fn channels(&self) -> u16 {
        1
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }

    /// Start capturing audio
    pub fn start<P>(&mut self, mut producer: P) -> Result<(), CaptureError>
    where
        P: Producer<Item = f32> + Send + 'static,
    {
        if self.is_capturing() {
            return Ok(());
        }

        let input_node = self.engine.inputNode();
        let format = input_node.input_format(for_bus: 0);

        input_node.install_tap(
            on_bus: 0,
            buffer_size: 1024,
            format: format,
            callback: move |buffer, _| {
                // 从 buffer 读取数据并写入 producer
                let channel_data = buffer.float_channel_data();
                if let Some(data) = channel_data {
                    let frames = buffer.frame_length() as usize;
                    for i in 0..frames {
                        let sample = data[0][i];
                        let _ = producer.try_push(sample);
                    }
                }
            },
        );

        self.engine.start().map_err(|e| CaptureError::EngineStart(e.to_string()))?;

        self.is_capturing.store(true, Ordering::SeqCst);
        Ok(())
    }

    /// Stop capturing audio
    pub fn stop(&mut self) {
        if !self.is_capturing() {
            return;
        }

        self.engine.input_node().remove_tap(on_bus: 0);
        self.engine.stop();
        self.is_capturing.store(false, Ordering::SeqCst);
    }
}

impl Drop for AudioCaptureAvfoundation {
    fn drop(&mut self) {
        self.stop();
    }
}
```

**Step 2: 编译检查**

Run: `cd src-tauri && cargo check`
Expected: 可能有类型错误，需要根据 av-foundation 的实际 API 调整

**Step 3: 根据错误调整代码**

如果编译失败，根据具体错误调整 av-foundation API 的调用方式

**Step 4: 提交**

```bash
git add src-tauri/src/audio/capture_avfoundation.rs
git commit -m "feat(audio): add AVAudioEngine capture implementation"
```

---

## Task 3: 创建平台特定的 AudioCapture 类型

**Files:**
- Modify: `src-tauri/src/audio/mod.rs`

**Step 1: 修改模块入口**

在 `src-tauri/src/audio/mod.rs` 中添加条件编译：

```rust
#[cfg(target_os = "macos")]
mod capture_avfoundation;

#[cfg(target_os = "macos")]
pub use capture_avfoundation::AudioCaptureAvfoundation as AudioCapture;

#[cfg(not(target_os = "macos"))]
mod capture;

#[cfg(not(target_os = "macos"))]
pub use capture::AudioCapture;
```

**Step 2: 检查编译**

Run: `cd src-tauri && cargo check`
Expected: 成功编译

**Step 3: 提交**

```bash
git add src-tauri/src/audio/mod.rs
git commit -m "feat(audio): add platform-specific AudioCapture type"
```

---

## Task 4: 集成到 Pipeline

**Files:**
- Modify: `src-tauri/src/audio/pipeline.rs`

**Step 1: 更新 pipeline 使用新的 AudioCapture**

由于我们已经通过 mod.rs 重新导出了正确的 AudioCapture 类型，pipeline.rs 应该不需要修改。但需要确认：

Run: `cd src-tauri && cargo check`
Expected: 成功编译

如果有问题，根据错误调整

**Step 2: 提交**

```bash
git add src-tauri/src/audio/pipeline.rs
git commit -m "refactor(audio): use platform-specific AudioCapture in pipeline"
```

---

## Task 5: 测试验证

**Files:**
- Test: 运行应用并验证两种启动方式

**Step 1: 构建应用**

Run: `cd /Users/liufukang/workplace/AI/project/raflow && pnpm tauri build`
Expected: 成功构建

**Step 2: 测试直接运行**

Run: `./src-tauri/target/release/RaFlow`
Expected: 麦克风正常工作

**Step 3: 测试 open 启动**

Run: `open /Applications/RaFlow.app`
Expected: 麦克风正常工作（这是我们要修复的问题）

**Step 4: 如果测试失败，调试并修复**

根据实际错误调整实现

**Step 5: 提交**

```bash
git commit -m "fix(audio): use AVAudioEngine for macOS to fix open launch issue"
```

---

## Task 6: 清理调试代码

**Files:**
- Modify: 移除所有调试日志（如果添加了的话）

**Step 1: 移除调试日志**

检查 capture_avfoundation.rs 中是否有调试日志，如有则移除

**Step 2: 最终测试**

确保功能正常

**Step 3: 提交**

```bash
git commit -m "chore: clean up debug logs from AVAudioEngine implementation"
```
