# Simple Agent Web 前端设计

**日期**: 2026-03-26
**状态**: 已批准

---

## 概述

为 Simple Agent 项目增加 Web 前端界面，包含三个核心功能：

1. **对话交互界面** — 与 Agent 对话、查看执行结果
2. **可视化控制台** — 查看 Agent 执行过程、工具调用链、事件日志
3. **任务管理** — 创建任务、配置 Agent、监控执行状态、管理会话历史

---

## 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 React                          │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ 任务列表  │  │    对话界面      │  │    控制台/详情    │   │
│  │ (200px)  │  │   (flex-1)      │  │    (350px)       │   │
│  └──────────┘  └─────────────────┘  └──────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                      BFF Server (Express)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Agent API   │  │ 会话管理     │  │ 事件推送 (WebSocket) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ 直接调用
┌────────────────────────┴────────────────────────────────────┐
│                    Agent Core (现有代码)                      │
└─────────────────────────────────────────────────────────────┘
```

### 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React | 生态成熟，组件丰富 |
| 构建工具 | Vite | 快速开发启动 |
| 样式 | CSS Modules / Tailwind | 待定 |
| HTTP 客户端 | fetch / SWR | 待定 |
| WebSocket | 原生 WebSocket | BFF 推送事件 |
| 后端 | Express | BFF 层 |
| WebSocket | ws | Node.js WebSocket 支持 |

### 关键技术点

- BFF 层使用 Express + WebSocket
- Agent 的 EventEmitter 事件通过 WebSocket 实时推送前端
- 会话存储复用现有的 `.sessions/` 文件系统
- 支持流式输出（打字机效果）

---

## 目录结构

```
simple-agent/
├── src/
│   ├── agent/          # 现有代码
│   ├── events/         # 现有代码
│   ├── llm/            # 现有代码
│   ├── mcp/            # 现有代码
│   ├── storage/        # 现有代码
│   ├── tools/          # 现有代码
│   └── server/         # 新增 BFF 层
│       ├── index.ts    # HTTP + WebSocket 入口
│       ├── routes/
│       │   ├── agent.ts    # Agent 执行 API
│       │   └── session.ts  # 会话管理 API
│       ├── websocket.ts    # WebSocket 事件推送
│       └── types.ts        # API 类型定义
├── web/                # 新增 React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── TaskList.tsx      # 左侧任务列表
│   │   │   ├── ChatPanel.tsx     # 中间对话界面
│   │   │   ├── ConsolePanel.tsx  # 右侧控制台
│   │   │   └── common/           # Button, Input, Card 等
│   │   ├── hooks/
│   │   │   ├── useAgent.ts       # Agent 交互 hook
│   │   │   └── useWebSocket.ts   # WebSocket 连接
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── package.json        # 根目录 workspace
```

---

## 三栏布局

| 区域 | 宽度 | 内容 |
|------|------|------|
| 左侧边栏 | 200px | 任务列表、新建任务、任务状态 |
| 中间主区 | flex-1 | 对话消息、流式输出、输入框 |
| 右侧面板 | 350px | 控制台日志、工具调用链、迭代详情 |

### 视觉风格

- **风格**: 浅色现代，简约明亮，类似 SaaS 产品
- **主色调**: 蓝紫渐变（类似 Linear、Vercel 风格）
- **输出效果**: 实时流式输出，打字机效果

---

## 交互流程

### 对话执行流程

```
用户输入 → POST /api/agent/run → BFF 启动 Agent
                                    ↓
                              Agent.run() 异步生成器
                                    ↓
                              事件通过 WebSocket 推送
                              - agent:start
                              - iteration:start
                              - tool:call
                              - tool:result
                              - message (流式)
                              - iteration:end
                              - agent:complete
```

### WebSocket 事件类型

```typescript
type WSEvent =
  | { type: 'agent:start'; data: { sessionId: string } }
  | { type: 'message'; data: { content: string; role: 'user' | 'assistant' } }
  | { type: 'tool:call'; data: { tool: string; params: unknown } }
  | { type: 'tool:result'; data: { tool: string; result: string } }
  | { type: 'iteration:start'; data: { iteration: number } }
  | { type: 'iteration:end'; data: { iteration: number; usage: Usage } }
  | { type: 'agent:complete'; data: { finalMessage: string } }
  | { type: 'error'; data: { message: string } };
```

---

## API 设计

### POST /api/agent/run

启动 Agent 执行任务。

**Request:**
```json
{
  "sessionId": "可选的会话ID",
  "prompt": "用户输入",
  "mode": "loop | step",
  "model": "可选的模型",
  "provider": "可选的提供者"
}
```

**Response:** HTTP 202 Accepted + WebSocket 连接

### GET /api/sessions

获取会话列表。

**Response:**
```json
{
  "sessions": [
    { "id": "session-xxx", "createdAt": "ISO时间", "lastMessage": "..." }
  ]
}
```

### POST /api/sessions

创建新会话。

**Response:**
```json
{
  "sessionId": "新建的会话ID"
}
```

### DELETE /api/sessions/:id

删除会话。

**Response:**
```json
{
  "success": true
}
```

---

## 组件设计

### 1. TaskList (左侧边栏)

- 任务/会话列表
- 新建任务按钮
- 每个任务显示：ID、创建时间、状态（运行中/完成）
- 点击切换当前会话

### 2. ChatPanel (中间对话)

- 消息列表（用户/助手消息）
- 流式输出显示（打字机效果）
- 底部输入框 + 发送按钮
- 加载状态指示器

### 3. ConsolePanel (右侧控制台)

- 事件日志列表（时间、事件类型、详情）
- 工具调用链展示
- 迭代统计（迭代次数、Token 使用量）
- 可折叠/展开

---

## 技术选型（已确认）

| 项目 | 选择 | 说明 |
|------|------|------|
| 样式 | Tailwind CSS | 原子化 CSS，开发效率高 |
| 状态管理 | Zustand | 轻量、简洁，足够应对本项目复杂度 |
| HTTP 客户端 | fetch | 原生支持，无需额外依赖 |
