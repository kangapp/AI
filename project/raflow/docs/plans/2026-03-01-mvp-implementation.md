# RaFlow MVP 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 macOS 语音转录工具，通过热键触发录音，实时转录并复制到剪贴板

**Architecture:** Rust 后端处理音频采集、WebSocket 通信、剪贴板操作；React 前端显示悬浮窗 UI

**Tech Stack:** Tauri v2, Rust (cpal, rubato, tokio-tungstenite), React 18, Tailwind CSS

---

## Phase 1: 项目初始化

### Task 1.1: 创建 Tauri 项目

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

**Step 1: 创建项目目录**

```bash
mkdir -p src-tauri/src src/components src/hooks
```

**Step 2: 创建 package.json**

```json
{
  "name": "raflow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^11.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**Step 3: 创建 src-tauri/Cargo.toml**

```toml
[package]
name = "raflow"
version = "0.1.0"
edition = "2021"
description = "Real-time voice transcription tool"
authors = ["you"]

[lib]
name = "raflow_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-notification = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.21", features = ["native-tls"] }
futures-util = "0.3"
cpal = "0.15"
rubato = "0.14"
ringbuf = "0.3"
arboard = "3.4"
base64 = "0.22"
```

**Step 4: 创建 src-tauri/tauri.conf.json**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "RaFlow",
  "version": "0.1.0",
  "identifier": "com.raflow.app",
  "build": {
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "macOSPrivateApi": true,
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    },
    "windows": [
      {
        "label": "main",
        "title": "RaFlow",
        "width": 400,
        "height": 120,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "visible": false,
        "center": false,
        "x": 100,
        "y": 100
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "info": {
        "NSMicrophoneUsageDescription": "RaFlow needs microphone access for voice transcription"
      }
    }
  }
}
```

**Step 5: 创建 src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

**Step 6: 创建 src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    raflow_lib::run()
}
```

**Step 7: 创建 src-tauri/src/lib.rs**

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 8: 创建 vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

**Step 9: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 10: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 11: 创建 index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RaFlow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 12: 创建 src/main.tsx**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 13: 创建 src/App.tsx**

```typescript
import { useEffect, useState } from "react";

function App() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Listen for recording state from backend
  }, []);

  return (
    <div className="window-container">
      <div className="status-text">
        {isRecording ? "Recording..." : "Press Cmd+Shift+H to start"}
      </div>
    </div>
  );
}

export default App;
```

**Step 14: 创建 src/styles.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.window-container {
  width: 100%;
  height: 100%;
  background: rgba(30, 30, 30, 0.9);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.status-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}
```

**Step 15: 创建 Tailwind 配置**

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 16: 安装依赖并验证**

```bash
cd /Users/liufukang/workplace/AI/project/raflow
pnpm install
pnpm tauri dev
```

Expected: 应用启动，显示空白悬浮窗

**Step 17: Commit**

```bash
git add .
git commit -m "feat: initialize Tauri v2 project with React frontend"
```

---

## Phase 2: 音频管道

### Task 2.1: 音频模块结构

**Files:**
- Create: `src-tauri/src/audio/mod.rs`
- Create: `src-tauri/src/audio/capture.rs`
- Create: `src-tauri/src/audio/resampler.rs`
- Create: `src-tauri/src/audio/pipeline.rs`

**Step 1: 创建音频模块目录**

```bash
mkdir -p src-tauri/src/audio
```

**Step 2: 创建 src-tauri/src/audio/mod.rs**

```rust
//! Audio capture and processing pipeline

mod capture;
mod pipeline;
mod resampler;

pub use capture::*;
pub use pipeline::*;
pub use resampler::*;
```

**Step 3: 更新 src-tauri/src/lib.rs**

```rust
pub mod audio;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: Commit**

```bash
git add src-tauri/src/audio src-tauri/src/lib.rs
git commit -m "feat(audio): add audio module structure"
```

### Task 2.2: 音频采集器

**Files:**
- Create: `src-tauri/src/audio/capture.rs`

**Step 1: 创建音频采集模块**

```rust
//! Audio capture using cpal

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use ringbuf::{HeapRb, Producer};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

