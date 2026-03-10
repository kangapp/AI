# 进度日志 - RaFlow

> 记录会话活动、测试结果、文件变更

---

## 会话记录

### 2026-03-10 - Phase 18 CoreAudio 调试 🔄

**调试结果**:

| 实现 | 启动方式 | 麦克风 | 结果 |
|------|----------|--------|------|
| cpal | 直接运行 | iPhone | ✅ 正常 |
| cpal | open 启动 | iPhone | ❌ 返回 0 |
| CoreAudio (AudioUnit) | 直接运行 | iPhone | ❌ 回调不工作 |
| CoreAudio (AudioUnit) | open 启动 | iPhone | ❌ 回调不工作 |

**关键发现**:
- CoreAudio AudioOutputUnitStart 返回 0（成功）
- 回调函数 `renderCallback` 从未被调用
- 这与 cpal 的问题完全相同，不是 cpal 特有的问题

**结论**: macOS 音频子系统的限制，可能需要 Apple 开发者签名才能解决

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/Cargo.toml` | 添加 av-foundation = "0.2" |
| `src-tauri/src/audio/capture_avaudio.rs` | 新建 CoreAudio AudioUnit 实现 |
| `src-tauri/src/audio/mod.rs` | 切换到 capture_avaudio 模块 |

---

### 2026-03-09 - Phase 17 麦克风调试总结 🔄

**调试结果总结**:

| 启动方式 | 麦克风 | 结果 |
|----------|--------|------|
| 直接运行 `./raflow` | iPhone 麦克风 | ✅ 正常 |
| 直接运行 `./raflow` | MacBook Pro 麦克风 | ❌ 返回 0 |
| `open` 启动 | iPhone 麦克风 | ❌ 返回 0 |
| `open` 启动 | MacBook Pro 麦克风 | ❌ 返回 0 |

**尝试的解决方案**:
1. cpal 初始化延迟 (500ms + 1000ms + 2000ms) - 无效
2. 重试逻辑 (5次，每次 200ms) - 无效
3. 预初始化音频系统 - 无效（回调仍然返回 0）
4. wake-up 音频设备 - 无效
5. 签名 (adhoc) - 无效
6. TCC 权限请求 - 无效（手动添加仍无法解决）

**结论**: cpal + macOS `open` 启动问题是已知问题，直接运行模式下 iPhone 麦克风可正常工作。

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/audio/capture.rs` | 添加 wake_up_audio_device 函数，添加 system_profiler 调用 |
| `src-tauri/src/audio/pipeline.rs` | 在 start() 中调用 wake_up_audio_device |
| `src-tauri/tauri.conf.json` | 添加 signingIdentity: "-" |
| `src-tauri/entitlements.plist` | 已配置麦克风权限 |

---

### 2026-03-09 - Phase 17.18-19 麦克风调试 🔄

**调试结果总结**:

| 启动方式 | 麦克风 | 结果 |
|----------|--------|------|
| 直接运行 `./raflow` | iPhone 麦克风 | ✅ 正常 |
| 直接运行 `./raflow` | MacBook Pro 麦克风 | ❌ 返回 0 |
| `open` 启动 | iPhone 麦克风 | ❌ 返回 0 |
| `open` 启动 | MacBook Pro 麦克风 | ❌ 返回 0 |

**尝试的解决方案**:
1. cpal 初始化延迟 (500ms + 1000ms + 2000ms) - 无效
2. 重试逻辑 (5次，每次 200ms) - 无效
3. 预初始化音频系统 - 无效（回调仍然返回 0）
4. 使用系统默认设备而非强制选择 - 直接运行能工作

**结论**: cpal + macOS `open` 启动问题是已知问题，直接运行模式下 iPhone 麦克风可正常工作。

---

### 2026-03-09 - Phase 17 最终方案测试 🔄

**目标**: 验证 cpal + 1000ms 延迟方案是否解决 `open` 启动时麦克风无声问题

**当前实现**:
- 在 `capture.rs` 的 `start()` 方法中，`play()` 后添加 1000ms 延迟
- 保留 `[CAPTURE-CB]` 调试日志用于验证

