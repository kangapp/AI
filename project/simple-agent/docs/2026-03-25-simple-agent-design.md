# Simple Agent 设计规范

> 构建一个面向研究和学习的简易版 Agent 实现

**目标**：参考 opencode 架构，但以代码可读性和教学性为核心优先级

---

## 1. 项目概述

### 1.1 核心定位

- **研究/学习导向**：代码清晰易懂，可用于教学和二次开发
- **最小化依赖**：保持核心逻辑简单，不引入不必要的复杂性
- **完整机制**：呈现真实 Agent 的核心运作机制（LLM 调用、工具选择、循环执行）

### 1.2 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 运行时 | Bun | 与 opencode 保持一致，更快的启动速度 |
| 语言 | TypeScript | 类型安全，便于学习理解 |
| 模型 SDK | 抽象层 | 支持 OpenAI / Anthropic / OpenAI-compatible |
| 持久化 | JSON 文件 | 简单直观，便于调试 |
| MCP | 完整实现 | 支持远程/本地服务器连接 |

---

## 2. 架构设计

### 2.1 项目结构

```
simple-agent/
├── src/
│   ├── agent/           # Agent 核心
│   │   ├── index.ts     # 导出入口
│   │   ├── agent.ts     # Agent 主类
│   │   ├── loop.ts      # Loop 模式执行器
│   │   └── step.ts      # Step by Step 模式
│   ├── llm/             # LLM 抽象层
│   │   ├── index.ts
│   │   ├── base.ts      # Provider 抽象接口
│   │   ├── openai.ts    # OpenAI Provider
│   │   ├── anthropic.ts # Anthropic Provider
│   │   └── types.ts     # 共用类型
│   ├── tools/           # 工具系统
│   │   ├── index.ts
│   │   ├── registry.ts  # 工具注册表
│   │   ├── bash.ts      # Bash 工具
│   │   ├── read.ts      # Read 工具
│   │   └── write.ts     # Write 工具
│   ├── mcp/             # MCP 集成
│   │   ├── index.ts
│   │   ├── client.ts    # MCP 客户端
│   │   ├── transport/   # 传输层
│   │   │   ├── index.ts
│   │   │   ├── stdio.ts
│   │   │   └── streamable-http.ts
│   │   └── tool.ts      # MCP 工具转换
│   ├── storage/         # 持久化
│   │   ├── index.ts
│   │   └── json.ts      # JSON 文件存储
│   ├── events/          # 事件系统
│   │   ├── index.ts
│   │   └── emitter.ts   # 事件发射器
│   └── types.ts         # 全局类型定义
├── package.json
└── tsconfig.json
```

### 2.2 核心类型定义

```typescript
// 消息类型
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  // toolResults 不放在 Message 中，而是在响应上下文中携带
}

// 工具定义（用于 LLM 调用）
interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

// 工具调用
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

// 工具执行结果
interface ToolResult {
  toolCallId: string
  success: boolean
  result?: any
  error?: string
}

// Agent 配置
interface AgentConfig {
  provider: 'openai' | 'anthropic' | 'openai-compatible'
  model: string
  apiKey?: string
  baseURL?: string  // for OpenAI-compatible
  systemPrompt?: string
  maxIterations?: number  // loop 模式最大迭代次数
  tools: Tool[]  // 注册的工具列表
  mcpServers?: MCPConfig[]  // MCP 服务器配置
}

// Agent 执行模式
type AgentMode = 'step' | 'loop'

// Agent 执行步骤结果
interface StepResult {
  type: 'message' | 'tool_call' | 'tool_result' | 'error' | 'complete'
  content: any
  metadata?: {
    toolName?: string
    toolArgs?: any
    reasoning?: string  // if model supports
  }
}
```

---

## 3. 组件设计

### 3.1 LLM 抽象层 (`src/llm/`)

**目标**：提供统一的 LLM 调用接口，支持多种 Provider

