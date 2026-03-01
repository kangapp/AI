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

---

## 当前焦点

**阶段**: Phase 13 - 长句显示优化 ✅ 完成
**状态**: 开发中
**下一步**: 进行实际语音转录测试

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
