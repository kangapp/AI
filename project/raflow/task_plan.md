# Task Plan: RaFlow 实时语音转文字应用初始化与实现
<!--
  WHAT: 基于 Tauri v2 + React 的 RaFlow 项目完整实现计划
  WHY: 将设计文档转化为可执行的实施计划，确保项目按阶段推进
  WHEN: 创建于项目初始化阶段，将随实施进度持续更新
-->

## 目标

基于 `/Users/liufukang/workplace/AI/project/raflow/docs/plans/2026-02-07-raflow-optimized-design.md` 设计文档，初始化并实现 RaFlow - 一个基于 Tauri v2 的实时语音转文字桌面应用，支持 ElevenLabs Scribe v2 Realtime API、全局快捷键、智能文本注入等功能。

## 当前阶段

Phase 5（系统集成与 Tauri 配置）

> **已完成**:
> - Phase 0: 规划文件创建 ✅
> - Phase 1: 项目初始化与环境准备 ✅
> - Phase 2: MVP 快速验证 - 音频采集与 ElevenLabs 集成 ✅
> - Phase 3: 文本注入与剪贴板管理 ✅
> - Phase 4: 前端界面实现 ✅

## 阶段划分

### Phase 1: 项目初始化与环境准备
<!-- WHAT: 搭建基础项目结构，配置开发环境 -->
- [x] 使用 `@context7` 查询 Tauri v2、React 18、TypeScript 最新版本和最佳实践
- [x] 使用 `@context7` 查询 ElevenLabs Scribe v2 Realtime API 最新文档
- [x] 使用 `@context7` 查询 Tauri v2 生态相关插件（全局快捷键、系统托盘、麦克风录音等）
- [x] 初始化 Tauri v2 项目（使用 `npm create tauri-app@latest`）
- [x] 配置 TypeScript、Vite、Tailwind CSS
- [x] 配置 Rust 开发环境（Cargo.toml 依赖）
- [x] 创建项目基础目录结构
- [x] 配置 Git 忽略文件和代码格式化工具
- **状态:** **complete** ✅

### Phase 2: MVP 快速验证 - 音频采集与 ElevenLabs 集成
<!-- WHAT: 实现核心音频录制和语音转文字功能 -->
- [x] 使用 `@context7` 查询 cpal 最新 API（音频采集）
- [x] 使用 `@context7` 查询 tokio-tungstenite 最新 API（WebSocket）
- [x] 使用 `@context7` 查询 rubato 最新 API（重采样）
- [x] 使用 `@test-driven-development` 实现音频录制模块（基于 cpal）
  - 编写测试：录制开始/停止功能
  - 编写测试：音频数据格式验证（16kHz PCM 16-bit）
  - 实现功能：录音控制命令
- [x] 使用 `@test-driven-development` 实现 ElevenLabs WebSocket 客户端
  - 编写测试：WebSocket 连接建立
  - 编写测试：音频数据发送（Base64 编码）
  - 编写测试：消息解析（partial_transcript、committed_transcript）
  - 实现功能：ScribeClient 连接和消息处理
- [x] 使用 `@test-driven-development` 实现音频数据重采样
  - 编写测试：不同采样率转换（44.1kHz → 16kHz）
  - 编写测试：PCM 数据格式验证
  - 实现功能：rubato 重采样器封装
- [x] 集成测试：端到端音频录制 → 转录流程
- **状态:** **complete** ✅

### Phase 3: 文本注入与剪贴板管理
<!-- WHAT: 实现智能文本注入功能 -->
- [x] 使用 `@test-driven-development` 实现剪贴板注入模块
  - 编写测试：剪贴板读写功能
  - 编写测试：平台特定快捷键模拟（macOS Cmd+V、Windows/Linux Ctrl+V）
  - 实现功能：inject_text 命令
- [x] 使用 `@context7` 查询 enigo 或 arboard 最新 API 和跨平台最佳实践
- [x] 使用 `@test-driven-development` 实现剪贴板恢复机制
  - 编写测试：原始剪贴板内容保存和恢复
  - 编写测试：用户新复制操作检测
  - 实现功能：SmartClipboard 异步恢复逻辑