```typescript
// src/llm/base.ts
interface LLMProvider {
  readonly name: string
  readonly model: string  // 当前使用的模型

  // 创建聊天完成
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>

  // 检查是否支持工具调用
  supportsTools(): boolean

  // 获取工具调用参数（Provider 特定）
  extractToolCalls(response: ChatResponse): ToolCall[]

  // 获取文本内容
  extractContent(response: ChatResponse): string
}

interface ChatOptions {
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | { type: 'function', name: string }
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

interface ChatResponse {
  content: string
  reasoning?: string  // for models that support
  toolCalls?: ToolCall[]
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}
```

**Provider 实现**：

| Provider | 文件 | 说明 |
|----------|------|------|
| OpenAI | `openai.ts` | 使用 `@ai-sdk/openai` |
| Anthropic | `anthropic.ts` | 使用 `@ai-sdk/anthropic` |
| OpenAI-compatible | `openai.ts` | 通过 baseURL 配置支持 LocalAI/Ollama 等 |

### 3.2 工具系统 (`src/tools/`)

**目标**：简洁的工具注册和执行机制

```typescript
// 工具定义
interface Tool {
  name: string
  description: string
  parameters: z.ZodSchema  // 使用 Zod 定义参数
  execute: (params: any, context: ToolContext) => Promise<ToolResult>
}

interface ToolContext {
  cwd: string
  userId?: string
  sessionId: string
}

// 工具注册表
class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void
  get(name: string): Tool | undefined
  list(): Tool[]
  getDefinitions(): ToolDefinition[]  // 转为 LLM 格式
}

// 内置工具
const builtInTools = [
  BashTool,   // 执行 shell 命令
  ReadTool,   // 读取文件
  WriteTool,  // 写入文件
]
```

**内置工具详情**：

| 工具 | 参数 | 说明 |
|------|------|------|
| Bash | `command: string` | 在指定目录执行 shell 命令 |
| Read | `path: string, lines?: number` | 读取文件内容，可限制行数 |
| Write | `path: string, content: string` | 写入文件内容 |

### 3.3 MCP 集成 (`src/mcp/`)

**目标**：完整支持 MCP 协议，能连接远程和本地 MCP 服务器

```typescript
// MCP 配置
interface MCPConfig {
  name: string
  transport: 'stdio' | 'streamable-http'
  command?: string      // for stdio: e.g., 'npx', 'python'
  args?: string[]       // for stdio
  url?: string          // for streamable-http
  env?: Record<string, string>
}

// MCP 客户端
class MCPClient {
  private connections: Map<string, MCPConnection> = new Map()

  async connect(config: MCPConfig): Promise<void>
  async disconnect(name: string): Promise<void>
  async listTools(): Promise<Tool[]>  // 转换为 Agent 工具格式
  async callTool(name: string, args: any): Promise<any>
}

// MCP 工具转换
function convertMcpTool(mcpTool: MCPTool, client: MCPClient): Tool
```

**传输层实现**：

| 传输方式 | 文件 | 说明 |
|----------|------|------|
| Stdio | `transport/stdio.ts` | 进程 stdin/stdout 通信，用于本地 MCP 服务器 |
| Streamable HTTP | `transport/streamable-http.ts` | HTTP SSE 方式，用于远程 MCP 服务器 |

### 3.4 Agent 核心 (`src/agent/`)

**目标**：实现完整的 Agent 循环逻辑

```typescript
// Agent 主类
class Agent {
  private config: AgentConfig
  private llm: LLMProvider
  private tools: ToolRegistry
  private mcp: MCPClient
  private events: EventEmitter
  private storage: SessionStorage

  constructor(config: AgentConfig)

  // 执行入口
  run(messages: Message[], mode: AgentMode): AsyncGenerator<StepResult>

  // Step by Step 模式
  private async step(messages: Message[]): Promise<StepResult>

  // Loop 模式
  private async *loop(messages: Message[]): AsyncGenerator<StepResult>

  // 处理工具调用
  private async handleToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]>

  // 事件发射
  emit(event: string, data: any): void
  on(event: string, handler: EventHandler): void
}
```

### 3.5 事件系统 (`src/events/`)

**目标**：提供可观测性，让学生能看到每个决策点

