# 任务规划 - RaFlow 语音交互工具

> 基于 Tauri v2 与 ElevenLabs Scribe v2 Realtime API 的实时语音转录工具

---

## 项目概述

**目标**: 构建类似 Wispr Flow 的 macOS 语音听写工具 (MVP)

**MVP 功能**:
- 全局热键触发录音 (Cmd+Shift+H)
- 实时语音转文字 (<150ms 延迟)
- 转录文本自动复制到剪贴板
- Apple 风格悬浮窗显示转录状态

**技术栈**: Tauri v2 + Rust + React + ElevenLabs Scribe v2

---

## 阶段路线图

### Phase 1-7: MVP 核心 ✅
- [x] 项目初始化、音频管道、WebSocket 转录、热键、剪贴板、前端 UI、验证

### Phase 8: 端到端集成 ✅
- [x] Session 模块、WebSocket 双向通信、状态机、事件发送

### Phase 9: UI/UX 优化 ✅
- [x] 频谱柱状图、状态动画、打字机效果

### Phase 10: 转录识别率优化 ✅
- [x] VAD 配置、language_hints=[zh]

### Phase 11: Bug 修复 ✅
- [x] 11.1 修复错误事件发送到前端
- [x] 11.2 修复 URL 编码问题 (language_hints=%5B%22zh%22%5D)

### Phase 12: Apple 风格 UI 重设计 ✅
- [x] 12.1 SF Pro 字体风格
- [x] 12.2 Apple 系统颜色 (Blue/Orange/Purple/Red)
- [x] 12.3 毛玻璃效果 + 精致阴影
- [x] 12.4 状态指示器动画
- [x] 12.5 Apple 风格波形可视化

### Phase 13: 长句显示优化 ✅
- [x] 13.1 增加窗口尺寸 (440×180px)
- [x] 13.2 文本自动换行和溢出处理
- [x] 13.3 滚动容器支持
- [x] 13.4 禁用 macOS 弹性滚动
- [x] 13.5 实时转录自动滚动到底部
- [x] 13.6 底部留白确保文字完整显示

### Phase 14: 图标优化 ✅
- [x] 14.1 创建麦克风 SVG 源图标
- [x] 14.2 使用 Tauri CLI 生成多平台图标
- [x] 14.3 创建 macOS 托盘模板图标 (trayTemplate.png)
- [x] 14.4 配置 iconAsTemplate: true

### Phase 15: 波形图修复 ✅
- [x] 15.1 修复 connecting 状态下波形图不响应音频的问题
- [x] 15.2 添加状态相关的发光效果颜色
- [x] 15.3 清理调试日志

### Phase 16: macOS 打包事件系统调试 ✅
- [x] 16.1 问题定位：打包后 `open` 启动波形图无响应
- [x] 16.2 根因分析：Tauri v2 事件系统在打包后行为差异
- [x] 16.3 解决方案：将 `emit_to("main", ...)` 改为全局 `emit()`
- [x] 16.4 调试基础设施：添加心跳、热键、音频线程事件
- [x] 16.5 验证通过：所有事件正常触发

### Phase 18: AVAudioEngine/CoreAudio 替换 cpal ✅
- [x] 18.1 设计方案确认
- [x] 18.2 添加 av-foundation 依赖
- [x] 18.3 创建 capture_avaudio.rs 模块 (使用 CoreAudio AudioUnit)
- [x] 18.4 修改 mod.rs 切换实现
- [x] 18.5 编译检查通过
- [x] 18.6 测试结果：**回调未被调用** - 与 cpal 问题相同