**待验证**:
- 打包后应用程序通过 `open` 启动是否正常录音

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/audio/capture.rs` | play() 后添加 1000ms 延迟 |

---

### 2026-03-05 - Phase 17.13 原生 CoreAudio API 实现 🔄

**目标**: 使用原生 CoreAudio API (AudioUnit) 实现音频捕获，绕过 cpal 的问题

**实现方案**:
- 使用 `coreaudio-sys` crate 直接调用 CoreAudio API
- 创建自定义 AudioBuffer 类用于线程安全的数据传递
- 使用 AudioUnit HAL Output 组件进行音频捕获

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/audio/capture_avfoundation.rs` | 完全重写，使用原生 CoreAudio API |
| `src-tauri/src/audio/pipeline.rs` | 修改为使用 capture.buffer() 获取音频数据 |
| `src-tauri/Cargo.toml` | 添加 coreaudio-sys 依赖 |
| `src-tauri/src/audio/mod.rs` | 条件编译 macOS 使用新实现 |

**构建结果**: ✅ 成功

**测试状态**: 待测试

**说明**: 这是最新实现，使用原生 CoreAudio API。cpal 方案已确认在 `open` 启动时返回零数据。

---

### 2026-03-05 - Phase 17.12 cpal 调试确认 🔄

**日志证据**:
```
[CAPTURE-CB] samples=512, max=0.000000, sum=0.000000
```
回调被调用（512 样本），但所有数据为 0。

**结论**: cpal CoreAudio 后端无法工作，需要原生 API。

**目标**: 使用 AVAudioEngine 重写音频捕获模块，绕过 cpal 的问题

**尝试的方案**:

| 方案 | 结果 |
|------|------|
| objc2-avf-audio crate | ❌ 没有暴露 install_tap API |
| av-foundation crate | ❌ 是 AVCaptureSession，不是 AVAudioEngine |
| coreaudio-rs | ❌ 是 Audio Unit，不是音频捕获 |
| coreaudio-sys | ⚠️ 可用但需要大量 unsafe 代码 + ringbuf 集成复杂 |
| cpal + 增强重试 | ✅ 当前使用方案 |

**当前实现**:
- 修改 `mod.rs` 使 macOS 使用 `capture_avfoundation.rs`
- 在 `capture_avfoundation.rs` 中使用 cpal
- 增加重试次数（5次）和延迟（200ms）
- 添加启动后 50ms 延迟让音频开始流动

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/audio/mod.rs` | 修复条件编译，macOS 使用 AVAudioEngine |
| `src-tauri/src/audio/capture_avfoundation.rs` | 重写使用 cpal + 更多重试逻辑 |
| `src-tauri/Cargo.toml` | 添加 coreaudio-sys 依赖 |

**构建结果**: ✅ 成功

**说明**: cpal 在 `open` 启动时返回零音频数据的问题仍然存在，当前使用增强的重试逻辑作为临时解决方案。原生 CoreAudio API 实现需要更复杂的 ringbuf 集成工作。

---

### 2026-03-04 晚 - Phase 17 根因确认：cpal CoreAudio 问题 🔄

**发现**: 麦克风权限已确认，但 cpal 仍然返回零音频数据

**调试结果**:
1. 权限已确认 - 系统偏好设置中 RaFlow 有麦克风权限
2. 设备选择正确 - 优先选择 MacBook Pro 麦克风
3. 配置正确 - 支持 44100Hz/48000Hz/88200Hz/96000Hz，默认 44100Hz
4. **根因确认**: cpal 的 CoreAudio 实现与 `open` 启动方式不兼容

**日志证据**:
```
[CAPTURE] Using input device: MacBook Pro麦克风
[CAPTURE] Supported config: 1ch, 44100-44100Hz, F32
[CAPTURE] Default config: 1ch, 44100Hz, F32
[CAPTURE-CB] samples=512, max=0.000000, sum=0.000000  ← 音频数据全为 0
```

**下一步**: 使用 AVAudioEngine 重写音频捕获模块

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/audio/capture.rs` | 添加设备选择逻辑 + 配置日志 |

---

### 2026-03-04 下午 - Phase 17 根本原因发现 🔄 (待验证)

**发现**: 麦克风权限未授权！

**调试过程**:
1. 添加调试日志到 cpal 捕获回调
2. 使用 Console.app 检查日志
3. **发现根因**: 应用没有麦克风权限！