- [x] 集成测试：文本注入 → 剪贴板恢复完整流程
- **状态:** **complete** ✅

### Phase 4: 前端界面实现
<!-- WHAT: 构建用户交互界面 -->
- [x] 使用 `@context7` 查询 React 18、Framer Motion、Zustand 最新 API
- [x] 使用 `@test-driven-development` 实现悬浮窗组件
  - 编写测试：录音状态切换
  - 编写测试：实时文本显示（partial vs committed）
  - 实现功能：FloatingWindow 组件和波形可视化
- [x] 使用 `@test-driven-development` 实现 Tauri 命令 hooks
  - 编写测试：invoke 调用封装
  - 编写测试：错误处理和状态管理
  - 实现功能：useFloatingWindow、usePermissions hooks
- [x] 使用 `@test-driven-development` 实现权限引导组件
  - 编写测试：权限状态检测
  - 编写测试：权限请求触发
  - 实现功能：PermissionGuide 组件
- [x] 使用 Tailwind CSS 实现响应式样式
- **状态:** complete ✅

### Phase 5: 系统集成与 Tauri 配置
<!-- WHAT: 配置系统托盘、全局快捷键、应用生命周期 -->
- [x] 使用 `@context7` 查询 Tauri v2 系统托盘最新配置语法
- [x] 使用 `@test-driven-development` 实现系统托盘功能
  - 编写测试：托盘菜单创建和事件处理
  - 编写测试：托盘图标显示
  - 实现功能：SystemTray 配置和事件监听
- [x] 使用 `@context7` 查询 tauri-plugin-global-shortcut 最新用法
- [x] 使用 `@test-driven-development` 实现全局快捷键
  - 编写测试：快捷键注册和触发
  - 编写测试：快捷键与录音状态绑定
  - 实现功能：全局快捷键配置（Command+Shift+R）
- [x] 配置 tauri.conf.json（窗口、权限、插件）
- [x] 实现应用生命周期管理（启动、关闭、隐藏/显示）
- **状态:** complete ✅

### Phase 6: 高性能架构迁移（第二阶段）
<!-- WHAT: 优化音频处理管道，移除插件依赖 -->
- [x] 使用 `@context7` 查询 cpal、rubato、ringbuf 最新 API
- [x] 使用 `@test-driven-development` 实现 AudioPipeline
  - 编写测试：cpal 音频流创建
  - 编写测试：环形缓冲区无锁并发
  - 编写测试：rubato 高质量重采样
  - 实现功能：自定义音频管道
- [x] 使用 `@test-driven-development` 实现性能监控系统
  - 编写测试：指标收集（延迟百分位计算）
  - 编写测试：指标快照获取
  - 实现功能：Metrics 和 Histogram 实现
- [ ] 迁移测试：从插件方案平滑迁移到自定义管道
- **状态:** in_progress

### Phase 7: 生产级优化（第三阶段）
<!-- WHAT: 添加断线重连、可编辑性检测、多语言支持 -->
- [ ] 使用 `@test-driven-development` 实现断线重连机制
  - 编写测试：指数退避重试策略
  - 编写测试：WebSocket 自动重连
  - 实现功能：RobustScribeClient
- [ ] 使用 `@context7` 查询 macOS Accessibility API 最新用法
- [ ] 使用 `@test-driven-development` 实现可编辑性检测（macOS）
  - 编写测试：AXUIElement 查询
  - 编写测试：应用白名单/黑名单过滤
  - 实现功能：is_editable_element 检测
- [ ] 使用 `@context7` 查询 ElevenLabs 多语言支持最新配置
- [ ] 使用 `@test-driven-development` 实现多语言配置
  - 编写测试：语言配置消息发送
  - 编写测试：自动语言检测
  - 实现功能：LanguageConfig 和配置方法
- [ ] 使用 `@test-driven-development` 实现权限引导流程
  - 编写测试：权限状态检测
  - 编写测试：权限请求触发
  - 实现功能：check_permissions、request_*_permission 命令
- **状态:** pending