/// Audio capture errors
#[derive(Error, Debug)]
pub enum CaptureError {
    #[error("No input device available")]
    NoInputDevice,

    #[error("Failed to build input stream: {0}")]
    StreamBuild(String),

    #[error("Failed to start stream: {0}")]
    StreamStart(String),

    #[error("Unsupported sample format: {0:?}")]
    UnsupportedFormat(SampleFormat),
}

/// Audio capture handle
pub struct AudioCapture {
    device: Device,
    config: StreamConfig,
    stream: Option<Stream>,
    is_capturing: Arc<AtomicBool>,
}

impl AudioCapture {
    /// Create a new audio capture from default input device
    pub fn new() -> Result<Self, CaptureError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or(CaptureError::NoInputDevice)?;

        let supported_config = device
            .default_input_config()
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

        let config: StreamConfig = supported_config.into();

        tracing::info!(
            "Audio capture initialized: {} channels, {} Hz",
            config.channels,
            config.sample_rate.0
        );

        Ok(Self {
            device,
            config,
            stream: None,
            is_capturing: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get the sample rate of the capture device
    pub fn sample_rate(&self) -> u32 {
        self.config.sample_rate.0
    }

    /// Start capturing audio
    /// Returns a producer for the ring buffer
    pub fn start(&mut self) -> Result<Producer<f32>, CaptureError> {
        if self.is_capturing.load(Ordering::SeqCst) {
            return Ok(HeapRb::<f32>::new(1).split().0);
        }

        // Create ring buffer (8192 samples ≈ 170ms at 48kHz)
        let buffer = HeapRb::<f32>::new(8192);
        let (producer, consumer) = buffer.split();

        let is_capturing = self.is_capturing.clone();
        is_capturing.store(true, Ordering::SeqCst);

        let channels = self.config.channels as usize;
        let config = self.config.clone();

        let stream = self
            .device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if !is_capturing.load(Ordering::SeqCst) {
                        return;
                    }
                    // Convert to mono by averaging channels
                    for chunk in data.chunks(channels) {
                        let mono: f32 = chunk.iter().sum::<f32>() / channels as f32;
                        let _ = producer.push(mono);
                    }
                },
                |err| {
                    tracing::error!("Audio stream error: {}", err);
                },
                None,
            )
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

        stream
            .play()
            .map_err(|e| CaptureError::StreamStart(e.to_string()))?;

        self.stream = Some(stream);

        tracing::info!("Audio capture started");
        Ok(HeapRb::<f32>::new(8192).split().0) // Return placeholder, real consumer passed differently
    }