**验证**:
- 直接运行 `./RaFlow` 时可能有不同的权限上下文
- 打包后的 `RaFlow.app` 需要在系统偏好设置中手动授权

**解决方案**:
- 用户需要在 **系统偏好设置 → 隐私与安全 → 麦克风** 中添加 RaFlow
- entitlements.plist 和 tauri.conf.json 已正确配置

**待验证**:
- 用户授权后测试 `open /Applications/RaFlow.app` 启动是否正常

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/audio/capture.rs` | 添加重试逻辑 + 调试日志 |
| `src-tauri/tauri.conf.json` | 版本 0.2.4 → 0.2.5 |

---

### 2026-03-04 - Phase 17 macOS 麦克风输入调试 🔄

**问题**: cpal 在 `open` 启动时麦克风输入全是 0

**调试过程**:
1. 发现 Phase 16 修复后，直接运行正常但 `open` 启动时音频数据全是 0
2. 对比测试：
   | 启动方式 | 麦克风输入 |
   |----------|-----------|
   | 直接运行 `./RaFlow` | ✅ 正常 (rms=0.017) |
   | `open /Applications/RaFlow.app` | ❌ 全是 0 |

3. 尝试的解决方案：
   | 方案 | 结果 |
   |------ | 96000|------|
   Hz (默认) | ❌ 返回 0 |
   | 48000 Hz | ❌ 返回 0 |
   | 44100 Hz | ❌ 返回 0 |
   | Buffer: Default | ❌ 返回 0 |
   | Buffer: Fixed(1024) | ❌ 返回 0 |
   | CWD 修正 | ❌ 无效 |

**根本原因**: cpal + macOS `open` 启动的已知问题

**当前状态**: 需要重写音频模块使用 AVAudioEngine

**待办**:
- 重写 `src-tauri/src/audio/capture.rs` 使用 macOS AVAudioEngine
- 清理调试代码

---

### 2026-03-03 下午 - Phase 16 macOS 打包事件系统调试 ✅

**目标**: 修复 `open` 启动时波形图不响应音频的问题

**问题分析**:
| 启动方式 | 心跳事件 | audio-level 事件 | 波形图 |
|----------|----------|-------------------|--------|
| 直接运行 `./RaFlow` | ✅ 正常 | ✅ 正常 | ✅ 响应 |
| `open` 启动 | ❌ 不工作 | ❌ 不工作 | ❌ 无响应 |
| 开发模式 | ✅ 正常 | ✅ 正常 | ✅ 响应 |

**调试过程**:
1. 添加心跳事件 (`heartbeat`) 测试事件系统 → 发现 `open` 启动时整个事件系统不工作
2. 添加热键事件 (`hotkey-triggered`) → 热键可以触发
3. 添加音频线程事件 → 音频线程不启动
4. **关键发现**: 使用 `emit_to("main", ...)` 在打包后不可靠

**根本原因**:
- Tauri v2 的 `emit_to("main", ...)` 在 macOS 打包后通过 `open` 启动时无法将事件传递到 webview
- 改用全局 `emit()` 方法可以解决问题

**解决方案**:
```rust
// 修改前
app_handle.emit_to("main", "audio-level", rms)

// 修改后 (全局 emit)
app_handle.emit("audio-level", rms)
```

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/session/recording.rs` | 改用全局 `emit()` |
| `src-tauri/src/lib.rs` | 添加心跳定时器调试 |
| `src/hooks/useTranscription.ts` | 使用全局 `listen()` 替代 `webview.listen()` |
| 版本号 | 0.2.4 → 0.2.5 |

**验证结果**:
| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 | ✅ 通过 |
| Rust 编译 | ✅ 通过 |
| 打包 | ✅ 成功 |
| `open` 启动后心跳 | ✅ 正常 |
| `open` 启动后热键 | ✅ 正常 |
| `open` 启动后音频线程 | ✅ 正常 |
| `open` 启动后波形图 | ✅ 响应音频 |

**待办**: 移除调试代码，还原干净版本

---

### 2026-03-03 - Phase 16 早期 修复打包后 audio-level 事件不工作 ✅

**目标**: 修复打包后波形图不响应音频的问题