```typescript
// 事件类型
type AgentEvent =
  | 'start'           // Agent 开始执行
  | 'step_start'      // 每个步骤开始
  | 'step_complete'   // 每个步骤完成
  | 'llm_request'     // LLM 请求发送
  | 'llm_response'    // LLM 响应接收
  | 'tool_call'       // 工具调用
  | 'tool_result'     // 工具执行结果
  | 'error'           // 错误发生
  | 'complete'        // Agent 执行完成
  | 'mcp_connect'     // MCP 服务器连接
  | 'mcp_disconnect'  // MCP 服务器断开

// 事件数据
interface EventData {
  timestamp: number
  event: AgentEvent
  data: any
  sessionId: string
}

// 事件发射器
class EventEmitter {
  emit(event: AgentEvent, data: any): void
  on(event: AgentEvent, handler: (data: EventData) => void): void
  off(event: AgentEvent, handler: Handler): void
  getHistory(): EventData[]  // 获取历史事件
}
```

### 3.6 持久化 (`src/storage/`)

**目标**：JSON 文件存储会话历史

```typescript
// 会话存储
interface SessionStorage {
  save(session: Session): Promise<void>
  load(sessionId: string): Promise<Session | null>
  list(): Promise<SessionMeta[]>  // 列出所有会话
  delete(sessionId: string): Promise<void>
}

interface Session {
  id: string
  createdAt: number
  updatedAt: number
  config: AgentConfig
  messages: Message[]
  events: EventData[]
}

// JSON 文件实现
class JsonSessionStorage implements SessionStorage {
  constructor(storageDir: string)
  // 文件格式: {sessionId}.json
}
```

---

## 4. 执行流程

### 4.1 Step 模式

```
用户调用 agent.run(messages, 'step')
  │
  ├─→ emit('step_start')
  │
  ├─→ llm.chat(messages) ──→ emit('llm_request')
  │                              │
  │                         emit('llm_response')
  │
  ├─→ 检查是否有 tool_calls
  │     │
  │     ├─→ 无 tool_calls → 返回消息结果
  │     │
  │     └─→ 有 tool_calls
  │           │
  │           ├─→ emit('tool_call') × N
  │           │
  │           ├─→ execute(tool) × N
  │           │        │
  │           │   emit('tool_result')
  │           │
  │           └─→ 将结果追加到 messages
  │
  ├─→ emit('step_complete')
  │
  └─→ 返回 StepResult（暂停，等待用户继续）
```

### 4.2 Loop 模式

```
用户调用 agent.run(messages, 'loop')
  │
  ├─→ emit('start')
  │
  └─→ while (iterations < maxIterations)
        │
        ├─→ emit('step_start')
        │
        ├─→ llm.chat(messages)
        │
        ├─→ 检查响应
        │     │
        │     ├─→ 文本响应 → emit('message') → 返回结果，结束
        │     │
        │     └─→ tool_calls
        │           │
        │           ├─→ emit('tool_call') × N
        │           ├─→ execute(tool) × N
        │           │     │
        │           │     emit('tool_result')
        │           │     │
        │           │     将结果追加到 messages
        │           │
        │           └─→ continue loop
        │
        └─→ emit('step_complete')
  │
  ├─→ emit('complete')
  │
  └─→ 返回最终结果
```

---

## 5. 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                              │
│                    (用户输入任务描述)                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Agent.run()                              │
│                    (接收消息数组)                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EventEmitter.emit('start')                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  ToolRegistry │  │  MCPClient   │  │    LLM       │
│  (工具列表)   │  │  (MCP工具)   │  │  (Provider)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │         ┌───────┴───────┐         │
       │         │  合并为统一    │         │
       │         │  工具列表      │         │
       │         └───────┬───────┘         │
       │                 │                 │
       └─────────────┬───┘                 │
                     ▼                     │