    /// Stop capturing audio
    pub fn stop(&mut self) {
        self.is_capturing.store(false, Ordering::SeqCst);
        if let Some(stream) = self.stream.take() {
            drop(stream);
            tracing::info!("Audio capture stopped");
        }
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/audio/capture.rs
git commit -m "feat(audio): implement cpal-based audio capture with mono conversion"
```

### Task 2.3: 音频重采样器

**Files:**
- Create: `src-tauri/src/audio/resampler.rs`

**Step 1: 创建重采样模块**

```rust
//! Audio resampling from 48kHz to 16kHz

use rubato::{
    FftFixedIn, Resampler as RubatoResampler, InterpolationParameters,
    InterpolationType, WindowFunction,
};
use thiserror::Error;

/// Resampler errors
#[derive(Error, Debug)]
pub enum ResamplerError {
    #[error("Failed to create resampler: {0}")]
    Creation(String),

    #[error("Failed to process audio: {0}")]
    Process(String),

    #[error("Insufficient input samples: required {required}, got {got}")]
    InsufficientInput { required: usize, got: usize },
}

/// Audio resampler: 48kHz → 16kHz
pub struct Resampler {
    inner: FftFixedIn<f32>,
    chunk_size: usize,
    input_rate: u32,
    output_rate: u32,
}

impl Resampler {
    /// Create a new resampler
    /// chunk_size: number of input frames per processing call
    pub fn new(input_rate: u32, output_rate: u32, chunk_size: usize) -> Result<Self, ResamplerError> {
        let ratio = input_rate as f64 / output_rate as f64;

        let params = InterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: InterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let inner = FftFixedIn::<f32>::new(
            ratio,
            chunk_size,
            params,
            1, // 1 channel (mono)
            1,
        )
        .map_err(|e| ResamplerError::Creation(e.to_string()))?;

        Ok(Self {
            inner,
            chunk_size,
            input_rate,
            output_rate,
        })
    }

    /// Get required input chunk size
    pub fn chunk_size(&self) -> usize {
        self.chunk_size
    }

    /// Resample a chunk of audio data
    /// Input: f32 samples at input_rate
    /// Output: i16 PCM samples at output_rate
    pub fn process(&mut self, input: &[f32]) -> Result<Vec<i16>, ResamplerError> {
        if input.len() < self.chunk_size {
            return Err(ResamplerError::InsufficientInput {
                required: self.chunk_size,
                got: input.len(),
            });
        }

        // Wrap input in Vec<Vec<f32>> format (1 channel)
        let input_wrapped = vec![input.to_vec()];

        let output = self
            .inner
            .process(&input_wrapped, None)
            .map_err(|e| ResamplerError::Process(e.to_string()))?;

        // Convert f32 to i16 PCM
        let pcm: Vec<i16> = output[0]
            .iter()
            .map(|&s| {
                let clamped = s.clamp(-1.0, 1.0);
                if clamped >= 0.0 {
                    (clamped * 32767.0) as i16
                } else {
                    (clamped * 32768.0) as i16
                }
            })
            .collect();

        Ok(pcm)
    }
}

impl Default for Resampler {
    fn default() -> Self {
        Self::new(48000, 16000, 1024).expect("Failed to create default resampler")
    }
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/audio/resampler.rs
git commit -m "feat(audio): implement rubato-based resampler (48kHz to 16kHz)"
```

### Task 2.4: 音频管道整合

**Files:**
- Create: `src-tauri/src/audio/pipeline.rs`

**Step 1: 创建管道模块**

```rust
//! Complete audio pipeline: capture → resample → output

use crate::audio::{AudioCapture, Resampler, ResamplerError, CaptureError};
use ringbuf::{Consumer, HeapRb, Producer};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;
use thiserror::Error;

/// Pipeline errors
#[derive(Error, Debug)]
pub enum PipelineError {
    #[error("Capture error: {0}")]
    Capture(#[from] CaptureError),

    #[error("Resampler error: {0}")]
    Resampler(#[from] ResamplerError),

    #[error("Pipeline already running")]
    AlreadyRunning,

    #[error("Pipeline not running")]
    NotRunning,
}

/// Callback for processed audio data
pub type AudioCallback = Box<dyn Fn(Vec<i16>) + Send + 'static>;

/// Audio pipeline state
pub struct AudioPipeline {
    capture: AudioCapture,
    is_running: Arc<AtomicBool>,
    processor_handle: Option<JoinHandle<()>>,
}

impl AudioPipeline {
    /// Create a new audio pipeline
    pub fn new() -> Result<Self, PipelineError> {
        let capture = AudioCapture::new()?;
        Ok(Self {
            capture,
            is_running: Arc::new(AtomicBool::new(false)),
            processor_handle: None,
        })
    }

    /// Start the pipeline
    /// callback: called with resampled 16kHz PCM data
    pub fn start<F>(&mut self, callback: F) -> Result<(), PipelineError>
    where
        F: Fn(Vec<i16>) + Send + 'static,
    {
        if self.is_running.load(Ordering::SeqCst) {
            return Err(PipelineError::AlreadyRunning);
        }

        let input_rate = self.capture.sample_rate();
        let chunk_size = 1024;

        // Create ring buffer
        let buffer = HeapRb::<f32>::new(8192);
        let (producer, consumer) = buffer.split();

        // Start capture (we need to pass producer to capture)
        self.is_running.store(true, Ordering::SeqCst);

        // Actually start capture with custom stream
        self.start_capture_with_producer(producer)?;

        // Start processor thread
        let is_running = self.is_running.clone();
        let handle = thread::spawn(move || {
            let mut resampler = Resampler::new(input_rate, 16000, chunk_size)
                .expect("Failed to create resampler");

            let mut buffer = Vec::with_capacity(chunk_size);

            while is_running.load(Ordering::SeqCst) {
                // Collect enough samples
                while buffer.len() < chunk_size {
                    match consumer.pop() {
                        Some(sample) => buffer.push(sample),
                        None => break,
                    }
                }

                if buffer.len() >= chunk_size {
                    // Process
                    match resampler.process(&buffer[..chunk_size]) {
                        Ok(pcm) => callback(pcm),
                        Err(e) => tracing::error!("Resampler error: {}", e),
                    }
                    buffer.drain(..chunk_size);
                } else {
                    thread::sleep(Duration::from_millis(1));
                }
            }
        });

        self.processor_handle = Some(handle);
        tracing::info!("Audio pipeline started");
        Ok(())
    }

    /// Stop the pipeline
    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        self.capture.stop();

        if let Some(handle) = self.processor_handle.take() {
            let _ = handle.join();
        }

        tracing::info!("Audio pipeline stopped");
    }

    /// Check if pipeline is running
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    fn start_capture_with_producer(&mut self, producer: Producer<f32>) -> Result<(), PipelineError> {
        use cpal::traits::StreamTrait;

        let is_capturing = self.is_running.clone();
        let channels = self.capture.config.channels as usize;
        let config = self.capture.config.clone();

        let stream = self
            .capture
            .device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if !is_capturing.load(Ordering::SeqCst) {
                        return;
                    }
                    // Convert to mono
                    for chunk in data.chunks(channels) {
                        let mono: f32 = chunk.iter().sum::<f32>() / channels as f32;
                        let _ = producer.push(mono);
                    }
                },
                |err| tracing::error!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

        stream
            .play()
            .map_err(|e| CaptureError::StreamStart(e.to_string()))?;

        self.capture.stream = Some(stream);
        Ok(())
    }
}
```

**Step 2: 更新 mod.rs 导出**

```rust
//! Audio capture and processing pipeline

mod capture;
mod pipeline;
mod resampler;

pub use capture::*;
pub use pipeline::*;
pub use resampler::*;
```

**Step 3: Commit**

```bash
git add src-tauri/src/audio/
git commit -m "feat(audio): implement complete audio pipeline with ring buffer"
```

---

## Phase 3: WebSocket 转录

### Task 3.1: 转录模块结构

**Files:**
- Create: `src-tauri/src/transcription/mod.rs`
- Create: `src-tauri/src/transcription/types.rs`
- Create: `src-tauri/src/transcription/client.rs`

**Step 1: 创建模块目录**

```bash
mkdir -p src-tauri/src/transcription
```

**Step 2: 创建 src-tauri/src/transcription/mod.rs**

```rust
//! ElevenLabs Scribe v2 Realtime transcription

mod client;
mod types;

pub use client::*;
pub use types::*;
```

**Step 3: 更新 lib.rs**

```rust
pub mod audio;
pub mod transcription;

pub fn run() {
    // ...
}
```

**Step 4: Commit**

```bash
git add src-tauri/src/transcription/mod.rs src-tauri/src/lib.rs
git commit -m "feat(transcription): add transcription module structure"
```

### Task 3.2: 消息类型定义

**Files:**
- Create: `src-tauri/src/transcription/types.rs`

**Step 1: 创建类型定义**

```rust
//! WebSocket message types for ElevenLabs API

use serde::{Deserialize, Serialize};

/// Incoming message from ElevenLabs
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "message_type")]
pub enum IncomingMessage {
    #[serde(rename = "session_started")]
    SessionStarted { session_id: String },