**问题分析**:
| 模式 | audio-level 事件 | 波形图 |
|------|------------------|--------|
| 开发模式 (`pnpm tauri dev`) | ✅ 正常 | ✅ 响应音频 |
| 打包后 (dmg) | ❌ 不工作 | ❌ 不变化 |

**根本原因** (经过系统性调试):
1. **高频 emit 问题**: 在 `std::thread` 音频回调中高频发送事件，打包后可能不稳定
2. **事件监听方式**: `listen()` + `{ target: { kind: "Any" } }` 组合在打包后不可靠

**解决方案**:
| 层面 | 修改前 | 修改后 |
|------|--------|--------|
| **Rust 发送** | 音频回调中直接 `emit()` | 独立 timer 线程 + `emit_to("main", ...)` |
| **发送频率** | 每个音频 chunk (~50/s) | 每 50ms 一次 (20 FPS) |
| **前端监听** | `listen()` + `Any` | `getCurrentWebviewWindow().listen()` |

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/session/recording.rs` | 添加独立 timer 线程发送 audio-level 事件 |
| `src/hooks/useTranscription.ts` | 使用 `webview.listen()` 替代 `listen()` |
| 版本号 | 0.2.3 → 0.2.4 |

**验证结果**:
| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 | ✅ 通过 |
| Rust 编译 | ✅ 通过 |
| 打包 | ✅ 成功 |
| 手动测试 (release) | ✅ level 值有变化 |

---

### 2026-03-02 深夜 - Phase 15 波形图修复 ✅

**目标**: 修复波形图在 connecting 状态下不响应音频的问题

**问题分析**:
- WebSocket 连接需要 2-5 秒
- 期间状态是 "connecting"（橙色）
- 波形图显示静态波浪动画，不响应音频电平
- 用户感知为"波形图不变化"

**解决方案**:
| 状态 | 修复前 | 修复后 |
|------|--------|--------|
| connecting | 静态波浪动画 | 响应音频电平 + 橙色发光 |
| recording | 响应音频电平 | 不变 |
| processing | 静态波浪动画 | 不变 |

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src/components/WaveformVisualizer.tsx` | connecting 状态响应音频，添加状态发光颜色 |
| `src/hooks/useTranscription.ts` | 移除调试日志 |
| `src-tauri/src/session/recording.rs` | 移除调试日志 |
| `src-tauri/src/session/websocket_task.rs` | 移除调试日志 |

**验证结果**:
| 检查项 | 结果 |
|--------|------|
| TypeScript 类型检查 | ✅ 通过 |
| Rust 代码检查 | ✅ 通过 |
| 波形图 connecting 状态响应音频 | ✅ 正常 |

---

### 2026-03-01 深夜 - Phase 14 图标优化 ✅

**目标**: 修复托盘图标全蓝问题，创建专业的麦克风图标

**问题分析**:
- 原托盘图标是全蓝色方块
- 应用图标也需要更新为更专业的麦克风图案

**解决方案**:

| 图标类型 | 尺寸 | 描述 |
|----------|------|------|
| 应用图标 | 512x512 | 蓝色圆角背景 + 白色麦克风 |
| 托盘图标 | 16x16 | 黑色麦克风剪影 (模板) |
| 托盘图标 @2x | 32x32 | 黑色麦克风剪影 (Retina) |

