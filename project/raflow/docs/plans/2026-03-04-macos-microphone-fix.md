# macOS 麦克风音频捕获修复计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 cpal 在 macOS 上麦克风输入为零的问题，尝试多种方案直到找到可行的解决方案。

**Architecture:** 依次尝试：(1) cpal 强制使用特定配置 (2) 直接使用 CoreAudio API 绕过 cpal (3) 使用 AVAudioEngine 完整重写

**Tech Stack:** Rust, cpal, objc2, CoreAudio, AVFoundation (macOS)

---

## 问题分析

根据调试日志：
- cpal 已正确选择 MacBook Pro 麦克风
- 音频回调正常触发，samples=512
- 但所有音频数据全是 0 (max=0.000000, sum=0.000000)

**根因**: macOS CoreAudio 麦克风输入未正确激活，可能与 sandbox 或启动方式相关。

---

## Task 1: 尝试强制使用非默认采样率

**Files:**
- Modify: `src-tauri/src/audio/capture.rs:120-180`

**Step 1: 修改 try_new 函数，尝试强制使用 44100Hz**

当前代码已选择正确设备，但采样率可能不对。尝试显式配置：

```rust
fn try_new() -> Result<Self, CaptureError> {
    let host = cpal::default_host();
    tracing::info!("[CAPTURE] Using host: {:?}", host.id());

    // 列出所有设备并选择合适的
    let mut selected_device = None;

    if let Ok(devices) = host.input_devices() {
        let devices = devices.collect::<Vec<_>>();
        tracing::info!("[CAPTURE] Available input devices: {:?}", devices.len());
        for (i, device) in devices.iter().enumerate() {
            if let Ok(name) = device.name() {
                tracing::info!("[CAPTURE] Device {}: {}", i, name);
                // 优先选择 MacBook 内置麦克风
                if name.contains("MacBook") || (name.contains("内置") && name.contains("麦克风")) {
                    if selected_device.is_none() {
                        selected_device = Some(device.clone());
                        tracing::info!("[CAPTURE] Selected device: {}", name);
                    }
                }
            }
        }
    }

    let device = if let Some(dev) = selected_device {
        dev
    } else {
        tracing::warn!("[CAPTURE] Falling back to default input device");
        host.default_input_device().ok_or(CaptureError::NoInputDevice)?
    };

    let device_name = device.name().unwrap_or_else(|_| "unknown".to_string());
    tracing::info!("[CAPTURE] Using input device: {}", device_name);

    // [NEW] 尝试获取所有支持的配置，选择一个固定的配置
    let supported_configs = device.supported_input_configs()
        .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

    let mut selected_config = None;
    let target_sample_rate = cpal::SampleRate(44100);

    for config in supported_configs {
        tracing::info!("[CAPTURE] Supported config: {:?}", config);
        // 优先选择 44100Hz, 1 channel, f32
        if config.sample_rate() == target_sample_rate
            && config.channels() == 1
            && config.sample_format() == cpal::SampleFormat::F32 {
            selected_config = Some(config.clone());
            break;
        }
    }

    // 如果没有精确匹配，使用默认配置
    let config = if let Some(cfg) = selected_config {
        cfg
    } else {
        device.default_input_config()
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?
    };

    tracing::info!("[CAPTURE] Selected config: {:?}", config);

    let stream_config: StreamConfig = config.clone().into();

    tracing::info!(
        "Audio capture initialized: {} channels, {} Hz, format: {:?}",
        stream_config.channels,
        stream_config.sample_rate.0,
        config.sample_format()
    );

    Ok(Self {
        device,
        config: stream_config,
        stream: None,
        is_capturing: Arc::new(AtomicBool::new(false)),
    })
}
```

**Step 2: 编译检查**

Run: `cd src-tauri && cargo check`
Expected: 编译通过

**Step 3: 打包测试**

Run: `pnpm tauri build`
Expected: 成功打包

**Step 4: 安装测试**

```bash
rm -rf /Applications/RaFlow.app
cp -r src-tauri/target/release/bundle/macos/RaFlow.app /Applications/
open /Applications/RaFlow.app
# 按 Cmd+Shift+H 触发录音
tail -20 /tmp/raflow.log | grep "CAPTURE-CB"
```

Expected: 看到 max > 0.000000

---

## Task 2: 使用 CoreAudio 直接创建输入流 (如果 Task 1 无效)

**Files:**
- Modify: `src-tauri/src/audio/capture.rs`
- Add: `src-tauri/src/audio/coreaudio_raw.rs` (可选)

**方案**: 完全绕过 cpal，使用原始 CoreAudio API

由于实现复杂，先尝试 Task 1，如果无效再详细设计 Task 2。

---

## Task 3: 完整重写为 AVAudioEngine (最后方案)

**Files:**
- Modify: `src-tauri/src/audio/mod.rs`
- Enhance: `src-tauri/src/audio/capture_avfoundation.rs`

这是最后方案，需要完整实现 AVAudioEngine 捕获。

---

## 验证步骤

每次修改后：

```bash
# 1. 编译
cd src-tauri && cargo check

# 2. 打包
pnpm tauri build

# 3. 安装
rm -rf /Applications/RaFlow.app
cp -r src-tauri/target/release/bundle/macos/RaFlow.app /Applications/

# 4. 测试
open /Applications/RaFlow.app
# 按 Cmd+Shift+H

# 5. 检查日志
tail -50 /tmp/raflow.log | grep -E "CAPTURE-CB|samples"
```

期望：
```
[CAPTURE-CB] samples=512, max=0.001xxx  (非零)
```

当前（有问题）：
```
[CAPTURE-CB] samples=512, max=0.000000, sum=0.000000
```