┌─────────────────────────────────────────────────────────────────┐
│                    LLM.chat(messages)                          │
│                    (包含工具定义)                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼                               ▼
┌──────────────────┐          ┌─────────────────────────┐
│   Text Response  │          │     Tool Calls          │
│   (文本回复)      │          │   (需要调用的工具)        │
└────────┬─────────┘          └────────────┬──────────────┘
         │                               │
         │         ┌─────────────────────┘
         │         │
         ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│              EventEmitter.emit('step_complete')                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ (loop 模式继续，step 模式暂停)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EventEmitter.emit('complete')                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. CLI 入口

```typescript
// src/index.ts
import { Agent } from './agent'
import { JsonSessionStorage } from './storage'
import { ToolRegistry, BashTool, ReadTool, WriteTool } from './tools'
import { OpenAIProvider, AnthropicProvider } from './llm'

async function main() {
  // 解析命令行参数
  const args = parseArgs()

  // 初始化存储
  const storage = new JsonSessionStorage('./sessions')

  // 加载或创建会话
  let session = args.sessionId
    ? await storage.load(args.sessionId)
    : null

  // 注册工具
  const tools = new ToolRegistry()
  tools.register(BashTool)
  tools.register(ReadTool)
  tools.register(WriteTool)

  // 创建 Agent
  const agent = new Agent({
    provider: args.provider,
    model: args.model,
    apiKey: args.apiKey,
    baseURL: args.baseURL,
    tools: tools.list(),
  })

  // 绑定事件（用于日志输出）
  agent.on('*', (event) => console.log(`[${event.event}]`, event.data))

  // 执行
  const messages = session?.messages || []
  messages.push({ role: 'user', content: args.prompt })

  for await (const step of agent.run(messages, args.mode)) {
    // 逐步输出
  }

  // 保存会话
  await storage.save({
    id: session?.id || generateId(),
    createdAt: session?.createdAt || Date.now(),
    updatedAt: Date.now(),
    config: agent.config,
    messages,
    events: agent.events.getHistory(),
  })
}
```

---

## 7. 使用示例

### 7.1 基本使用（Loop 模式）

```typescript
import { Agent } from 'simple-agent'
import { BashTool, ReadTool, WriteTool } from 'simple-agent/tools'

const agent = new Agent({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  tools: [BashTool, ReadTool, WriteTool],
})

// Loop 模式：自动循环直到任务完成
const messages = [
  { role: 'user', content: '创建一个 hello.txt 文件，内容为 "Hello, Agent!"' }
]

for await (const step of agent.run(messages, 'loop')) {
  switch (step.type) {
    case 'message':
      console.log('Agent:', step.content)
      break
    case 'tool_call':
      console.log(`Calling: ${step.metadata?.toolName}`)
      break
    case 'tool_result':
      console.log(`Result: ${JSON.stringify(step.content)}`)
      break
    case 'error':
      console.error('Error:', step.content)
      break
    case 'complete':
      console.log('Task completed!')
      break
  }
}
```

### 7.2 Step by Step 模式（调试模式）

```typescript
import { Agent } from 'simple-agent'
import { BashTool, ReadTool, WriteTool } from 'simple-agent/tools'

const agent = new Agent({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
  tools: [BashTool, ReadTool, WriteTool],
})

const messages = [
  { role: 'user', content: '列出当前目录的所有 TypeScript 文件' }
]

// Step 模式：每一步都暂停，等待确认
for await (const step of agent.run(messages, 'step')) {
  console.log(`[Step] ${step.type}:`, step.content)

  // 可以在这里检查中间状态，决定是否继续
  if (step.type === 'tool_call') {
    const continue_ = await askUser('Continue? (y/n)')
    if (continue_ !== 'y') {
      console.log('Aborted by user')
      break
    }
  }
}
```

### 7.3 连接 MCP 服务器（文件系统工具）

```typescript
import { Agent } from 'simple-agent'
import { MCPClient } from 'simple-agent/mcp'
import { BashTool } from 'simple-agent/tools'

async function exampleWithMCP() {
  const mcpClient = new MCPClient()

  // 连接官方 filesystem MCP 服务器
  await mcpClient.connect({
    name: 'filesystem',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  })

  // 获取 MCP 工具列表
  const mcpTools = await mcpClient.listTools()
  console.log('MCP Tools:', mcpTools.map(t => t.name))

  // 创建 Agent，合并内置工具和 MCP 工具
  const agent = new Agent({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
    tools: [BashTool, ...mcpTools],  // 合并工具
    mcpClient,  // 传入 MCP 客户端
  })

  // 执行任务
  for await (const step of agent.run([
    { role: 'user', content: '在 /tmp 目录下创建一个名为 notes 的文件夹' }
  ], 'loop')) {
    console.log(step)
  }

  // 断开连接
  await mcpClient.disconnect('filesystem')
}
```