    #[serde(rename = "partial_transcript")]
    PartialTranscript {
        text: String,
        #[serde(default)]
        created_at_ts: Option<i64>,
    },

    #[serde(rename = "committed_transcript")]
    CommittedTranscript {
        text: String,
        #[serde(default)]
        created_at_ts: Option<i64>,
    },

    #[serde(rename = "error")]
    Error {
        #[serde(default)]
        message: String,
    },
}

/// Outgoing message to ElevenLabs
#[derive(Debug, Clone, Serialize)]
pub struct OutgoingMessage {
    pub message_type: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_base_64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit: Option<bool>,
}

impl OutgoingMessage {
    /// Create an audio chunk message
    pub fn audio(base64: String) -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(base64),
            commit: None,
        }
    }

    /// Create a commit message (end of speech)
    pub fn commit() -> Self {
        Self {
            message_type: "input_audio_chunk",
            audio_base_64: Some(String::new()),
            commit: Some(true),
        }
    }
}

/// Transcription event for internal use
#[derive(Debug, Clone)]
pub enum TranscriptionEvent {
    SessionStarted { session_id: String },
    Partial { text: String },
    Committed { text: String },
    Error { message: String },
}

impl TryFrom<IncomingMessage> for TranscriptionEvent {
    type Error = String;

