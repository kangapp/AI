# Findings & Decisions

## Requirements

从用户需求中提取：
- 参考 opencode 架构和实现方式
- 构建简易版 agent
- 支持 ultra think（深度思考）
- 实现 agent 基本功能
- 支持自定义工具
- 支持 MCP (Model Context Protocol)
- 项目构建在 project/simple-agent/ 目录
- **新增：** Web 前端界面

### Web 前端需求
- 对话交互界面
- 可视化控制台（查看 agent 执行过程）
- 任务管理
- 实时流式输出

## Research Findings

### OpenCode 架构分析

**项目结构**：
- Monorepo 结构 (packages/)
- 核心 CLI: packages/opencode/
- 技术栈：Bun + TypeScript + Solid.js (前端) + Hono (后端)
- AI 集成：Vercel AI SDK v5.0.124
- 数据库：SQLite (Drizzle ORM)

**核心模块**：
1. **Agent** (`packages/opencode/src/agent/agent.ts`)
   - Agent.Info 类型定义
   - 支持 mode: "subagent" | "primary" | "all"
   - 多种预定义 Agent: build, plan, general, explore 等

2. **工具系统** (`packages/openopencode/src/tool/registry.ts`)
   - ToolRegistry 管理工具注册
   - 内置工具：BashTool, ReadTool, WriteTool, GlobTool, GrepTool 等
   - 支持动态工具注册

3. **MCP 集成** (`packages/opencode/src/mcp/index.ts`)
   - 支持 StreamableHTTP 和 Stdio 传输
   - MCP 工具转换为 AI SDK 格式
   - OAuth 认证支持

4. **消息系统** (`packages/opencode/src/session/message-v2.ts`)
   - MessageV2 类型定义
   - 多种 Part 类型：TextPart, ToolPart, ReasoningPart 等

5. **LLM 处理** (`packages/opencode/src/session/llm.ts`)
   - LLM.stream() 处理流式输出
   - 支持多种 Provider

### Web 前端技术选型

| 选择 | 决策 | 理由 |
|------|------|------|
| UI 框架 | React 18 | 成熟生态，组件化 |
| 布局 | 三栏布局 | 会话列表 / 聊天 / 控制台 |
| 样式 | Tailwind CSS | 快速开发，响应式 |
| 状态 | Zustand | 轻量，TypeScript 友好 |
| 实时通信 | WebSocket | 实时事件推送 |
| 样式主题 | 蓝紫渐变 + light mode | 现代简约 |

### BFF 架构设计

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Express    │────▶│   Agent     │
│   (React)   │◀────│  + WS       │◀────│   Core      │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
   WebSocket          WebSocket            MiniMax
   Port 5174          Port 3002           API
```

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 使用 Vercel AI SDK | 与 opencode 一致，支持多种 provider |
| 最小化工具集 | 便于学习 agent 核心机制 |
| 完整 MCP 实现 | 提供真实场景的 MCP 集成经验 |
| JSON 持久化 | 简单直观，便于调试和理解 |
| 事件系统 | 提供完整可观测性 |
| 混合执行模式 | 支持调试(step)和自动执行(loop) |
| React + Tailwind + Zustand | 前端技术栈确定 |
| BFF 架构 | Express + WebSocket 提供实时交互 |
| 三栏布局 | 会话列表 / 聊天面板 / 控制台 |

## Dependencies

从 opencode vendor 分析得出的最新稳定版本：
- `ai`: 5.0.124
- `@ai-sdk/openai`: 2.0.89
- `@ai-sdk/anthropic`: 2.0.65
- `zod`: 4.1.8

Web 前端额外依赖：
- `express`: BFF 服务器
- `cors`: 跨域支持
- `ws`: WebSocket
- `react` 18.x: UI 框架
- `zustand`: 状态管理
- `tailwindcss`: 样式

## Issues Encountered

### 第一轮审查问题（Agent 实现）
1. AgentEvent/EventData 类型缺失 → 已添加
2. SessionStorage 接口缺失 → 已添加
3. MCP tool execute 缺少 context 参数 → 已修复
4. Agent 类初始化顺序错误 → 已修复
5. OpenAI Provider 代码有问题 → 已重写

### 第二轮审查问题（Agent 实现）
1. package.json 缺少 `ai` 依赖 → 已添加
2. SessionStorage 后有悬空代码 → 已删除
3. AgentConfig 缺少 mcpServers 属性 → 已添加
4. toolDefs 重复注册 → 已修复

### Web 前端实现问题
1. WebSocket 内存泄漏 → 添加 close 处理器
2. AbortSignal 未传递 → 修复 signal 传递链
3. Session API 未持久化 → 修复文件读写
4. dotenv baseURL 解析错误 → 引号包裹 URL
5. XSS 风险 → 添加 HTML 转义
6. ConsolePanel 无自动滚动 → 添加 scroll 逻辑

## Web Frontend 架构

### 文件结构
```
web/
├── src/
│   ├── types.ts           # WSEvent 类型
│   ├── store/
│   │   └── index.ts        # Zustand store
│   ├── hooks/
│   │   ├── useWebSocket.ts # WebSocket 连接
│   │   └── useAgent.ts     # Agent 执行触发
│   ├── components/
│   │   ├── TaskList.tsx    # 左侧会话列表
│   │   ├── ChatPanel.tsx   # 中间聊天面板
│   │   ├── ConsolePanel.tsx# 右侧控制台
│   │   └── common/
│   │       ├── Button.tsx
│   │       └── Input.tsx
│   ├── App.tsx             # 主应用
│   └── main.tsx           # React 入口
├── index.html
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

### 状态管理 (Zustand)
```typescript
interface Store {
  // Session 状态
  sessions: Session[];
  currentSessionId: string | null;
  // 消息状态
  messages: Record<string, Message[]>;
  // 控制台日志
  logs: LogEntry[];
  // Actions
  addSession: () => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  addLog: (entry: LogEntry) => void;
}
```

### WebSocket 事件流
```
agent:start      → 会话开始
message          → 用户/助手消息
iteration:start  → 迭代开始
iteration:end    → 迭代结束（带 token 统计）
tool:call        → 工具调用
tool:result      → 工具结果
agent:complete   → 会话完成
error            → 错误信息
```

## Resources

- OpenCode vendor: `/Users/liufukang/workplace/AI/vendors/opencode`
- Vercel AI SDK: https://github.com/vercel-labs/ai
- MCP 协议文档: Model Context Protocol
- React: https://react.dev
- Zustand: https://zustand.demo.pm
- Tailwind CSS: https://tailwindcss.com

## Visual/Browser Findings

- 设计文档包含数据流示意图，展示 agent 各组件间的消息传递
- 执行流程图清晰展示了 step 和 loop 模式的区别
- Web 前端三栏布局图
- 蓝紫渐变色值：blue-500 (#3B82F6) → purple-500 (#A855F7)