### 7.4 连接远程 MCP 服务器（GitHub API）

```typescript
import { Agent } from 'simple-agent'
import { MCPClient } from 'simple-agent/mcp'

async function exampleWithGitHubMCP() {
  const mcpClient = new MCPClient()

  // 连接 GitHub MCP 服务器（需要 GitHub Token）
  await mcpClient.connect({
    name: 'github',
    transport: 'streamable-http',
    url: 'https://api.github.com/mcp',
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    },
  })

  const mcpTools = await mcpClient.listTools()
  // 可能的工具：search_repos, get_repo, create_issue, etc.

  const agent = new Agent({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY,
    tools: mcpTools,
    mcpClient,
  })

  // 搜索 GitHub 仓库
  for await (const step of agent.run([
    { role: 'user', content: '搜索最近一周内有最多 star 的 TypeScript 仓库' }
  ], 'loop')) {
    console.log(step)
  }
}
```

### 7.5 自定义工具（Skill）

```typescript
import { Agent } from 'simple-agent'
import { z } from 'zod'

// 定义一个搜索网页的工具
const WebSearchTool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().default(5).describe('Max results'),
  }),

  async execute(params: { query: string; limit: number }, context) {
    // 实际实现中调用搜索 API
    const results = await searchWeb(params.query, params.limit)
    return {
      success: true,
      result: results,
    }
  },
}

// 定义一个发送 HTTP 请求的工具
const HttpTool = {
  name: 'http_request',
  description: 'Make an HTTP request to a URL',
  parameters: z.object({
    url: z.string().url().describe('The URL to request'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
  }),

  async execute(params, context) {
    const response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
    })
    return {
      success: true,
      result: {
        status: response.status,
        body: await response.text(),
      },
    }
  },
}

// 使用自定义工具创建 Agent
const agent = new Agent({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  tools: [WebSearchTool, HttpTool],  // 使用自定义工具
})

for await (const step of agent.run([
  { role: 'user', content: '搜索 "什么是 MCP 协议" 并获取第一个结果的详细内容' }
], 'loop')) {
  console.log(step)
}
```

### 7.6 事件监听与调试

```typescript
import { Agent } from 'simple-agent'
import { BashTool, ReadTool, WriteTool } from 'simple-agent/tools'

const agent = new Agent({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  tools: [BashTool, ReadTool, WriteTool],
})

// 监听所有事件
agent.on('start', (data) => {
  console.log('[EVENT] Agent started')
})

agent.on('step_start', (data) => {
  console.log(`[EVENT] Step ${data.iteration} started`)
})

agent.on('llm_request', (data) => {
  console.log('[EVENT] LLM Request:', {
    model: data.model,
    messageCount: data.messages.length,
  })
})

agent.on('llm_response', (data) => {
  console.log('[EVENT] LLM Response:', {
    content: data.content?.substring(0, 100) + '...',
    toolCalls: data.toolCalls?.length || 0,
  })
})

agent.on('tool_call', (data) => {
  console.log(`[EVENT] Tool Call: ${data.toolName}`, data.arguments)
})

agent.on('tool_result', (data) => {
  console.log(`[EVENT] Tool Result: ${data.toolName}`, {
    success: data.success,
    resultLength: JSON.stringify(data.result)?.length,
  })
})

agent.on('error', (data) => {
  console.error('[EVENT] Error:', data.error)
})

agent.on('complete', (data) => {
  console.log('[EVENT] Agent completed')
})

// 执行任务
for await (const step of agent.run([
  { role: 'user', content: '创建一个简单的 README.md 文件' }
], 'loop')) {
  // 业务逻辑处理
}
```

