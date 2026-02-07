# RaFlow

> 实时语音转文字桌面应用

基于 Tauri v2 + React 18 + ElevenLabs Scribe v2 Realtime API 构建的跨平台语音转文字应用。

## 功能特性

- 🎤 **实时语音转文字** - 使用 ElevenLabs Scribe v2 API
- ⌨️ **全局快捷键** - Command+Shift+R (macOS) / Ctrl+Shift+R (Windows/Linux)
- 📋 **智能文本注入** - 自动检测可编辑元素并注入文本
- 🎯 **系统托盘** - 常驻后台，快捷菜单操作
- 🌐 **多语言支持** - 中文、英语、日语、韩语，自动检测

## 技术栈

**前端:**
- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- Zustand (状态管理)

**后端:**
- Tauri v2
- Rust (Tokio 异步运行时)
- tokio-tungstenite (WebSocket)

## 开发

### 前置要求

- Node.js 18+
- Rust 1.70+
- npm/yarn/pnpm

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local，填写 ElevenLabs API Key
```

### 开发模式

```bash
npm run tauri:dev
```

### 构建

```bash
npm run tauri:build
```

## 项目结构

```
raflow/
├── src/                    # 前端源代码
│   ├── components/         # React 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # 入口文件
│   └── index.css          # 样式文件
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── audio/         # 音频处理模块
│   │   ├── elevenlabs/    # ElevenLabs 客户端
│   │   ├── injection/     # 文本注入模块
│   │   └── main.rs        # Tauri 入口
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置
├── docs/                  # 项目文档
├── task_plan.md           # 任务计划
├── findings.md            # 研究发现
└── progress.md            # 进度日志
```

## 开发路线

- [x] Phase 1: 项目初始化与环境准备
- [ ] Phase 2: MVP 快速验证 - 音频采集与 ElevenLabs 集成
- [ ] Phase 3: 文本注入与剪贴板管理
- [ ] Phase 4: 前端界面实现
- [ ] Phase 5: 系统集成与 Tauri 配置
- [ ] Phase 6: 高性能架构迁移
- [ ] Phase 7: 生产级优化
- [ ] Phase 8: 调试工具与开发者体验
- [ ] Phase 9: 测试与验证
- [ ] Phase 10: 打包与部署

## 许可证

MIT License

## 鸣谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [ElevenLabs](https://elevenlabs.io/) - 语音转文字 API
- [Wispr Flow](https://wisprflow.ai/) - 技术灵感来源
