# Findings & Decisions - RaFlow 项目
<!--
  WHAT: RaFlow 项目的知识库，存储所有发现和决策
  WHY: 上下文窗口有限，此文件作为"外部记忆"持久化存储
  WHEN: 在任何发现后更新，特别是 2 次查看/浏览/搜索操作后（2-Action Rule）
-->

## 需求

基于 `/Users/liufukang/workplace/AI/project/raflow/docs/plans/2026-02-07-raflow-optimized-design.md` 设计文档实现 RaFlow：

### 核心功能需求
- **实时语音转文字**: 使用 ElevenLabs Scribe v2 Realtime API
- **全局快捷键**: Command+Shift+R (macOS) 或 Ctrl+Shift+R (Windows/Linux) 切换录音
- **智能文本注入**: 检测可编辑元素，优先直接注入，否则剪贴板+通知
- **系统托盘**: 常驻后台，提供快捷菜单
- **悬浮窗显示**: 实时显示转录结果（partial 灰色、committed 白色）
- **多语言支持**: 中文、英语、日语、韩语，支持自动检测

### 技术需求
- **后端**: Tauri v2 (Rust)，异步优先 (Tokio)
- **前端**: React 18 (TypeScript + Vite)
- **状态管理**: Zustand
- **动画**: Framer Motion
- **样式**: Tailwind CSS
- **音频**: MVP 阶段使用 tauri-plugin-mic-recorder，第二阶段迁移到 cpal+rubato 自定义管道

### 性能目标
- 端到端延迟: < 200ms
- 音频采集延迟: < 50ms
- 转录延迟: < 150ms
- 内存占用: < 100MB (空闲)
- CPU 占用: < 5% (录音时)

### 阶段划分
1. **MVP 快速验证** (1-2周): 插件方案，验证核心流程
2. **高性能架构迁移** (2-3周): 自定义音频管道，性能监控
3. **生产级优化** (3-4周): 断线重连、可编辑性检测、多语言、权限引导

## 研究发现

### 从设计文档中提取的关键信息

**音频处理架构**:
- MVP 阶段使用 `tauri-plugin-mic-recorder` 快速启动
- 第二阶段迁移到 `cpal` + `rubato` + `ringbuf` 高性能管道
- 音频格式: 16kHz PCM 16-bit
- 重采样: 需要支持任意输入采样率到 16kHz 的转换

**ElevenLabs WebSocket 协议**:
- URL: `wss://api.elevenlabs.io/v1/speech-to-text/realtime?token={api_key}`
- 消息类型:
  - `input_audio_chunk`: 音频数据 (audio_base_64, commit)
  - `partial_transcript`: 实时转录 (text, created_at_ts)
  - `committed_transcript`: 确认转录
  - `session_started`: 会话建立 (session_id, config)
- 配置选项: sample_rate, model_id, vad_threshold, language

**文本注入策略**:
- 主要方法: 模拟 Cmd+V / Ctrl+V 快捷键
- 后备方案: 纯剪贴板 + 系统通知
- 智能恢复: 异步恢复原始剪贴板内容，检测用户新复制操作
- 可编辑性检测: macOS 使用 AXUIElement 检查 kAXSelectedTextRangeAttribute

**系统托盘 (Tauri v2)**:
- 使用 `tray-icon` 功能
- 支持左键显示窗口、菜单项点击
- 菜单项: 开始/停止录音、退出

**全局快捷键**:
- 使用 `tauri-plugin-global-shortcut`
- 配置: Command+Shift+R (toggle_recording 命令)

### 已通过 @context7 研究的领域（截至 2026-02-07）

**Tauri v2 项目初始化**:
- 创建命令: `npm create tauri-app@latest` 或 `npm create tauri-app@2`
- 主配置文件: `tauri.conf.json`（应用标识符、开发服务器 URL、插件配置）
- 插件安装: `npm run tauri add <plugin-name>` 或 `cargo add tauri-plugin-<plugin-name>`

**Tauri v2 插件生态**:
- **全局快捷键**: `tauri-plugin-global-shortcut` - 需要在 capabilities 中配置权限
  - 权限: `global-shortcut:allow-is-registered`, `global-shortcut:allow-register`, `global-shortcut:allow-unregister`
  - 安装: `npm run tauri add global-shortcut` 或 `cargo add tauri-plugin-global-shortcut`
- **剪贴板管理**: `tauri-plugin-clipboard-manager`
  - 安装: `npm run tauri add clipboard-manager` 或 `cargo add tauri-plugin-clipboard-manager`
- **系统托盘**: Tauri v2 内置 `tray-icon` 功能

**ElevenLabs Scribe v2 Realtime API**:
- WebSocket 端点: `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime`
- 认证方式: Header `xi-api-key` 或 Query 参数 `token`
- 查询参数:
  - `model_id`: 模型标识符（如 `scribe_v2_realtime`）
  - `audio_format`: pcm_16000（默认）、pcm_44100、pcm_48000 等
  - `language_code`: 语言代码（如 zh-CN、en-US）
  - `commit_strategy`: manual（默认）或 vad
  - `include_timestamps`: 是否包含单词级时间戳
  - `include_language_detection`: 启用自动语言检测