### 7.7 完整的 CLI 脚本

```typescript
// examples/cli.ts
import { Agent } from '../src/agent'
import { JsonSessionStorage } from '../src/storage'
import { ToolRegistry, BashTool, ReadTool, WriteTool } from '../src/tools'
import { parseArgs } from 'util'

async function main() {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      prompt: { type: 'string', short: 'p' },
      model: { type: 'string', default: 'gpt-4o' },
      provider: { type: 'string', default: 'openai' },
      session: { type: 'string' },
      mode: { type: 'string', default: 'loop' },
    },
  })

  // 初始化存储
  const storage = new JsonSessionStorage('./sessions')

  // 加载或创建会话
  let session = args.values.session
    ? await storage.load(args.values.session)
    : null

  // 注册工具
  const tools = new ToolRegistry()
  tools.register(BashTool)
  tools.register(ReadTool)
  tools.register(WriteTool)

  // 创建 Agent
  const agent = new Agent({
    provider: args.values.provider,
    model: args.values.model,
    apiKey: process.env.OPENAI_API_KEY,
    tools: tools.list(),
  })

  // 设置日志输出
  agent.on('*', (event) => {
    const timestamp = new Date(event.timestamp).toISOString()
    console.log(`[${timestamp}] ${event.event}`)
  })

  // 执行
  const messages = session?.messages || []
  if (args.values.prompt) {
    messages.push({ role: 'user', content: args.values.prompt })
  }

  const mode = args.values.mode as 'step' | 'loop'

  for await (const step of agent.run(messages, mode)) {
    if (step.type === 'message') {
      console.log('\n--- Agent Response ---\n', step.content)
    }
  }

  // 保存会话
  const sessionId = session?.id || crypto.randomUUID()
  await storage.save({
    id: sessionId,
    createdAt: session?.createdAt || Date.now(),
    updatedAt: Date.now(),
    config: agent.config,
    messages,
    events: [],
  })

  console.log(`\nSession saved: ${sessionId}`)
}

// 运行
main().catch(console.error)
```

### 7.8 会话恢复与历史查询

```typescript
import { JsonSessionStorage } from 'simple-agent/storage'

async function sessionManagement() {
  const storage = new JsonSessionStorage('./sessions')

  // 列出所有会话
  const sessions = await storage.list()
  console.log('Available sessions:')
  for (const meta of sessions) {
    console.log(`  ${meta.id} - ${new Date(meta.updatedAt).toLocaleString()}`)
  }

  // 恢复特定会话
  if (sessions.length > 0) {
    const session = await storage.load(sessions[0].id)
    console.log('Restored session with', session.messages.length, 'messages')

    // 继续对话
    const agent = new Agent({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      tools: [],
    })

    // 将历史消息 + 新消息传入
    const newMessages = [
      ...session.messages,
      { role: 'user', content: '继续之前的任务' },
    ]

    for await (const step of agent.run(newMessages, 'loop')) {
      console.log(step)
    }
  }
}
```

---

## 8. 验收标准

### 8.1 功能性

- [ ] Agent 能正确调用 LLM 并处理响应
- [ ] 工具系统能正确注册和执行工具
- [ ] Loop 模式能自动循环直到任务完成
- [ ] Step 模式能暂停等待用户指令
- [ ] MCP 客户端能连接并调用 MCP 工具
- [ ] 会话能正确保存和恢复

### 8.2 可观测性

- [ ] 所有事件都能被订阅和日志输出
- [ ] LLM 请求和响应能被追踪
- [ ] 工具调用和结果能被追踪
- [ ] 错误能被正确捕获和报告

### 8.3 代码质量

- [ ] 代码结构清晰，模块职责分明
- [ ] 关键逻辑有注释说明
- [ ] 类型定义完整
- [ ] 错误处理完善

---

## 9. 后续扩展点

以下功能不在本次范围内，但预留了扩展接口：

- 权限系统（类似 opencode 的 PermissionNext）
- 上下文压缩
- Agent 之间的通信
- Web 前端界面
- 更丰富的内置工具集