### Phase 17: macOS 麦克风输入调试 🔄
- [x] 17.1 问题定位：cpal 在 `open` 启动时麦克风输入全是 0
- [x] 17.2 对比测试：直接运行正常，`open` 启动异常
- [x] 17.3 采样率测试：96000Hz → 48000Hz → 44100Hz 均无效
- [x] 17.4 Buffer size 测试：Default → Fixed(1024) 均无效
- [x] 17.5 根因探索：cpal + macOS `open` 启动的已知问题
- [x] 17.6 尝试升级 cpal 0.15 → 0.17：失败（链接私有 API 错误）
- [x] 17.7 尝试重试逻辑：未完全解决问题
- [x] 17.8 ~~麦克风权限未授权~~：权限已确认，但仍无效
- [x] 17.9 设备选择逻辑：优先选择 MacBook 内置麦克风
- [x] 17.10 配置日志：添加支持的配置输出
- [x] 17.11 **问题根因确认**：cpal CoreAudio 实现本身的问题
- [x] 17.12 尝试方案：使用 AVAudioEngine/cpal 重写音频捕获
- [x] 17.13 实现原生 CoreAudio API (AudioUnit) 音频捕获
- [x] 17.14 修复 CoreAudio 崩溃问题（修复了内存分配问题）
- [x] 17.15 验证原生 CoreAudio 回调是否被正确调用 - **回调未被调用**
- [x] 17.16 解决 cpal + macOS open 启动问题（添加初始化延迟）
- [x] 17.17 延迟测试：1000ms → 2000ms 均无效
- [x] 17.18 预初始化音频系统：无效
- [x] 17.19 wake-up 音频设备：仍然返回 0
- [x] 17.20 签名 (adhoc)：无效
- [x] 17.21 TCC 权限请求：手动添加仍无效
- [x] 17.22 **最终结论**：直接运行模式正常，`open` 启动是 cpal 已知限制

---

## 当前焦点

**阶段**: Phase 17/18 - macOS 麦克风输入调试 🔄
**状态**:
| 启动方式 | cpal | CoreAudio (AudioUnit) |
|----------|------|----------------------|
| 直接运行 | iPhone 正常 | 回调不工作 |
| open 启动 | 返回 0 | 回调不工作 |

**调试结论**:
- AudioOutputUnitStart 返回 0（成功）
- 回调函数从未被调用
- 这不是 cpal 的问题，而是 macOS 音频子系统的更深层次问题

**可能的解决方案**:
1. Apple 开发者签名（需要付费账号）
2. 接受限制，文档说明需用终端运行

---

## 错误日志

| 时间 | 错误描述 | 解决方案 | 状态 |
|------|----------|----------|------|
| 2026-03-01 | 快捷键触发但 UI 无响应 | 添加 Tauri v2 capabilities 权限配置 | ✅ |
| 2026-03-01 | 热键回调中 tokio::spawn panic | 改用 tauri::async_runtime::spawn | ✅ |
| 2026-03-01 | API 返回 auth_error 解析失败 | 添加 AuthError 消息类型支持 | ✅ |
| 2026-03-01 | WebSocket 认证失败 | 使用 HTTP Header `xi-api-key` | ✅ |
| 2026-03-01 | invalid uri character | URL 编码 language_hints 参数 | ✅ |
| 2026-03-01 | 错误信息不显示 | 添加 transcription-error 事件发送 | ✅ |
| 2026-03-01 | 长句显示不全 | 增加窗口高度 + 滚动容器 | ✅ |
| 2026-03-01 | 滚动回弹导致显示不全 | 禁用弹性滚动 + 底部留白 | ✅ |
| 2026-03-01 | 托盘图标全蓝 | 创建黑色麦克风剪影模板图标 | ✅ |
| 2026-03-04 | cpal `open` 启动麦克风无声 | 在 cpal 初始化时添加 200ms 延迟 | ✅ |
| 2026-03-05 | release 构建崩溃 (capture_avfoundation 残留) | 清理缓存后重新构建解决 | ✅ |
| 2026-03-09 | cpal `open` 启动麦克风返回 0 | 直接运行模式可用，open 启动是已知限制 | 🔄 |
| 2026-03-10 | CoreAudio 回调未被调用 | 与 cpal 问题相同，macOS 音频子系统限制 | 🔄 |

---

## 决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-03-01 | 选择 Tauri v2 而非 Electron | 内存占用低 (30MB vs 100MB+) |
| 2026-03-01 | MVP 优先策略 | 快速验证核心功能 |
| 2026-03-01 | 纯剪贴板输出 | 简单稳定，适合 MVP |
| 2026-03-01 | Rust 全栈架构 | 后台稳定，性能最优 |
| 2026-03-01 | Apple 风格 UI | 原生 macOS 体验 |
| 2026-03-01 | 禁用弹性滚动 | 避免回弹导致内容显示不全 |
| 2026-03-01 | 托盘图标使用模板模式 | 系统自动适配深色/浅色模式 |
| 2026-03-03 | macOS 打包后事件不工作 | 使用全局 `emit()` 替代 `emit_to()` |
| 2026-03-09 | cpal open 启动问题 | 接受直接运行模式作为临时解决方案 |
| 2026-03-10 | CoreAudio 回调问题 | 与 cpal 问题相同，需要 Apple 开发者签名或接受限制 |