**消息类型（Client → Server）**:
```json
{
  "message_type": "input_audio_chunk",
  "audio_base_64": "<base64编码的PCM音频数据>",
  "commit": false,
  "sample_rate": 16000
}
```

**消息类型（Server → Client）**:
- `session_started`: 会话建立
- `partial_transcript`: 实时转录（中间结果）
- `committed_transcript`: 确认转录（最终结果）
- `committed_transcript_with_timestamps`: 带时间戳的转录结果
- `input_error`: 错误信息

**音频要求**:
- 格式: PCM（Pulse Code Modulation）
- 采样率: 16 kHz（推荐）
- 声道: Mono（单声道）
- 位深: 16-bit
- 字节序: Little-endian

### 需要进一步研究的领域（使用 @context7 查询）
- [ ] tauri-plugin-mic-recorder 可用性和 API（Tauri v2 可能不直接支持，需要研究替代方案）
- [ ] enigo/arboard 跨平台键盘模拟和剪贴板
- [ ] cpal、rubato、ringbuf 音频处理库
- [ ] macOS Accessibility API 最新用法
- [ ] Framer Motion、Zustand 最新 API

## 技术决策

| 决策 | 理由 |
|------|------|
| **渐进式架构迁移** | MVP 用插件快速验证，避免过度工程；第二阶段迁移到高性能管道，平衡速度与质量 |
| **Tokio 异步任务而非 std::thread** | 避免 Rust 事件循环与 Tauri 冲突，简化并发管理 |
| **剪贴板优先注入策略** | 兼容性最好，可作为可编辑性检测的后备方案，降低失败率 |
| **环形缓冲区 (ringbuf)** | 无锁队列，音频线程直接推入数据避免阻塞 |
| **基于 Histogram 的性能指标** | 简单直方图实现百分位计算 (P50, P99)，足够生产使用 |
| **指数退避重连策略** | 网络故障时避免雪崩，最大退避 30 秒，最多 10 次重试 |
| **测试驱动开发 (TDD)** | 确保代码质量，便于重构，提前发现集成问题，符合最佳实践 |
| **Zustand 而非 Redux** | 轻量级状态管理，TypeScript 友好，适合小型应用 |
| **Framer Motion 动画** | 声明式 API，性能优秀，自带物理弹簧，适合波形可视化 |

## 遇到的问题

| 问题 | 解决方案 |
|------|----------|
| | |

## 资源

### 官方文档
- Tauri v2: https://v2.tauri.app/
- ElevenLabs Scribe v2 Realtime API: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
- React 18: https://react.dev/
- TypeScript: https://www.typescriptlang.org/
- Vite: https://vitejs.dev/
- Tailwind CSS: https://tailwindcss.com/

### Tauri 插件生态
- tauri-plugin-global-shortcut: https://github.com/tauri-apps/plugins-workspace
- tauri-plugin-mic-recorder: https://crates.io/crates/tauri-plugin-mic-recorder
- tauri-plugin-clipboard-manager: 剪贴板管理插件

### Rust 音频处理
- cpal (跨平台音频 I/O): https://docs.rs/cpal/
- rubato (高质量重采样): https://docs.rs/rubato/
- ringbuf (无锁环形缓冲区): https://docs.rs/ringbuf/

### Rust 网络与异步
- tokio-tungstenite (WebSocket): https://docs.rs/tokio-tungstenite/
- tokio (异步运行时): https://tokio.rs/
- serde (序列化): https://serde.rs/

### 参考实现
- Wispr Flow 技术挑战: https://wisprflow.ai/post/technical-challenges
- Tauri v2 System Tray 实现: https://medium.com/@sjobeiri/understanding-the-system-tray-from-concept-to-tauri-v2-implementation-252f278bb57c
- Rust 音频流与环形缓冲区: https://dev.to/drsh4dow/the-joy-of-the-unknown-exploring-audio-streams-with-rust-and-circular-buffers-494d

### 跨平台输入模拟
- enigo (键盘/鼠标模拟): https://github.com/enigo-rs/enigo
- arboard (剪贴板): https://github.com/1Password/arboard

### 前端库
- Framer Motion: https://www.framer.com/motion/
- Zustand: https://zustand-demo.pmnd.rs/

## 视觉/浏览器发现

<!-- 需要在查看图片、PDF 或浏览器结果后更新此部分 -->
<!--
  重要提醒: 2-Action Rule
  每进行 2 次查看/浏览/搜索操作后，必须更新此文件
  这可以防止视觉信息在上下文重置时丢失
-->

---
<!--
  重要提醒: 2-Action Rule
  每进行 2 次查看/浏览/搜索操作后，必须更新此文件
  这可以防止视觉信息在上下文重置时丢失
-->
*每进行 2 次查看/浏览/搜索操作后更新此文件*
*这可以防止视觉信息在上下文重置时丢失*