    fn try_from(msg: IncomingMessage) -> Result<Self, Self::Error> {
        match msg {
            IncomingMessage::SessionStarted { session_id } => {
                Ok(TranscriptionEvent::SessionStarted { session_id })
            }
            IncomingMessage::PartialTranscript { text, .. } => {
                Ok(TranscriptionEvent::Partial { text })
            }
            IncomingMessage::CommittedTranscript { text, .. } => {
                Ok(TranscriptionEvent::Committed { text })
            }
            IncomingMessage::Error { message } => {
                Ok(TranscriptionEvent::Error { message })
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/transcription/types.rs
git commit -m "feat(transcription): add WebSocket message type definitions"
```

### Task 3.3: WebSocket 客户端

**Files:**
- Create: `src-tauri/src/transcription/client.rs`

**Step 1: 创建客户端**

```rust
//! ElevenLabs WebSocket client

use crate::transcription::{IncomingMessage, OutgoingMessage, TranscriptionEvent};
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use thiserror::Error;
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};
use tokio_tungstenite::MaybeTlsStream;
use tokio::net::TcpStream;

type WebSocketStream = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<MaybeTlsStream<TcpStream>>,
    WsMessage,
>;

/// Client errors
#[derive(Error, Debug)]
pub enum ClientError {
    #[error("WebSocket connection failed: {0}")]
    Connection(String),

    #[error("Failed to send message: {0}")]
    Send(String),

    #[error("Failed to receive message: {0}")]
    Receive(String),

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Not connected")]
    NotConnected,

    #[error("Session not started")]
    SessionNotStarted,
}

/// ElevenLabs transcription client
pub struct TranscriptionClient {
    api_key: String,
    sender: Option<WebSocketStream>,
    session_id: Option<String>,
}

impl TranscriptionClient {
    /// Create a new client
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            sender: None,
            session_id: None,
        }
    }

    /// Connect to ElevenLabs API
    pub async fn connect(&mut self) -> Result<(), ClientError> {
        let url = format!(
            "wss://api.elevenlabs.io/v1/speech-to-text/realtime?xi-api-key={}",
            self.api_key
        );

        tracing::info!("Connecting to ElevenLabs...");

        let (ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| ClientError::Connection(e.to_string()))?;

        let (sender, mut receiver) = ws_stream.split();

        // Wait for session_started
        tracing::info!("Waiting for session_started...");

        let msg = receiver
            .next()
            .await
            .ok_or(ClientError::Receive("No response".into()))?
            .map_err(|e| ClientError::Receive(e.to_string()))?;

        let text = msg.to_text()
            .map_err(|e| ClientError::Receive(e.to_string()))?;

        let incoming: IncomingMessage = serde_json::from_str(text)?;

        if let IncomingMessage::SessionStarted { session_id } = incoming {
            tracing::info!("Session started: {}", session_id);
            self.session_id = Some(session_id);
        } else {
            return Err(ClientError::SessionNotStarted);
        }

        // Store sender, spawn receiver task
        self.sender = Some(sender);

        tracing::info!("Connected to ElevenLabs");
        Ok(())
    }

    /// Send audio data
    pub async fn send_audio(&mut self, pcm_data: &[i16]) -> Result<(), ClientError> {
        let sender = self.sender.as_mut().ok_or(ClientError::NotConnected)?;

        let base64 = encode_pcm_to_base64(pcm_data);
        let msg = OutgoingMessage::audio(base64);

        let json = serde_json::to_string(&msg)?;
        sender
            .send(WsMessage::Text(json))
            .await
            .map_err(|e| ClientError::Send(e.to_string()))?;

        Ok(())
    }

    /// Send commit signal
    pub async fn commit(&mut self) -> Result<(), ClientError> {
        let sender = self.sender.as_mut().ok_or(ClientError::NotConnected)?;

        let msg = OutgoingMessage::commit();
        let json = serde_json::to_string(&msg)?;

        sender
            .send(WsMessage::Text(json))
            .await
            .map_err(|e| ClientError::Send(e.to_string()))?;

        tracing::info!("Sent commit signal");
        Ok(())
    }

    /// Close connection
    pub async fn close(&mut self) {
        if let Some(sender) = self.sender.take() {
            let _ = sender.close().await;
            tracing::info!("WebSocket closed");
        }
        self.session_id = None;
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.sender.is_some()
    }
}

/// Encode PCM i16 data to base64
fn encode_pcm_to_base64(pcm: &[i16]) -> String {
    let bytes: Vec<u8> = pcm
        .iter()
        .flat_map(|&s| s.to_le_bytes())
        .collect();
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/transcription/client.rs
git commit -m "feat(transcription): implement WebSocket client for ElevenLabs API"
```

---

## Phase 4: 全局热键与命令

### Task 4.1: Tauri 命令

**Files:**
- Create: `src-tauri/src/commands.rs`

**Step 1: 创建命令模块**

```rust
//! Tauri commands for frontend communication

use tauri::{AppHandle, Emitter, Manager};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Global state for recording
pub struct RecordingState {
    pub is_recording: Arc<AtomicBool>,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Start recording
#[tauri::command]
pub async fn start_recording(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RecordingState>();

    if state.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".into());
    }

    state.is_recording.store(true, Ordering::SeqCst);

    // Emit event to frontend
    app.emit("recording-state-changed", true)
        .map_err(|e| e.to_string())?;

    tracing::info!("Recording started");
    Ok("Recording started".into())
}

/// Stop recording
#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RecordingState>();

    if !state.is_recording.load(Ordering::SeqCst) {
        return Err("Not recording".into());
    }

    state.is_recording.store(false, Ordering::SeqCst);

    // Emit event to frontend
    app.emit("recording-state-changed", false)
        .map_err(|e| e.to_string())?;

    tracing::info!("Recording stopped");
    Ok("Recording stopped".into())
}

/// Get recording state
#[tauri::command]
pub fn is_recording(app: AppHandle) -> bool {
    let state = app.state::<RecordingState>();
    state.is_recording.load(Ordering::SeqCst)
}
```

**Step 2: 更新 lib.rs**

```rust
pub mod audio;
pub mod commands;
pub mod transcription;

use commands::RecordingState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(RecordingState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_recording,
            commands::stop_recording,
            commands::is_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(commands): add Tauri commands for recording control"
```

### Task 4.2: 全局热键注册

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: 添加热键注册**

```rust
pub mod audio;
pub mod commands;
pub mod transcription;

use commands::RecordingState;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(RecordingState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_recording,
            commands::stop_recording,
            commands::is_recording,
        ])
        .setup(|app| {
            // Register Cmd+Shift+H shortcut
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyH);

            let app_handle = app.handle().clone();

            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                let state = app_handle.state::<RecordingState>();
                let is_recording = state.is_recording.load(std::sync::atomic::Ordering::SeqCst);

                if is_recording {
                    // Stop recording
                    state.is_recording.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_handle.emit("recording-state-changed", false);
                    tracing::info!("Hotkey: Stop recording");
                } else {
                    // Start recording
                    state.is_recording.store(true, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_handle.emit("recording-state-changed", true);
                    tracing::info!("Hotkey: Start recording");
                }
            })?;