### Phase 8: 调试工具与开发者体验
<!-- WHAT: 添加调试面板和性能监控 -->
- [ ] 使用 `@test-driven-development` 实现调试模式
  - 编写测试：DebugState 数据访问
  - 编写测试：调试命令注册
  - 实现功能：enable_debug_mode 和调试命令
- [ ] 使用 `@test-driven-development` 实现前端调试面板
  - 编写测试：指标数据获取和显示
  - 编写测试：实时性能监控
  - 实现功能：DebugPanel 组件和 useMetrics hook
- [ ] 添加日志配置（env_logger/structlog）
- [ ] 编写开发者文档和 API 说明
- **状态:** pending

### Phase 9: 测试与验证
<!-- WHAT: 完整的端到端测试和性能验证 -->
- [ ] 使用 `@test-driven-development` 编写集成测试
  - 测试：完整录音 → 转录 → 注入流程
  - 测试：系统托盘和快捷键交互
  - 测试：权限引导流程
- [ ] 使用 `@test-driven-development` 编写性能测试
  - 测试：端到端延迟 < 200ms
  - 测试：音频采集延迟 < 50ms
  - 测试：内存占用 < 100MB（空闲）
- [ ] 跨平台测试（macOS、Windows、Linux）
- [ ] 用户验收测试
- **状态:** pending

### Phase 10: 打包与部署
<!-- WHAT: 构建生产版本，准备分发 -->
- [ ] 使用 `@context7` 查询 Tauri v2 打包最新配置
- [ ] 配置应用图标和元数据
- [ ] 构建各平台安装包（.dmg、.exe、.AppImage）
- [ ] 代码签名（macOS、Windows）
- [ ] 准备发布说明和用户文档
- **状态:** pending

## 关键问题

1. **Tauri v2 插件生态是否成熟？** - 需要验证 tauri-plugin-mic-recorder、tauri-plugin-global-shortcut 等插件的可用性和维护状态
2. **ElevenLabs API 限流策略？** - 需要了解 Realtime API 的并发连接限制和计费模式
3. **跨平台文本注入差异？** - macOS/Windows/Linux 在辅助功能 API 和剪贴板行为上的差异需要处理
4. **音频延迟优化策略？** - 如何在插件方案和自定义管道之间平滑迁移
5. **多语言支持边界？** - ElevenLabs 支持的语言列表和自动检测准确性

## 技术决策

| 决策 | 理由 |
|------|------|
| **Tauri v2 + React 18** | 轻量级桌面框架，Rust 后端保证性能，React 生态丰富 |
| **渐进式架构迁移** | MVP 使用插件快速验证，第二阶段迁移到高性能自定义管道 |
| **Zustand 状态管理** | 轻量级、TypeScript 友好，适合小型应用 |
| **Framer Motion 动画** | 声明式动画 API，性能优秀，适合波形可视化 |
| **Tokio 异步运行时** | Rust 异步生态标准，避免事件循环冲突 |
| **剪贴板优先注入** | 兼容性最好，可作为可编辑性检测的后备方案 |
| **测试驱动开发** | 确保代码质量，便于重构，提前发现集成问题 |

## 遇到的错误

| 错误 | 尝试 | 解决方案 |
|------|------|----------|
| | 1 | |

## 重要提醒

- **每个实现阶段都必须使用 `@test-driven-development` 技能** - 先写测试，再实现功能
- **涉及外部依赖时必须使用 `@context7` 技能** - 确保引用最新版本的 API 和文档
- **每完成一个阶段更新状态** - pending → in_progress → complete
- **每次做重要决策前重新阅读此计划** - 保持目标清晰
- **记录所有错误** - 避免重复同样的错误
- **永不重复失败的操作** - 变更方法而不是重复尝试

## 参考资料

- 设计文档: `/Users/liufukang/workplace/AI/project/raflow/docs/plans/2026-02-07-raflow-optimized-design.md`
- ElevenLabs Scribe v2 API: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
- Tauri v2 文档: https://v2.tauri.app/
- Wispr Flow 技术挑战: https://wisprflow.ai/post/technical-challenges
