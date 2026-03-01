# 任务规划 - RaFlow 语音交互工具

> 基于 Tauri v2 与 ElevenLabs Scribe v2 Realtime API 的实时语音转录工具

---

## 项目概述

**目标**: 构建类似 Wispr Flow 的 macOS 语音听写工具 (MVP)

**MVP 功能**:
- 全局热键触发录音 (Cmd+Shift+H)
- 实时语音转文字 (<150ms 延迟)
- 转录文本自动复制到剪贴板
- 最小悬浮窗显示转录状态

**技术栈**: Tauri v2 + Rust + React + ElevenLabs Scribe v2

**详细计划**: [docs/plans/2026-03-01-mvp-implementation.md](docs/plans/2026-03-01-mvp-implementation.md)

---

## 阶段路线图 (MVP)

### Phase 1: 项目初始化
- [ ] 1.1 创建 Tauri 项目 (Cargo.toml, tauri.conf.json, package.json)
- [ ] 1.2 配置前端 (Vite, TypeScript, Tailwind)
- [ ] 1.3 创建基础 UI 结构

### Phase 2: 音频管道
- [x] 2.1 音频模块结构 (mod.rs)
- [x] 2.2 音频采集器 (cpal + mono 转换)
- [x] 2.3 音频重采样器 (rubato 48→16kHz)
- [x] 2.4 音频管道整合 (ringbuf)

### Phase 3: WebSocket 转录
- [x] 3.1 转录模块结构
- [x] 3.2 消息类型定义 (JSON)
- [x] 3.3 WebSocket 客户端 (tokio-tungstenite)

### Phase 4: 全局热键与命令
- [x] 4.1 Tauri 命令 (start/stop recording)
- [x] 4.2 全局热键注册 (Cmd+Shift+H)

### Phase 5: 剪贴板输出
- [x] 5.1 剪贴板模块 (arboard)

### Phase 6: 前端 UI
- [x] 6.1 状态管理 Hook
- [x] 6.2 悬浮窗组件 (波形 + 转录文本)

### Phase 7: 验证
- [x] 7.1 构建验证 (Rust + Frontend)
- [x] 7.2 功能测试 (cargo test + tsc)

---

### Phase 8: 端到端集成 ✅
- [x] 8.1 创建 session 模块 (RecordingSession 状态机)
- [x] 8.2 实现 start 流程 (连接 WebSocket + 启动音频)
- [x] 8.3 实现 WebSocket 接收与事件发送
- [x] 8.4 实现 stop 流程 (commit + 剪贴板输出)
- [x] 8.5 集成到 Tauri 命令
- [x] 8.6 测试验证 (cargo test + clippy + build)
- [x] 8.7 文档更新

---

## 当前焦点

**阶段**: MVP 开发完成 ✅
**状态**: 测试通过 - 实时转录和剪贴板功能正常

---

## 错误日志

| 时间 | 错误描述 | 解决方案 | 状态 |
|------|----------|----------|------|
| 2026-03-01 | 快捷键触发但 UI 无响应 | 添加 Tauri v2 capabilities 权限配置 | ✅ 已解决 |
| 2026-03-01 | 热键回调中 tokio::spawn panic | 改用 tauri::async_runtime::spawn | ✅ 已解决 |
| 2026-03-01 | API 返回 auth_error 解析失败 | 添加 AuthError 消息类型支持 | ✅ 已解决 |
| 2026-03-01 | WebSocket URL 缺少 model_id 参数 | 添加 `model_id=scribe_v2_realtime` URL 参数 | ✅ 已修复 |
| 2026-03-01 | 使用 Request::builder 缺少 sec-websocket-key | 使用 `into_client_request()` 自动生成 WebSocket headers | ✅ 已修复 |
| 2026-03-01 | API Key 认证失败 | 使用 HTTP Header `xi-api-key` 传递 (非 URL 参数) | ✅ 已修复 |

---

## 决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-03-01 | 选择 Tauri v2 而非 Electron | 内存占用低 (30MB vs 100MB+) |
| 2026-03-01 | MVP 优先策略 | 快速验证核心功能 |
| 2026-03-01 | 纯剪贴板输出 | 简单稳定，适合 MVP |
| 2026-03-01 | Rust 全栈架构 | 后台稳定，性能最优 |