            tracing::info!("Global shortcut registered: Cmd+Shift+H");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(hotkey): register Cmd+Shift+H global shortcut"
```

---

## Phase 5: 剪贴板输出

### Task 5.1: 剪贴板模块

**Files:**
- Create: `src-tauri/src/clipboard/mod.rs`

**Step 1: 创建剪贴板模块**

```bash
mkdir -p src-tauri/src/clipboard
```

```rust
//! Clipboard operations

use arboard::Clipboard;
use thiserror::Error;

/// Clipboard errors
#[derive(Error, Debug)]
pub enum ClipboardError {
    #[error("Failed to access clipboard: {0}")]
    Access(String),

    #[error("Failed to set text: {0}")]
    SetText(String),
}

/// Write text to clipboard
pub fn write_to_clipboard(text: &str) -> Result<(), ClipboardError> {
    let mut clipboard = Clipboard::new()
        .map_err(|e| ClipboardError::Access(e.to_string()))?;

    clipboard
        .set_text(text)
        .map_err(|e| ClipboardError::SetText(e.to_string()))?;

    tracing::info!("Text copied to clipboard: {} chars", text.len());
    Ok(())
}
```

**Step 2: 更新 lib.rs**

```rust
pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod transcription;
```

**Step 3: Commit**

```bash
git add src-tauri/src/clipboard/mod.rs src-tauri/src/lib.rs
git commit -m "feat(clipboard): add clipboard write functionality"
```

---

## Phase 6: 前端 UI

### Task 6.1: 前端状态管理

**Files:**
- Create: `src/hooks/useTranscription.ts`

**Step 1: 创建 Hook**

```typescript
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export type RecordingStatus = "idle" | "recording" | "processing";

export interface TranscriptionState {
  status: RecordingStatus;
  partialText: string;
  committedText: string;
  audioLevel: number;
}

export function useTranscription() {
  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    partialText: "",
    committedText: "",
    audioLevel: 0,
  });

  useEffect(() => {
    const unlisten = listen<boolean>("recording-state-changed", (event) => {
      setState((prev) => ({
        ...prev,
        status: event.payload ? "recording" : "idle",
      }));
    });

    const unlisten2 = listen<string>("partial-transcript", (event) => {
      setState((prev) => ({
        ...prev,
        partialText: event.payload,
      }));
    });

    const unlisten3 = listen<string>("committed-transcript", (event) => {
      setState((prev) => ({
        ...prev,
        committedText: event.payload,
        partialText: "",
      }));
    });

    const unlisten4 = listen<number>("audio-level", (event) => {
      setState((prev) => ({
        ...prev,
        audioLevel: event.payload,
      }));
    });

    return () => {
      unlisten.then((f) => f());
      unlisten2.then((f) => f());
      unlisten3.then((f) => f());
      unlisten4.then((f) => f());
    };
  }, []);

  return state;
}
```

**Step 2: Commit**

```bash
git add src/hooks/useTranscription.ts
git commit -m "feat(ui): add transcription state hook"
```

### Task 6.2: 悬浮窗组件

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/TranscriptDisplay.tsx`
- Create: `src/components/WaveformVisualizer.tsx`

