# Task Plan: Simple Agent Implementation

## Goal

构建一个面向研究和学习的简易版 Agent，参考 opencode 架构，支持 LLM 调用、工具系统、MCP 集成、JSON 会话持久化、Web前端界面。

## Current Phase

Phase 1 & Web Frontend (Implementation Complete)

## Phases

### Phase 0: Design & Planning
- [x] 参考 opencode 架构进行分析
- [x] 需求澄清和设计方案确定
- [x] 编写设计规范文档
- [x] 编写实现计划
- [x] 计划审查通过
- **Status:** complete

### Phase 1: Project Setup
- [x] 创建 package.json 和 tsconfig.json
- [x] 创建全局类型定义 (src/types.ts)
- **Status:** complete

### Phase 2: Event System
- [x] 实现 EventEmitter (src/events/emitter.ts)
- **Status:** complete

### Phase 3: Storage System
- [x] 实现 JsonSessionStorage (src/storage/json.ts)
- **Status:** complete

### Phase 4: LLM Abstraction Layer
- [x] 实现 BaseLLMProvider 和类型定义
- [x] 实现 OpenAIProvider
- [x] 实现 AnthropicProvider
- [x] 创建 Provider 工厂函数
- **Status:** complete

### Phase 5: Tool System
- [x] 实现 ToolRegistry
- [x] 实现 BashTool, ReadTool, WriteTool
- **Status:** complete

### Phase 6: MCP Integration
- [x] 实现传输层 (Stdio, StreamableHTTP)
- [x] 实现 MCPClient
- [x] 实现 MCP 工具转换
- **Status:** complete

### Phase 7: Agent Core
- [x] 实现 Agent 主类
- [x] 实现 step 模式
- [x] 实现 loop 模式
- **Status:** complete

### Phase 8: CLI Entry Point
- [x] 创建 CLI 入口 (src/index.ts)
- **Status:** complete

### Phase 9: Examples
- [x] 创建 basic.ts 示例
- [x] 创建 mcp.ts 示例
- [x] 创建 custom-tool.ts 示例
- **Status:** complete

### Phase 10: Testing & Verification
- [x] 运行完整测试
- [x] 验证功能完整性
- **Status:** complete

### Phase 11: Web Frontend
- [x] 设计和规范文档 (docs/superpowers/specs/2026-03-26-web-frontend-design.md)
- [x] 实现计划 (docs/superpowers/plans/2026-03-26-web-frontend-implementation.md)
- [x] BFF 后端 (src/server/)
  - WebSocket 管理器
  - Agent 执行 API
  - Session CRUD API
- [x] 前端 Web 应用 (web/)
  - TypeScript 类型
  - Zustand 状态管理
  - WebSocket Hook
  - Agent 执行 Hook
  - TaskList 组件
  - ChatPanel 组件
  - ConsolePanel 组件
  - 基础 UI 组件 (Button, Input)
  - 主应用布局
- [x] E2E 测试验证
- **Status:** complete

## Reference Documents

| Document | Path |
|----------|------|
| Agent 设计规范 | `docs/2026-03-25-simple-agent-design.md` |
| Agent 实现计划 | `docs/2026-03-25-simple-agent-implementation.md` |
| Web 前端设计 | `docs/superpowers/specs/2026-03-26-web-frontend-design.md` |
| Web 前端实现 | `docs/superpowers/plans/2026-03-26-web-frontend-implementation.md` |

## Dependencies Version

| Package | Version |
|---------|---------|
| ai | 5.0.124 |
| @ai-sdk/openai | 2.0.89 |
| @ai-sdk/anthropic | 2.0.65 |
| zod | 4.1.8 |
| express | latest |
| cors | latest |
| ws | latest |
| react | 18.x |
| zustand | latest |
| tailwindcss | latest |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Bun + TypeScript | 与 opencode 一致，更快的启动速度 |
| 最小化工具集 (Bash, Read, Write) | 聚焦 agent 核心机制，便于学习 |
| JSON 文件持久化 | 简单直观，便于调试 |
| 完整 MCP 支持 | 支持远程/本地 MCP 服务器 |
| 混合执行模式 (step/loop) | 支持调试和生产使用 |
| React + Tailwind + Zustand | 前端技术栈确定 |
| BFF 架构 | Express + WebSocket 提供实时交互 |
| 三栏布局 | 会话列表 / 聊天面板 / 控制台 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| WebSocket 内存泄漏 | 1 | 添加 ws.on('close') 处理器和重连前关闭 |
| AbortSignal 未传递 | 2 | 在 agent.ts, step.ts, loop.ts 中修复 |
| Session API 未持久化 | 1 | 修复为实际读写 JSON 文件 |
| Session 目录不存在 | 1 | 添加 ensureSessionDir() 递归创建 |
| 未使用导入 | 1 | 移除未使用的导入 |
| XSS 风险 | 1 | 添加 escapeHtml() 转义 |
| ConsolePanel 缺少自动滚动 | 1 | 添加 useRef + useEffect |
| dotenv 未加载 | 1 | 添加 `import 'dotenv/config'` |
| baseURL 缺少 /v1 | 1 | 在 .env 中用引号包裹 URL |

## Notes

- 执行方式：使用 superpowers:subagent-driven-development 完成
- Web 前端已通过 E2E 测试验证
- 参考 opencode vendor: `/Users/liufukang/workplace/AI/vendors/opencode`