**创建流程**:
1. 创建麦克风 SVG 源图标 (microphone.svg)
2. 使用 `pnpm tauri icon` 生成多平台图标
3. 使用 ImageMagick 创建托盘模板图标

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/icons/microphone.svg` | 新增 SVG 源图标 |
| `src-tauri/icons/icon.png` | 更新为蓝色+麦克风 |
| `src-tauri/icons/icon.icns` | macOS 应用图标 |
| `src-tauri/icons/icon.ico` | Windows 应用图标 |
| `src-tauri/icons/trayTemplate.png` | 托盘模板图标 (16x16) |
| `src-tauri/icons/trayTemplate@2x.png` | 托盘模板图标 (32x32) |
| `src-tauri/tauri.conf.json` | 配置托盘图标路径 |

**验证结果**:
| 检查项 | 结果 |
|--------|------|
| 应用启动 | ✅ 正常 |
| 托盘图标显示 | ✅ 黑色麦克风剪影 |

---

### 2026-03-01 晚 - Phase 13 长句显示优化 ✅

**目标**: 解决长句显示不全和滚动问题

**问题分析**:
- 长句被截断无法完整显示
- 滚动到底部会回弹
- 实时转录不会自动滚动

**解决方案**:

| 问题 | 解决方案 |
|------|----------|
| 窗口太小 | 增加到 440×180px |
| 长句截断 | `overflow-wrap: anywhere` + 自动换行 |
| 弹性滚动 | `overscroll-behavior: none` |
| 不自动滚动 | 移除用户滚动检测，每次更新都滚动 |
| 底部截断 | 添加 `pb-4` 底部留白 |

**提交**: `db1bdfc feat(ui): Apple 风格 UI 重设计 + 长句显示优化`

---

### 2026-03-01 晚 - Phase 12 Apple 风格 UI 重设计 ✅

**目标**: 将 UI 改造为 Apple 设计风格

**设计特点**:
- SF Pro 字体风格 (-apple-system)
- Apple 系统颜色 (Blue #007AFF, Orange #FF9500, Purple #AF52DE, Red #FF3B30)
- 毛玻璃效果 (blur 50px + saturate 180%)
- 16-18px 大圆角
- 精致阴影和边框

**状态颜色**:
| 状态 | 颜色 | 用途 |
|------|------|------|
| idle | Gray | 空闲 |
| connecting | Orange | 连接中 |
| recording | Blue | 录音中 |
| processing | Purple | 处理中 |
| error | Red | 错误 |

---

### 2026-03-01 晚 - Phase 11 Bug 修复 ✅

**目标**: 修复会话恢复后发现的 bug

| Bug | 原因 | 解决方案 |
|-----|------|----------|
| 错误信息不显示 | WebSocket 失败时未发送事件 | 添加 transcription-error 事件 |
| invalid uri character | URL 中的 `["zh"]` 未编码 | 改为 `%5B%22zh%22%5D` |

---

### 2026-03-01 - Phase 10 转录识别率优化 ✅

**VAD 参数优化**:
| 参数 | 默认值 | 新值 | 调整理由 |
|------|--------|------|----------|
| `language_hints` | - | `["zh"]` | 明确中文优先 |
| `vad_threshold` | 0.4 | 0.55 | 提高检测门槛过滤噪音 |
| `vad_silence_threshold_secs` | 1.5 | 1.0 | 语速快时更快提交 |
| `min_speech_duration_ms` | 100 | 80 | 适应快语速短音节 |
| `min_silence_duration_ms` | 100 | 150 | 避免自然停顿被切断 |

---

### 2026-03-01 - Phase 9 UI/UX 优化 ✅

**目标**: 优化应用显示 UI/UX
- 频谱柱状图 (20 条动态柱)
- 状态切换动画
- 打字机效果 + 滚动动画

---

### 2026-03-01 - Phase 8 端到端集成 ✅

**活动**: 创建 session 模块，实现录音状态机，WebSocket 双向通信

**架构**:
```
src-tauri/src/session/
├── mod.rs              # 模块入口
├── recording.rs        # RecordingSession 状态机
└── websocket_task.rs   # WebSocket 双向通信
```

---

### 2026-03-01 - Phase 1-7 MVP 核心 ✅

- Phase 1: 项目初始化
- Phase 2: 音频管道 (cpal + rubato)
- Phase 3: WebSocket 转录 (tokio-tungstenite)
- Phase 4: 全局热键 (Cmd+Shift+H)
- Phase 5: 剪贴板输出 (arboard)
- Phase 6: 前端 UI (React + Framer Motion)
- Phase 7: 验证测试

---

## 测试结果

| 日期 | 测试项 | 结果 |
|------|--------|------|
| 2026-03-01 | cargo test | ✅ 43 passed |
| 2026-03-01 | cargo clippy | ✅ 无警告 |
| 2026-03-01 | npx tsc --noEmit | ✅ 通过 |
| 2026-03-01 | pnpm build | ✅ 通过 |

---

## ✅ MVP 功能验证

- ✅ 全局热键 (Cmd+Shift+H) 正常触发
- ✅ WebSocket 连接成功
- ✅ 实时转录功能正常
- ✅ 剪贴板输出功能正常
- ✅ Apple 风格 UI 显示
- ✅ 长句自动换行和滚动
- ✅ 专业麦克风图标