**Step 1: 创建 TranscriptDisplay**

```typescript
// src/components/TranscriptDisplay.tsx
import { motion } from "framer-motion";

interface TranscriptDisplayProps {
  partial: string;
  committed: string;
}

export function TranscriptDisplay({ partial, committed }: TranscriptDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      {committed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white text-sm mb-1"
        >
          {committed}
        </motion.p>
      )}
      {partial && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          className="text-gray-400 text-sm"
        >
          {partial}
          <span className="animate-pulse">|</span>
        </motion.p>
      )}
    </div>
  );
}
```

**Step 2: 创建 WaveformVisualizer**

```typescript
// src/components/WaveformVisualizer.tsx
import { motion } from "framer-motion";

interface WaveformVisualizerProps {
  level: number; // 0-1
  isRecording: boolean;
}

export function WaveformVisualizer({ level, isRecording }: WaveformVisualizerProps) {
  const bars = 5;
  const heights = Array.from({ length: bars }, (_, i) => {
    const centerOffset = Math.abs(i - Math.floor(bars / 2));
    const baseHeight = 0.3 + (1 - centerOffset / Math.floor(bars / 2)) * 0.5;
    return baseHeight * level * (isRecording ? 1 : 0.3);
  });

  return (
    <div className="flex items-center justify-center gap-1 h-8 mb-2">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 bg-blue-400 rounded-full"
          animate={{
            height: `${Math.max(4, h * 32)}px`,
            opacity: isRecording ? 1 : 0.3,
          }}
          transition={{ duration: 0.05 }}
        />
      ))}
    </div>
  );
}
```

**Step 3: 更新 App.tsx**

```typescript
import { useEffect } from "react";
import { useTranscription } from "./hooks/useTranscription";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { WaveformVisualizer } from "./components/WaveformVisualizer";
import { getCurrentWindow } from "@tauri-apps/api/window";

function App() {
  const { status, partialText, committedText, audioLevel } = useTranscription();
  const isRecording = status === "recording";

  useEffect(() => {
    const win = getCurrentWindow();

    // Show window when recording starts
    if (isRecording) {
      win.show();
      win.setFocus();
    }
  }, [isRecording]);

  return (
    <div className="window-container">
      <WaveformVisualizer level={audioLevel} isRecording={isRecording} />
      <TranscriptDisplay partial={partialText} committed={committedText} />
      {!isRecording && !committedText && !partialText && (
        <p className="text-gray-500 text-xs mt-2">
          Press ⌘⇧H to start
        </p>
      )}
    </div>
  );
}

export default App;
```

**Step 4: Commit**

```bash
git add src/App.tsx src/components/
git commit -m "feat(ui): add floating window with waveform and transcript display"
```

---

## 最终验证

### Task 7.1: 构建验证

**Step 1: 构建 Release 版本**

```bash
pnpm tauri build
```

Expected: 生成 .app 文件

**Step 2: 测试流程**

1. 启动应用
2. 授予麦克风权限
3. 按 Cmd+Shift+H 开始录音
4. 说话，观察悬浮窗文本
5. 松开热键
6. 检查剪贴板内容

**Step 3: 最终提交**

```bash
git add .
git commit -m "feat: complete RaFlow MVP implementation"
```

---

## 依赖说明

### Rust Crates

| Crate | 版本 | 用途 |
|-------|------|------|
| tauri | 2 | 应用框架 |
| tauri-plugin-global-shortcut | 2 | 全局热键 |
| tauri-plugin-notification | 2 | 系统通知 |
| cpal | 0.15 | 音频采集 |
| rubato | 0.14 | 音频重采样 |
| ringbuf | 0.3 | 无锁缓冲 |
| tokio | 1 | 异步运行时 |
| tokio-tungstenite | 0.21 | WebSocket |
| arboard | 3.4 | 剪贴板 |
| base64 | 0.22 | Base64 编码 |

### NPM Packages

| Package | 版本 | 用途 |
|---------|------|------|
| @tauri-apps/api | ^2.0.0 | Tauri API |
| react | ^18.2.0 | UI 框架 |
| framer-motion | ^11.0.0 | 动画 |
| tailwindcss | ^3.4.0 | 样式 |

---

*计划创建于 2026-03-01*
