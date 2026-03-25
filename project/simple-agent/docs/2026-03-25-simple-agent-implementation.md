# Simple Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个面向研究和学习的简易版 Agent，参考 opencode 架构，支持 LLM 调用、工具系统、MCP 集成、JSON 会话持久化。

**Architecture:** 模块化架构，分为 agent（核心）、llm（抽象层）、tools（工具系统）、mcp（MCP 客户端）、storage（持久化）、events（事件系统）六大模块。

**Tech Stack:** Bun + TypeScript, @ai-sdk/openai, @ai-sdk/anthropic, zod

---

## File Structure

```
simple-agent/
├── src/
│   ├── types.ts              # 全局类型定义
│   ├── events/
│   │   ├── index.ts          # 导出
│   │   └── emitter.ts       # 事件发射器
│   ├── storage/
│   │   ├── index.ts         # 导出
│   │   └── json.ts          # JSON 文件存储
│   ├── llm/
│   │   ├── index.ts         # 导出
│   │   ├── types.ts         # LLM 共用类型
│   │   ├── base.ts          # Provider 抽象接口
│   │   ├── openai.ts        # OpenAI Provider
│   │   └── anthropic.ts     # Anthropic Provider
│   ├── tools/
│   │   ├── index.ts         # 导出
│   │   ├── registry.ts      # 工具注册表
│   │   ├── bash.ts          # Bash 工具
│   │   ├── read.ts          # Read 工具
│   │   └── write.ts         # Write 工具
│   ├── mcp/
│   │   ├── index.ts         # 导出
│   │   ├── types.ts          # MCP 类型
│   │   ├── tool.ts           # MCP 工具转换
│   │   ├── client.ts         # MCP 客户端
│   │   └── transport/
│   │       ├── index.ts      # 导出
│   │       ├── stdio.ts      # Stdio 传输
│   │       └── streamable-http.ts  # HTTP 传输
│   ├── agent/
│   │   ├── index.ts         # 导出
│   │   ├── agent.ts         # Agent 主类
│   │   ├── loop.ts          # Loop 模式
│   │   └── step.ts          # Step 模式
│   └── index.ts             # CLI 入口
├── tests/
│   ├── events.test.ts
│   ├── storage.test.ts
│   ├── llm.test.ts
│   ├── tools.test.ts
│   ├── mcp.test.ts
│   └── agent.test.ts
├── examples/
│   └── basic.ts
├── package.json
└── tsconfig.json
```

---

## Phase 1: 项目初始化

### Task 1: 创建项目配置文件

**Files:**
- Create: `simple-agent/package.json`
- Create: `simple-agent/tsconfig.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "simple-agent",
  "version": "0.1.0",
  "type": "module",
  "description": "A simple agent implementation for learning and research",
  "main": "src/index.ts",
  "scripts": {
    "test": "bun test",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run src/index.ts"
  },
  "dependencies": {
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "ai": "^3.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "bun-types": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Commit**

```bash
git add simple-agent/package.json simple-agent/tsconfig.json
git commit -m "chore: initialize simple-agent project with Bun and TypeScript"
```

---

### Task 2: 创建全局类型定义

**Files:**
- Create: `simple-agent/src/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
import { z } from 'zod'

// ============ 事件类型 ============

export type AgentEvent =
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

export interface EventData {
  timestamp: number
  event: AgentEvent
  data: unknown
  sessionId: string
}

// ============ 消息类型 ============

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  success: boolean
  result?: unknown
  error?: string
}

// ============ 工具定义 ============

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

export interface ToolContext {
  cwd: string
  userId?: string
  sessionId: string
}

export interface Tool {
  name: string
  description: string
  parameters: z.ZodSchema
  execute: (params: unknown, context: ToolContext) => Promise<ToolResult>
}

// ============ Agent 配置 ============

export interface AgentConfig {
  provider: 'openai' | 'anthropic' | 'openai-compatible'
  model: string
  apiKey?: string
  baseURL?: string
  systemPrompt?: string
  maxIterations?: number
  tools: Tool[]
  mcpServers?: MCPConfig[]
}

export type AgentMode = 'step' | 'loop'

export interface StepResult {
  type: 'message' | 'tool_call' | 'tool_result' | 'error' | 'complete'
  content: unknown
  metadata?: {
    toolName?: string
    toolArgs?: unknown
    reasoning?: string
  }
}

// ============ 会话类型 ============

export interface Session {
  id: string
  createdAt: number
  updatedAt: number
  config: AgentConfig
  messages: Message[]
  events: EventData[]
}

export interface SessionMeta {
  id: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface SessionStorage {
  save(session: Session): Promise<void>
  load(sessionId: string): Promise<Session | null>
  list(): Promise<SessionMeta[]>
  delete(sessionId: string): Promise<void>
}

// ============ MCP 类型 ============

export interface MCPConfig {
  name: string
  transport: 'stdio' | 'streamable-http'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export type MCPStatus =
  | { status: 'connected' }
  | { status: 'disconnected' }
  | { status: 'failed'; error: string }
```

- [ ] **Step 2: Commit**

```bash
git add simple-agent/src/types.ts
git commit -m "feat: add global type definitions"
```

---

## Phase 2: 事件系统

### Task 3: 实现事件发射器

**Files:**
- Create: `simple-agent/src/events/emitter.ts`
- Create: `simple-agent/src/events/index.ts`
- Create: `simple-agent/tests/events.test.ts`

- [ ] **Step 1: 创建 events/emitter.ts**

```typescript
import type { AgentEvent, EventData } from '../types'

type EventHandler = (data: EventData) => void

export class EventEmitter {
  private handlers: Map<AgentEvent | '*', Set<EventHandler>> = new Map()
  private history: EventData[] = []
  private sessionId: string

  constructor(sessionId: string = 'default') {
    this.sessionId = sessionId
  }

  emit(event: AgentEvent, data: unknown): void {
    const eventData: EventData = {
      timestamp: Date.now(),
      event,
      data,
      sessionId: this.sessionId,
    }

    this.history.push(eventData)

    // 触发特定事件处理器
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(eventData))
    }

    // 触发通配符处理器
    const wildcardHandlers = this.handlers.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(eventData))
    }
  }

  on(event: AgentEvent | '*', handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
  }

  off(event: AgentEvent | '*', handler: EventHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  getHistory(): EventData[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
  }
}
```

- [ ] **Step 2: 创建 events/index.ts**

```typescript
export { EventEmitter } from './emitter'
```

- [ ] **Step 3: 创建测试文件 tests/events.test.ts**

```typescript
import { describe, test, expect } from 'bun:test'
import { EventEmitter } from '../src/events'

describe('EventEmitter', () => {
  test('should emit and receive events', () => {
    const emitter = new EventEmitter('test-session')
    const received: string[] = []

    emitter.on('start', (data) => {
      received.push(`start:${JSON.stringify(data)}`)
    })

    emitter.emit('start', { message: 'test' })

    expect(received.length).toBe(1)
    expect(received[0]).toContain('start:')
  })

  test('should support wildcard handlers', () => {
    const emitter = new EventEmitter('test-session')
    const received: string[] = []

    emitter.on('*', (data) => {
      received.push(data.event)
    })

    emitter.emit('start', {})
    emitter.emit('complete', {})

    expect(received).toEqual(['start', 'complete'])
  })

  test('should record history', () => {
    const emitter = new EventEmitter('test-session')
    emitter.emit('start', { data: 1 })
    emitter.emit('complete', { data: 2 })

    const history = emitter.getHistory()
    expect(history.length).toBe(2)
    expect(history[0].event).toBe('start')
    expect(history[1].event).toBe('complete')
  })

  test('should include sessionId in events', () => {
    const emitter = new EventEmitter('my-session-id')
    emitter.emit('start', {})

    const history = emitter.getHistory()
    expect(history[0].sessionId).toBe('my-session-id')
  })
})
```

- [ ] **Step 4: 运行测试验证**

```bash
cd simple-agent && bun test tests/events.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add simple-agent/src/events simple-agent/tests/events.test.ts
git commit -m "feat: implement EventEmitter for observability"
```

---

## Phase 3: 存储系统

### Task 4: 实现 JSON 会话存储

**Files:**
- Create: `simple-agent/src/storage/json.ts`
- Create: `simple-agent/src/storage/index.ts`
- Create: `simple-agent/tests/storage.test.ts`

- [ ] **Step 1: 创建 storage/json.ts**

```typescript
import { writeFile, readFile, mkdir, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import type { Session, SessionMeta, SessionStorage } from '../types'

export class JsonSessionStorage implements SessionStorage {
  constructor(private storageDir: string = './sessions') {}

  private getFilePath(sessionId: string): string {
    return `${this.storageDir}/${sessionId}.json`
  }

  async save(session: Session): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true })
    }
    const filePath = this.getFilePath(session.id)
    await writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8')
  }

  async load(sessionId: string): Promise<Session | null> {
    const filePath = this.getFilePath(sessionId)
    if (!existsSync(filePath)) {
      return null
    }
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as Session
  }

  async list(): Promise<SessionMeta[]> {
    if (!existsSync(this.storageDir)) {
      return []
    }
    const files = await readdir(this.storageDir)
    const sessions: SessionMeta[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const sessionId = file.replace('.json', '')
      const session = await this.load(sessionId)
      if (session) {
        sessions.push({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messages.length,
        })
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async delete(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }
  }
}
```

- [ ] **Step 2: 创建 storage/index.ts**

```typescript
export { JsonSessionStorage } from './json'
```

- [ ] **Step 3: 创建测试 tests/storage.test.ts**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { JsonSessionStorage } from '../src/storage'
import { mkdir, rm } from 'fs/promises'

const TEST_DIR = './test-sessions'

describe('JsonSessionStorage', () => {
  let storage: JsonSessionStorage

  beforeAll(async () => {
    storage = new JsonSessionStorage(TEST_DIR)
  })

  afterAll(async () => {
    await rm(TEST_DIR, { force: true, recursive: true })
  })

  test('should save and load session', async () => {
    const session = {
      id: 'test-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: { provider: 'openai', model: 'gpt-4o', tools: [] },
      messages: [{ role: 'user', content: 'hello' }],
      events: [],
    }

    await storage.save(session)
    const loaded = await storage.load('test-1')

    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe('test-1')
    expect(loaded!.messages.length).toBe(1)
  })

  test('should return null for non-existent session', async () => {
    const result = await storage.load('non-existent')
    expect(result).toBeNull()
  })

  test('should list sessions', async () => {
    await storage.save({
      id: 'test-2',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: { provider: 'openai', model: 'gpt-4o', tools: [] },
      messages: [],
      events: [],
    })

    const list = await storage.list()
    expect(list.length).toBeGreaterThanOrEqual(2)
  })

  test('should delete session', async () => {
    await storage.delete('test-1')
    const result = await storage.load('test-1')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 4: 运行测试验证**

```bash
cd simple-agent && bun test tests/storage.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add simple-agent/src/storage simple-agent/tests/storage.test.ts
git commit -m "feat: implement JsonSessionStorage for session persistence"
```

---

## Phase 4: LLM 抽象层

### Task 5: 实现 LLM Provider 抽象接口

**Files:**
- Create: `simple-agent/src/llm/types.ts`
- Create: `simple-agent/src/llm/base.ts`
- Create: `simple-agent/src/llm/index.ts`

- [ ] **Step 1: 创建 llm/types.ts**

```typescript
import type { Message, ToolDefinition } from '../types'

export interface ChatOptions {
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | { type: 'function'; name: string }
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatResponse {
  content: string
  reasoning?: string
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[]
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface LLMProvider {
  readonly name: string
  readonly model: string
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>
  supportsTools(): boolean
}
```

- [ ] **Step 2: 创建 llm/base.ts**

```typescript
import type { Message, ToolDefinition } from '../types'
import type { ChatOptions, ChatResponse, LLMProvider } from './types'

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string
  abstract readonly model: string
  abstract supportsTools(): boolean

  abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>

  protected abstract extractContent(response: unknown): string
  protected abstract extractToolCalls(response: unknown): ChatResponse['toolCalls']
  protected abstract extractUsage(response: unknown): ChatResponse['usage']
}
```

- [ ] **Step 3: 创建 llm/index.ts**

```typescript
export * from './types'
export * from './base'
export { OpenAIProvider } from './openai'
export { AnthropicProvider } from './anthropic'
```

- [ ] **Step 4: Commit**

```bash
git add simple-agent/src/llm
git commit -m "feat: implement LLM provider abstraction layer"
```

---

### Task 6: 实现 OpenAI Provider

**Files:**
- Create: `simple-agent/src/llm/openai.ts`
- Create: `simple-agent/tests/llm.test.ts`

- [ ] **Step 1: 创建 llm/openai.ts**

```typescript
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { Message, ToolDefinition } from '../types'
import type { ChatOptions, ChatResponse } from './types'
import { BaseLLMProvider } from './base'

export class OpenAIProvider extends BaseLLMProvider {
  readonly name = 'openai'
  private apiKey: string
  private baseURL?: string
  private modelId: string

  constructor(model: string, apiKey: string, baseURL?: string) {
    super()
    this.modelId = model
    this.apiKey = apiKey
    this.baseURL = baseURL
  }

  get model(): string {
    return this.modelId
  }

  supportsTools(): boolean {
    return true
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const openai = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    })

    const tools = options?.tools?.reduce((acc, tool) => {
      acc[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
      }
      return acc
    }, {} as Record<string, { description: string; parameters: unknown }>)

    const result = await generateText({
      model: openai(this.modelId),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools,
      toolChoice: options?.toolChoice as 'auto' | 'none' | undefined,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    })

    let content = ''
    let toolCalls: ChatResponse['toolCalls'] = []

    for (const item of result.finishReason === 'tool-calls' ? result.toolCalls || [] : []) {
      toolCalls.push({
        id: item.id,
        name: item.name,
        arguments: item.args as Record<string, unknown>,
      })
    }

    if (result.text) {
      content = result.text
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: result.usage
        ? {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
          }
        : undefined,
    }
  }
}
```

- [ ] **Step 3: 创建测试 tests/llm.test.ts**

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'
import { OpenAIProvider } from '../src/llm/openai'

// Mock environment for tests
const TEST_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

describe('OpenAIProvider', () => {
  test('should create provider with correct name and model', () => {
    const provider = new OpenAIProvider('gpt-4o', TEST_API_KEY)
    expect(provider.name).toBe('openai')
    expect(provider.model).toBe('gpt-4o')
  })

  test('should support tools', () => {
    const provider = new OpenAIProvider('gpt-4o', TEST_API_KEY)
    expect(provider.supportsTools()).toBe(true)
  })

  test('should work with baseURL for compatible providers', () => {
    const provider = new OpenAIProvider('gpt-4o', TEST_API_KEY, 'https://api.openai.com/v1')
    expect(provider.name).toBe('openai')
    expect(provider.model).toBe('gpt-4o')
  })
})
```

- [ ] **Step 4: Commit**

```bash
git add simple-agent/src/llm/openai.ts simple-agent/tests/llm.test.ts
git commit -m "feat: implement OpenAI provider with Vercel AI SDK"
```

---

### Task 7: 实现 Anthropic Provider

**Files:**
- Create: `simple-agent/src/llm/anthropic.ts`

- [ ] **Step 1: 创建 anthropic.ts**

```typescript
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { Message } from '../types'
import type { ChatOptions, ChatResponse } from './types'
import { BaseLLMProvider } from './base'

export class AnthropicProvider extends BaseLLMProvider {
  readonly name = 'anthropic'
  private apiKey: string
  private modelId: string

  constructor(model: string, apiKey: string) {
    super()
    this.modelId = model
    this.apiKey = apiKey
  }

  get model(): string {
    return this.modelId
  }

  supportsTools(): boolean {
    return true
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const anthropic = createAnthropic({
      apiKey: this.apiKey,
    })

    const tools = options?.tools?.reduce((acc, tool) => {
      acc[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
      }
      return acc
    }, {} as Record<string, { description: string; parameters: unknown }>)

    const result = await generateText({
      model: anthropic(this.modelId),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools,
      toolChoice: options?.toolChoice as 'auto' | 'none' | undefined,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    })

    let content = ''
    let toolCalls: ChatResponse['toolCalls'] = []

    for (const item of result.finishReason === 'tool-calls' ? result.toolCalls || [] : []) {
      toolCalls.push({
        id: item.id,
        name: item.name,
        arguments: item.args as Record<string, unknown>,
      })
    }

    if (result.text) {
      content = result.text
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: result.usage
        ? {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
          }
        : undefined,
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add simple-agent/src/llm/anthropic.ts
git commit -m "feat: implement Anthropic provider with Vercel AI SDK"
```

---

### Task 8: 创建 Provider 工厂函数

**Files:**
- Modify: `simple-agent/src/llm/index.ts`

- [ ] **Step 1: 更新 llm/index.ts 添加工厂函数**

```typescript
import type { AgentConfig } from '../types'
import type { LLMProvider } from './types'
import { BaseLLMProvider } from './base'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'

export * from './types'
export * from './base'
export { OpenAIProvider } from './openai'
export { AnthropicProvider } from './anthropic'

export function createLLMProvider(config: {
  provider: AgentConfig['provider']
  model: string
  apiKey?: string
  baseURL?: string
}): LLMProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI provider requires apiKey')
      }
      return new OpenAIProvider(config.model, config.apiKey, config.baseURL)
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('Anthropic provider requires apiKey')
      }
      return new AnthropicProvider(config.model, config.apiKey)
    case 'openai-compatible':
      if (!config.apiKey || !config.baseURL) {
        throw new Error('openai-compatible provider requires apiKey and baseURL')
      }
      return new OpenAIProvider(config.model, config.apiKey, config.baseURL)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add simple-agent/src/llm/index.ts
git commit -m "feat: add LLM provider factory function"
```

---

## Phase 5: 工具系统

### Task 9: 实现工具注册表

**Files:**
- Create: `simple-agent/src/tools/registry.ts`
- Create: `simple-agent/src/tools/index.ts`

- [ ] **Step 1: 创建 tools/registry.ts**

```typescript
import type { Tool, ToolDefinition, ToolContext, ToolResult } from '../types'

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return Array.from(this.tools.values())
  }

  getDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.zodToParameters(tool.parameters),
    }))
  }

  private zodToParameters(schema: unknown): ToolDefinition['parameters'] {
    // Extract parameters from Zod schema for LLM
    // This is a simplified version - full implementation would parse Zod schema
    const schemaObj = schema as { shape?: () => Record<string, unknown> }
    if (schemaObj.shape) {
      const shape = schemaObj.shape()
      const properties: Record<string, { type: string; description?: string }> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(shape)) {
        const valueObj = value as { description?: string; _def?: { typeName?: string } }
        properties[key] = {
          type: valueObj._def?.typeName?.toLowerCase() || 'string',
          description: valueObj.description,
        }
        required.push(key)
      }

      return {
        type: 'object',
        properties,
        required,
      }
    }

    return {
      type: 'object',
      properties: {},
      required: [],
    }
  }

  async execute(name: string, params: unknown, context: ToolContext): Promise<ToolResult> {
    const tool = this.get(name)
    if (!tool) {
      return {
        toolCallId: context.sessionId,
        success: false,
        error: `Tool not found: ${name}`,
      }
    }

    try {
      const result = await tool.execute(params, context)
      return result
    } catch (error) {
      return {
        toolCallId: context.sessionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
```

- [ ] **Step 2: 创建 tools/index.ts**

```typescript
export { ToolRegistry } from './registry'
export { BashTool } from './bash'
export { ReadTool } from './read'
export { WriteTool } from './write'
```

- [ ] **Step 3: Commit**

```bash
git add simple-agent/src/tools/registry.ts simple-agent/src/tools/index.ts
git commit -m "feat: implement ToolRegistry for tool management"
```

---

### Task 10: 实现内置工具（Bash, Read, Write）

**Files:**
- Create: `simple-agent/src/tools/bash.ts`
- Create: `simple-agent/src/tools/read.ts`
- Create: `simple-agent/src/tools/write.ts`

- [ ] **Step 1: 创建 tools/bash.ts**

```typescript
import { z } from 'zod'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { Tool, ToolContext, ToolResult } from '../types'

const execAsync = promisify(exec)

export const BashTool: Tool = {
  name: 'bash',
  description: 'Execute a shell command in the specified directory',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    cwd: z.string().optional().describe('Working directory (defaults to context cwd)'),
  }),

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { command, cwd = context.cwd } = params as { command: string; cwd?: string }

    try {
      const { stdout, stderr } = await execAsync(command, { cwd })
      return {
        toolCallId: context.sessionId,
        success: true,
        result: {
          stdout,
          stderr,
          exitCode: 0,
        },
      }
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; code?: number }
      return {
        toolCallId: context.sessionId,
        success: false,
        error: err.stderr || err.message || String(error),
        result: {
          stdout: err.stdout,
          stderr: err.stderr,
          exitCode: err.code || 1,
        },
      }
    }
  },
}
```

- [ ] **Step 2: 创建 tools/read.ts**

```typescript
import { z } from 'zod'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { Tool, ToolContext, ToolResult } from '../types'

export const ReadTool: Tool = {
  name: 'read',
  description: 'Read the contents of a file',
  parameters: z.object({
    path: z.string().describe('The file path to read'),
    lines: z.number().optional().describe('Maximum number of lines to read'),
  }),

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { path, lines } = params as { path: string; lines?: number }

    try {
      if (!existsSync(path)) {
        return {
          toolCallId: context.sessionId,
          success: false,
          error: `File not found: ${path}`,
        }
      }

      let content = await readFile(path, 'utf-8')

      if (lines !== undefined) {
        const allLines = content.split('\n')
        content = allLines.slice(0, lines).join('\n')
      }

      return {
        toolCallId: context.sessionId,
        success: true,
        result: {
          path,
          content,
          lineCount: content.split('\n').length,
        },
      }
    } catch (error) {
      return {
        toolCallId: context.sessionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
```

- [ ] **Step 3: 创建 tools/write.ts**

```typescript
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import type { Tool, ToolContext, ToolResult } from '../types'

export const WriteTool: Tool = {
  name: 'write',
  description: 'Write content to a file (creates or overwrites)',
  parameters: z.object({
    path: z.string().describe('The file path to write'),
    content: z.string().describe('The content to write to the file'),
  }),

  async execute(params: unknown, context: ToolContext): Promise<ToolResult> {
    const { path, content } = params as { path: string; content: string }

    try {
      // Ensure directory exists
      const dir = dirname(path)
      await mkdir(dir, { recursive: true })

      await writeFile(path, content, 'utf-8')

      return {
        toolCallId: context.sessionId,
        success: true,
        result: {
          path,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
        },
      }
    } catch (error) {
      return {
        toolCallId: context.sessionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
```

- [ ] **Step 4: Commit**

```bash
git add simple-agent/src/tools/bash.ts simple-agent/src/tools/read.ts simple-agent/src/tools/write.ts
git commit -m "feat: implement built-in tools (Bash, Read, Write)"
```

---

### Task 11: 创建工具测试

**Files:**
- Create: `simple-agent/tests/tools.test.ts`

- [ ] **Step 1: 创建 tests/tools.test.ts**

```typescript
import { describe, test, expect } from 'bun:test'
import { ToolRegistry, BashTool, ReadTool, WriteTool } from '../src/tools'
import { writeFile, unlink } from 'fs/promises'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  test('should register and retrieve tools', () => {
    registry.register(BashTool)
    const tool = registry.get('bash')
    expect(tool).toBeDefined()
    expect(tool!.name).toBe('bash')
  })

  test('should list all registered tools', () => {
    registry.register(BashTool)
    registry.register(ReadTool)
    registry.register(WriteTool)

    const tools = registry.list()
    expect(tools.length).toBe(3)
  })

  test('should throw when registering duplicate tool', () => {
    registry.register(BashTool)
    expect(() => registry.register(BashTool)).toThrow('Tool already registered')
  })

  test('should get tool definitions for LLM', () => {
    registry.register(BashTool)
    const defs = registry.getDefinitions()

    expect(defs.length).toBe(1)
    expect(defs[0].name).toBe('bash')
    expect(defs[0].parameters.type).toBe('object')
  })
})

describe('Built-in Tools', () => {
  test('ReadTool should read file', async () => {
    await writeFile('/tmp/test-read.txt', 'Hello World', 'utf-8')

    const context = { cwd: '/tmp', sessionId: 'test' }
    const result = await ReadTool.execute({ path: '/tmp/test-read.txt' }, context)

    expect(result.success).toBe(true)
    expect(result.result).toBeDefined()
    expect((result.result as { content: string }).content).toBe('Hello World')

    await unlink('/tmp/test-read.txt')
  })

  test('WriteTool should write file', async () => {
    const context = { cwd: '/tmp', sessionId: 'test' }
    const result = await WriteTool.execute(
      { path: '/tmp/test-write.txt', content: 'Test Content' },
      context
    )

    expect(result.success).toBe(true)
    await unlink('/tmp/test-write.txt')
  })

  test('BashTool should execute command', async () => {
    const context = { cwd: '/tmp', sessionId: 'test' }
    const result = await BashTool.execute({ command: 'echo "hello"' }, context)

    expect(result.success).toBe(true)
    expect((result.result as { stdout: string }).stdout).toContain('hello')
  })
})
```

- [ ] **Step 2: 运行测试验证**

```bash
cd simple-agent && bun test tests/tools.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add simple-agent/tests/tools.test.ts
git commit -m "test: add tool system tests"
```

---

## Phase 6: MCP 集成

### Task 12: 实现 MCP 传输层

**Files:**
- Create: `simple-agent/src/mcp/transport/stdio.ts`
- Create: `simple-agent/src/mcp/transport/streamable-http.ts`
- Create: `simple-agent/src/mcp/transport/index.ts`

- [ ] **Step 1: 创建 transport/stdio.ts**

```typescript
import { spawn, ChildProcess } from 'child_process'
import type { MCPConfig } from '../types'

export interface StdioTransport {
  send(message: unknown): void
  close(): void
  onMessage(handler: (message: unknown) => void): void
  onError(handler: (error: Error) => void): void
  onClose(handler: () => void): void
}

export function createStdioTransport(config: MCPConfig): StdioTransport {
  let process: ChildProcess | null = null
  let messageHandler: ((message: unknown) => void) | null = null
  let errorHandler: ((error: Error) => void) | null = null
  let closeHandler: (() => void) | null = null
  let buffer = ''

  const send = (message: unknown): void => {
    if (process && process.stdin) {
      process.stdin.write(JSON.stringify(message) + '\n')
    }
  }

  const close = (): void => {
    if (process) {
      process.kill()
      process = null
    }
  }

  const handleData = (data: Buffer): void => {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line)
          messageHandler?.(message)
        } catch {
          // Ignore parse errors for now
        }
      }
    }
  }

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const command = config.command || 'npx'
      const args = config.args || []

      process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env },
      })

      process.on('error', (err) => {
        errorHandler?.(err)
        reject(err)
      })

      process.on('close', (code) => {
        closeHandler?.()
        if (code !== 0 && code !== null) {
          errorHandler?.(new Error(`Process exited with code ${code}`))
        }
      })

      process.stdout?.on('data', handleData)
      process.stderr?.on('data', (data) => {
        // Log stderr for debugging
        console.error('[MCP Stderr]', data.toString())
      })

      // Initialize MCP protocol
      const initialize = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'simple-agent', version: '0.1.0' },
        },
      }

      process.stdin?.write(JSON.stringify(initialize) + '\n')

      // Simple timeout for initialization
      setTimeout(resolve, 1000)
    })
  }

  return {
    send,
    close,
    onMessage: (handler) => {
      messageHandler = handler
    },
    onError: (handler) => {
      errorHandler = handler
    },
    onClose: (handler) => {
      closeHandler = handler
    },
    connect,
  }
}
```

- [ ] **Step 2: 创建 transport/streamable-http.ts**

```typescript
import type { MCPConfig } from '../types'

export interface StreamableHTTPTransport {
  send(message: unknown): void
  close(): void
  onMessage(handler: (message: unknown) => void): void
  onError(handler: (error: Error) => void): void
  onClose(handler: () => void): void
}

export function createStreamableHTTPTransport(config: MCPConfig): StreamableHTTPTransport {
  let abortController: AbortController | null = null
  let messageHandler: ((message: unknown) => void) | null = null
  let errorHandler: ((error: Error) => void) | null = null
  let closeHandler: (() => void) | null = null

  const send = async (message: unknown): Promise<void> => {
    if (!config.url) return

    abortController = new AbortController()

    try {
      const response = await fetch(config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(message),
        signal: abortController.signal,
      })

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                messageHandler?.(data)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } else {
        const data = await response.json()
        messageHandler?.(data)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        errorHandler?.(err as Error)
      }
    }
  }

  const close = (): void => {
    abortController?.abort()
  }

  return {
    send,
    close,
    onMessage: (handler) => {
      messageHandler = handler
    },
    onError: (handler) => {
      errorHandler = handler
    },
    onClose: (handler) => {
      closeHandler = handler
    },
  }
}
```

- [ ] **Step 3: 创建 transport/index.ts**

```typescript
export { createStdioTransport, type StdioTransport } from './stdio'
export { createStreamableHTTPTransport, type StreamableHTTPTransport } from './streamable-http'
```

- [ ] **Step 4: Commit**

```bash
git add simple-agent/src/mcp/transport
git commit -m "feat: implement MCP transport layer (stdio, streamable-http)"
```

---

### Task 13: 实现 MCP 客户端

**Files:**
- Create: `simple-agent/src/mcp/types.ts`
- Create: `simple-agent/src/mcp/tool.ts`
- Create: `simple-agent/src/mcp/client.ts`
- Create: `simple-agent/src/mcp/index.ts`

- [ ] **Step 1: 创建 mcp/types.ts**

```typescript
import type { Tool } from '../types'

export interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

export interface MCPConnection {
  name: string
  status: 'connected' | 'disconnected' | 'failed'
  tools: MCPTool[]
  error?: string
}

export interface MCPRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

export interface MCPResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: { code: number; message: string }
}
```

- [ ] **Step 2: 创建 mcp/tool.ts**

```typescript
import { z } from 'zod'
import type { MCPTool, MCPClient } from './types'
import type { Tool } from '../types'

export function convertMcpTool(mcpTool: MCPTool, client: MCPClient): Tool {
  // Convert MCP tool schema to Zod schema
  const properties: Record<string, z.ZodTypeAny> = {}
  const required: string[] = mcpTool.inputSchema.required || []

  if (mcpTool.inputSchema.properties) {
    for (const [key, value] of Object.entries(mcpTool.inputSchema.properties)) {
      let schema: z.ZodTypeAny

      switch (value.type) {
        case 'string':
          schema = z.string().describe(value.description || '')
          break
        case 'number':
          schema = z.number().describe(value.description || '')
          break
        case 'boolean':
          schema = z.boolean().describe(value.description || '')
          break
        case 'array':
          schema = z.array(z.any()).describe(value.description || '')
          break
        case 'object':
          schema = z.record(z.any()).describe(value.description || '')
          break
        default:
          schema = z.any().describe(value.description || '')
      }

      if (!required.includes(key)) {
        schema = schema.optional()
      }

      properties[key] = schema
    }
  }

  return {
    name: mcpTool.name,
    description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
    parameters: z.object(properties),
    execute: async (params: unknown, context: ToolContext) => {
      const result = await client.callTool(mcpTool.name, params as Record<string, unknown>)
      return {
        toolCallId: context.sessionId,
        success: true,
        result,
      }
    },
  }
}
```

- [ ] **Step 3: 创建 mcp/client.ts**

```typescript
import type { MCPConfig, Tool, ToolContext, ToolResult, MCPStatus } from '../types'
import type { MCPTool, MCPConnection } from './types'
import { createStdioTransport } from './transport/stdio'
import { createStreamableHTTPTransport } from './transport/streamable-http'
import { convertMcpTool } from './tool'

export class MCPClient {
  private connections: Map<string, MCPConnection> = new Map()
  private transports: Map<string, { send: (msg: unknown) => void; close: () => void }> = new Map()
  private requestId = 0
  private pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map()

  async connect(config: MCPConfig): Promise<void> {
    const transport =
      config.transport === 'stdio'
        ? createStdioTransport(config)
        : createStreamableHTTPTransport(config)

    transport.onMessage((message) => this.handleMessage(message))
    transport.onError((error) => console.error('[MCP Error]', error))
    transport.onClose(() => {
      const conn = this.connections.get(config.name)
      if (conn) {
        conn.status = 'disconnected'
      }
    })

    if ('connect' in transport) {
      await (transport as { connect: () => Promise<void> }).connect()
    }

    // Send initialize request
    const response = await this.sendRequest(config.name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'simple-agent', version: '0.1.0' },
    })

    // Get tools list
    const toolsResponse = await this.sendRequest(config.name, 'tools/list', {})

    this.connections.set(config.name, {
      name: config.name,
      status: 'connected',
      tools: (toolsResponse as { tools?: MCPTool[] })?.tools || [],
    })

    this.transports.set(config.name, transport)
  }

  async disconnect(name: string): Promise<void> {
    const transport = this.transports.get(name)
    if (transport) {
      transport.close()
      this.transports.delete(name)
    }
    this.connections.delete(name)
  }

  async listTools(): Promise<Tool[]> {
    const tools: Tool[] = []

    for (const [name, conn] of this.connections) {
      if (conn.status === 'connected') {
        for (const mcpTool of conn.tools) {
          tools.push(convertMcpTool(mcpTool, this))
        }
      }
    }

    return tools
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const parts = name.split(':')
    const serverName = parts.length > 1 ? parts[0] : Array.from(this.connections.keys())[0]
    const toolName = parts.length > 1 ? parts[1] : name

    const response = await this.sendRequest(serverName, 'tools/call', {
      name: toolName,
      arguments: args,
    })

    return response
  }

  getStatus(name: string): MCPStatus {
    const conn = this.connections.get(name)
    if (!conn) {
      return { status: 'failed', error: 'Not connected' }
    }

    if (conn.status === 'connected') {
      return { status: 'connected' }
    } else if (conn.status === 'failed') {
      return { status: 'failed', error: conn.error || 'Unknown error' }
    }

    return { status: 'disconnected' }
  }

  private async sendRequest(serverName: string, method: string, params: Record<string, unknown>): Promise<unknown> {
    const transport = this.transports.get(serverName)
    if (!transport) {
      throw new Error(`MCP server not connected: ${serverName}`)
    }

    const id = ++this.requestId

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      transport.send({
        jsonrpc: '2.0',
        id,
        method,
        params,
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, 30000)
    })
  }

  private handleMessage(message: unknown): void {
    const msg = message as { id?: number | string; result?: unknown; error?: { code: number; message: string } }

    if (msg.id && this.pendingRequests.has(msg.id as number)) {
      const pending = this.pendingRequests.get(msg.id as number)!
      this.pendingRequests.delete(msg.id as number)

      if (msg.error) {
        pending.reject(new Error(msg.error.message))
      } else {
        pending.resolve(msg.result)
      }
    }
  }
}
```

- [ ] **Step 4: 创建 mcp/index.ts**

```typescript
export { MCPClient } from './client'
export * from './types'
export { convertMcpTool } from './tool'
```

- [ ] **Step 5: Commit**

```bash
git add simple-agent/src/mcp
git commit -m "feat: implement MCP client with stdio and streamable-http transport"
```

---

## Phase 7: Agent 核心

### Task 14: 实现 Agent 主类

**Files:**
- Create: `simple-agent/src/agent/agent.ts`
- Create: `simple-agent/src/agent/loop.ts`
- Create: `simple-agent/src/agent/step.ts`
- Create: `simple-agent/src/agent/index.ts`

- [ ] **Step 1: 创建 agent/agent.ts**

```typescript
import type { AgentConfig, Message, StepResult, ToolContext } from '../types'
import { EventEmitter } from '../events'
import { ToolRegistry } from '../tools'
import { createLLMProvider } from '../llm'
import { MCPClient } from '../mcp'
import { stepMode } from './step'
import { loopMode } from './loop'

export class Agent {
  private _config: AgentConfig
  private llm
  private tools: ToolRegistry
  private events: EventEmitter
  private mcp: MCPClient
  private sessionId: string

  constructor(config: AgentConfig) {
    // Initialize config first
    this._config = {
      maxIterations: 10,
      ...config,
    }

    // Initialize LLM with config (after config is set)
    this.llm = createLLMProvider({
      provider: this._config.provider,
      model: this._config.model,
      apiKey: this._config.apiKey,
      baseURL: this._config.baseURL,
    })

    // Initialize other properties
    this.tools = new ToolRegistry()
    this.events = new EventEmitter()
    this.mcp = new MCPClient()
    this.sessionId = crypto.randomUUID()

    // Register tools
    for (const tool of this._config.tools) {
      this.tools.register(tool)
    }

    // Connect MCP servers if configured
    if (this._config.mcpServers) {
      this.connectMCP(this._config.mcpServers)
    }
  }

  get config(): AgentConfig {
    return this._config
  }

  async connectMCP(configs: Parameters<typeof this.mcp.connect extends (config: infer P) => Promise<void> ? P : never>[]): Promise<void> {
    for (const config of configs) {
      try {
        await this.mcp.connect(config as any)
        this.events.emit('mcp_connect', { name: (config as any).name })
      } catch (error) {
        this.events.emit('error', { error, context: 'mcp_connect' })
      }
    }
  }

  async *run(messages: Message[], mode: 'step' | 'loop'): AsyncGenerator<StepResult> {
    const toolContext: ToolContext = {
      cwd: process.cwd(),
      sessionId: this.sessionId,
    }

    if (mode === 'step') {
      yield* stepMode(this, messages, toolContext)
    } else {
      yield* loopMode(this, messages, toolContext)
    }
  }

  on(event: string, handler: (data: unknown) => void): void {
    this.events.on(event as any, handler as any)
  }

  emit(event: string, data: unknown): void {
    this.events.emit(event as any, data)
  }

  getTools(): ToolRegistry {
    return this.tools
  }

  getLLM() {
    return this.llm
  }

  getMCP(): MCPClient {
    return this.mcp
  }

  getEvents(): EventEmitter {
    return this.events
  }

  getSessionId(): string {
    return this.sessionId
  }
}
```

- [ ] **Step 2: 创建 agent/step.ts**

```typescript
import type { Agent } from './agent'
import type { Message, StepResult, ToolContext } from '../types'

export async function* stepMode(
  agent: Agent,
  messages: Message[],
  context: ToolContext
): AsyncGenerator<StepResult> {
  agent.emit('step_start', { iteration: 1 })

  // Add MCP tools if available (register them first)
  try {
    const mcpTools = await agent.getMCP().listTools()
    for (const tool of mcpTools) {
      if (!agent.getTools().get(tool.name)) {
        agent.getTools().register(tool)
      }
    }
  } catch {
    // Ignore MCP errors in step mode
  }

  // Get tool definitions (including MCP tools)
  const toolDefs = agent.getTools().getDefinitions()

  // Build system message with tools
  const systemMessage = agent.config.systemPrompt || 'You are a helpful AI assistant.'

  // Add system message at the beginning
  const allMessages = [
    { role: 'system' as const, content: systemMessage },
    ...messages,
  ]

  agent.emit('llm_request', {
    model: agent.getLLM().model,
    messageCount: allMessages.length,
  })

  // Call LLM
  const response = await agent.getLLM().chat(allMessages, {
    tools: toolDefs,
    toolChoice: 'auto',
  })

  agent.emit('llm_response', {
    content: response.content,
    toolCalls: response.toolCalls,
    usage: response.usage,
  })

  // If no tool calls, return the message
  if (!response.toolCalls || response.toolCalls.length === 0) {
    const assistantMessage: Message = {
      role: 'assistant',
      content: response.content,
    }
    messages.push(assistantMessage)

    agent.emit('step_complete', { assistantMessage })
    agent.emit('complete', { messages })

    yield {
      type: 'message',
      content: response.content,
    }
    return
  }

  // Handle tool calls
  for (const toolCall of response.toolCalls) {
    yield {
      type: 'tool_call',
      content: null,
      metadata: {
        toolName: toolCall.name,
        toolArgs: toolCall.arguments,
      },
    }

    const result = await agent.getTools().execute(
      toolCall.name,
      toolCall.arguments,
      context
    )

    yield {
      type: 'tool_result',
      content: result,
      metadata: {
        toolName: toolCall.name,
      },
    }

    // Add tool result as assistant message with tool call
    messages.push({
      role: 'assistant',
      content: '',
      toolCalls: [toolCall],
    })

    // Add tool result as a separate user message
    messages.push({
      role: 'user',
      content: JSON.stringify(result),
    })
  }

  agent.emit('step_complete', { messageCount: messages.length })
}
```

- [ ] **Step 3: 创建 agent/loop.ts**

```typescript
import type { Agent } from './agent'
import type { Message, StepResult, ToolContext } from '../types'

export async function* loopMode(
  agent: Agent,
  messages: Message[],
  context: ToolContext
): AsyncGenerator<StepResult> {
  const maxIterations = agent.config.maxIterations || 10

  agent.emit('start', { messageCount: messages.length })

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    agent.emit('step_start', { iteration })

    // Add MCP tools dynamically
    try {
      const mcpTools = await agent.getMCP().listTools()
      for (const tool of mcpTools) {
        if (!agent.getTools().get(tool.name)) {
          agent.getTools().register(tool)
        }
      }
    } catch {
      // Continue without MCP tools if unavailable
    }

    // Get tool definitions (including newly registered MCP tools)
    const toolDefs = agent.getTools().getDefinitions()

    // Build system message with tools
    const systemMessage = agent.config.systemPrompt || 'You are a helpful AI assistant.'

    // Build messages with system message at the beginning
    const allMessages = [
      { role: 'system' as const, content: systemMessage },
      ...messages,
    ]

    agent.emit('llm_request', {
      model: agent.getLLM().model,
      messageCount: allMessages.length,
      iteration,
    })

    try {
      // Call LLM
      const response = await agent.getLLM().chat(allMessages, {
        tools: toolDefs,
        toolChoice: 'auto',
      })

      agent.emit('llm_response', {
        content: response.content,
        toolCalls: response.toolCalls,
        usage: response.usage,
        iteration,
      })

      // If no tool calls, return the message and finish
      if (!response.toolCalls || response.toolCalls.length === 0) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
        }
        messages.push(assistantMessage)

        agent.emit('step_complete', { iteration, assistantMessage })
        agent.emit('complete', { messages, iteration })

        yield {
          type: 'message',
          content: response.content,
        }
        return
      }

      // Handle tool calls
      for (const toolCall of response.toolCalls) {
        agent.emit('tool_call', {
          toolName: toolCall.name,
          arguments: toolCall.arguments,
          iteration,
        })

        const result = await agent.getTools().execute(
          toolCall.name,
          toolCall.arguments,
          context
        )

        agent.emit('tool_result', {
          toolName: toolCall.name,
          success: result.success,
          result: result.result,
          error: result.error,
          iteration,
        })

        yield {
          type: 'tool_result',
          content: result,
          metadata: {
            toolName: toolCall.name,
          },
        }

        // Add tool call and result to messages
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls: [toolCall],
        })

        messages.push({
          role: 'user',
          content: JSON.stringify(result),
        })
      }

      agent.emit('step_complete', { iteration, messageCount: messages.length })
    } catch (error) {
      agent.emit('error', { error, iteration })
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
      }
      return
    }
  }

  // Max iterations reached
  agent.emit('complete', { reason: 'max_iterations', messages })
  yield {
    type: 'error',
    content: `Max iterations (${maxIterations}) reached`,
  }
}
```

- [ ] **Step 4: 创建 agent/index.ts**

```typescript
export { Agent } from './agent'
```

- [ ] **Step 5: Commit**

```bash
git add simple-agent/src/agent
git commit -m "feat: implement Agent core with step and loop modes"
```

---

## Phase 8: CLI 入口

### Task 15: 创建 CLI 入口

**Files:**
- Create: `simple-agent/src/index.ts`

- [ ] **Step 1: 创建 src/index.ts**

```typescript
import { Agent } from './agent'
import { JsonSessionStorage } from './storage'
import { ToolRegistry, BashTool, ReadTool, WriteTool } from './tools'

interface CLIArgs {
  prompt?: string
  model?: string
  provider?: 'openai' | 'anthropic' | 'openai-compatible'
  apiKey?: string
  baseURL?: string
  session?: string
  mode?: 'step' | 'loop'
  storageDir?: string
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {}
  const rawArgs = process.argv.slice(2)

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]

    switch (arg) {
      case '-p':
      case '--prompt':
        args.prompt = rawArgs[++i]
        break
      case '--model':
        args.model = rawArgs[++i]
        break
      case '--provider':
        args.provider = rawArgs[++i] as CLIArgs['provider']
        break
      case '--api-key':
        args.apiKey = rawArgs[++i]
        break
      case '--base-url':
        args.baseURL = rawArgs[++i]
        break
      case '--session':
        args.session = rawArgs[++i]
        break
      case '--mode':
        args.mode = rawArgs[++i] as 'step' | 'loop'
        break
      case '--storage-dir':
        args.storageDir = rawArgs[++i]
        break
      default:
        if (!arg.startsWith('-')) {
          args.prompt = arg
        }
    }
  }

  return args
}

async function main() {
  const args = parseArgs()

  // Get config from environment or args
  const provider = args.provider || (process.env.PROVIDER as CLIArgs['provider']) || 'openai'
  const model = args.model || process.env.MODEL || 'gpt-4o'
  const apiKey = args.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  const baseURL = args.baseURL || process.env.OPENAI_BASE_URL
  const mode = args.mode || 'loop'
  const storageDir = args.storageDir || './sessions'

  if (!args.prompt) {
    console.error('Error: --prompt is required')
    console.log('Usage: bun run src/index.ts --prompt "Your task here"')
    process.exit(1)
  }

  if (!apiKey) {
    console.error('Error: API key required. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.')
    process.exit(1)
  }

  // Initialize storage
  const storage = new JsonSessionStorage(storageDir)

  // Load session if specified
  let session = args.session ? await storage.load(args.session) : null
  const messages = session?.messages || []

  // Register tools
  const tools = new ToolRegistry()
  tools.register(BashTool)
  tools.register(ReadTool)
  tools.register(WriteTool)

  // Create agent
  const agent = new Agent({
    provider,
    model,
    apiKey,
    baseURL,
    tools: tools.list(),
    systemPrompt: 'You are a helpful AI assistant with access to tools. Use them when needed to complete tasks.',
  })

  // Bind events for logging
  agent.on('start', (data) => console.log('[EVENT] Agent started'))
  agent.on('step_start', (data) => console.log(`[EVENT] Step ${data.iteration} started`))
  agent.on('llm_request', (data) => console.log(`[EVENT] LLM Request (${data.model})`))
  agent.on('llm_response', (data) => {
    console.log(`[EVENT] LLM Response:`)
    if (data.content) {
      console.log(`  Content: ${data.content.substring(0, 100)}...`)
    }
    if (data.toolCalls) {
      console.log(`  Tool calls: ${data.toolCalls.length}`)
    }
  })
  agent.on('tool_call', (data) => {
    console.log(`[EVENT] Tool Call: ${data.toolName}`)
  })
  agent.on('tool_result', (data) => {
    console.log(`[EVENT] Tool Result: ${data.toolName} (success: ${data.success})`)
  })
  agent.on('error', (data) => console.error(`[EVENT] Error: ${data.error}`))
  agent.on('complete', (data) => console.log(`[EVENT] Agent completed`))

  // Add user message
  messages.push({ role: 'user', content: args.prompt })

  // Run agent
  console.log(`\nRunning agent in ${mode} mode...\n`)

  for await (const step of agent.run(messages, mode)) {
    switch (step.type) {
      case 'message':
        console.log('\n--- Agent Response ---\n')
        console.log(step.content)
        console.log()
        break
      case 'tool_call':
        console.log(`\n[TOOL] Calling: ${step.metadata?.toolName}`)
        console.log(`  Args: ${JSON.stringify(step.metadata?.toolArgs)}`)
        break
      case 'tool_result':
        console.log(`[TOOL] Result: ${step.metadata?.toolName}`)
        if (step.content && typeof step.content === 'object' && 'success' in step.content) {
          const result = step.content as { success: boolean; result?: unknown; error?: string }
          if (result.success) {
            console.log(`  Success: ${JSON.stringify(result.result).substring(0, 200)}...`)
          } else {
            console.log(`  Error: ${result.error}`)
          }
        }
        break
      case 'error':
        console.error('\n--- Error ---\n')
        console.error(step.content)
        console.log()
        break
      case 'complete':
        console.log('\n--- Complete ---\n')
        break
    }
  }

  // Save session
  const sessionId = session?.id || crypto.randomUUID()
  await storage.save({
    id: sessionId,
    createdAt: session?.createdAt || Date.now(),
    updatedAt: Date.now(),
    config: agent.config,
    messages,
    events: agent.getEvents().getHistory(),
  })

  console.log(`\nSession saved: ${sessionId}`)
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Commit**

```bash
git add simple-agent/src/index.ts
git commit -m "feat: add CLI entry point for simple-agent"
```

---

## Phase 9: 示例代码

### Task 16: 创建示例代码

**Files:**
- Create: `simple-agent/examples/basic.ts`
- Create: `simple-agent/examples/mcp.ts`
- Create: `simple-agent/examples/custom-tool.ts`

- [ ] **Step 1: 创建 examples/basic.ts**

```typescript
/**
 * Basic example: Using simple-agent with OpenAI
 */
import { Agent } from '../src/agent'
import { BashTool, ReadTool, WriteTool } from '../src/tools'

async function main() {
  const agent = new Agent({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
    tools: [BashTool, ReadTool, WriteTool],
  })

  // Event listeners
  agent.on('tool_call', (data) => {
    console.log(`[TOOL] Calling: ${data.toolName}`)
  })

  agent.on('tool_result', (data) => {
    console.log(`[TOOL] Result: ${data.success ? 'OK' : 'FAILED'}`)
  })

  // Run task
  const messages = [
    { role: 'user', content: 'Create a file called hello.txt with content "Hello, Agent!"' },
  ]

  console.log('Starting agent...\n')

  for await (const step of agent.run(messages, 'loop')) {
    if (step.type === 'message') {
      console.log('\nAgent:', step.content)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
```

- [ ] **Step 2: 创建 examples/mcp.ts**

```typescript
/**
 * MCP Example: Using simple-agent with MCP servers
 */
import { Agent } from '../src/agent'
import { MCPClient } from '../src/mcp'
import { BashTool } from '../src/tools'

async function main() {
  const mcpClient = new MCPClient()

  // Connect to filesystem MCP server
  console.log('Connecting to filesystem MCP server...')
  try {
    await mcpClient.connect({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    })
    console.log('Connected!')
  } catch (error) {
    console.error('Failed to connect to MCP server:', error)
    console.log('Continuing without MCP tools...')
  }

  // Get MCP tools
  const mcpTools = await mcpClient.listTools()
  console.log(`MCP Tools available: ${mcpTools.map((t) => t.name).join(', ')}`)

  // Create agent with MCP tools
  const agent = new Agent({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
    tools: [BashTool, ...mcpTools],
  })

  // Run task
  const messages = [
    { role: 'user', content: 'List the files in /tmp directory' },
  ]

  console.log('\nStarting agent...\n')

  for await (const step of agent.run(messages, 'loop')) {
    if (step.type === 'message') {
      console.log('\nAgent:', step.content)
    }
  }

  // Cleanup
  await mcpClient.disconnect('filesystem')
  console.log('\nDone!')
}

main().catch(console.error)
```

- [ ] **Step 3: 创建 examples/custom-tool.ts**

```typescript
/**
 * Custom Tool Example: Creating your own tools
 */
import { Agent } from '../src/agent'
import { z } from 'zod'
import type { Tool } from '../src/types'

// Create a custom web search tool
const WebSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().default(5).describe('Maximum results'),
  }),

  async execute(params, context) {
    const { query, limit = 5 } = params as { query: string; limit: number }

    // Simulated search results (replace with actual API)
    const results = [
      { title: `Result for "${query}" #1`, url: `https://example.com/1?q=${encodeURIComponent(query)}` },
      { title: `Result for "${query}" #2`, url: `https://example.com/2?q=${encodeURIComponent(query)}` },
    ].slice(0, limit)

    return {
      toolCallId: context.sessionId,
      success: true,
      result: { query, results, count: results.length },
    }
  },
}

// Create a custom HTTP request tool
const HttpTool: Tool = {
  name: 'http_request',
  description: 'Make an HTTP request to a URL',
  parameters: z.object({
    url: z.string().url().describe('The URL to request'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
    body: z.string().optional().describe('Request body (for POST/PUT)'),
  }),

  async execute(params, context) {
    const { url, method = 'GET', body } = params as { url: string; method: string; body?: string }

    try {
      const response = await fetch(url, {
        method,
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      const text = await response.text()

      return {
        toolCallId: context.sessionId,
        success: true,
        result: {
          status: response.status,
          statusText: response.statusText,
          body: text.substring(0, 1000),
        },
      }
    } catch (error) {
      return {
        toolCallId: context.sessionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}

async function main() {
  const agent = new Agent({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!,
    tools: [WebSearchTool, HttpTool],
  })

  // Event listeners
  agent.on('tool_call', (data) => {
    console.log(`[TOOL] Calling: ${data.toolName}`)
  })

  agent.on('tool_result', (data) => {
    console.log(`[TOOL] Result:`, JSON.stringify(data.result).substring(0, 100))
  })

  // Run task
  const messages = [
    { role: 'user', content: 'Search for "TypeScript" and tell me the first 2 results' },
  ]

  console.log('Starting agent with custom tools...\n')

  for await (const step of agent.run(messages, 'loop')) {
    if (step.type === 'message') {
      console.log('\nAgent:', step.content)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
```

- [ ] **Step 4: Commit**

```bash
git add simple-agent/examples
git commit -m "feat: add example scripts for basic, MCP, and custom tool usage"
```

---

## Phase 10: 验收测试

### Task 17: 运行完整测试

**Files:**
- Create: `simple-agent/tests/agent.test.ts`

- [ ] **Step 1: 创建 tests/agent.test.ts**

```typescript
import { describe, test, expect, beforeAll } from 'bun:test'
import { Agent } from '../src/agent'
import { BashTool, ReadTool, WriteTool } from '../src/tools'

// Skip integration tests if no API key
const SKIP_INTEGRATION = !process.env.OPENAI_API_KEY

describe('Agent', () => {
  test('should create agent with config', () => {
    const agent = new Agent({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      tools: [BashTool],
    })

    expect(agent.getSessionId()).toBeDefined()
    expect(agent.getTools().list()).toHaveLength(1)
  })

  test('should register tools', () => {
    const agent = new Agent({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      tools: [],
    })

    agent.getTools().register(ReadTool)
    expect(agent.getTools().list()).toHaveLength(1)

    agent.getTools().register(WriteTool)
    expect(agent.getTools().list()).toHaveLength(2)
  })

  test('should emit events', () => {
    const agent = new Agent({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      tools: [],
    })

    const received: string[] = []
    agent.on('start', () => received.push('start'))
    agent.on('test_event', () => received.push('test'))

    agent.emit('start', {})
    agent.emit('test_event', {})

    expect(received).toEqual(['start', 'test'])
  })

  test('should get tool definitions', () => {
    const agent = new Agent({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      tools: [BashTool, ReadTool, WriteTool],
    })

    const defs = agent.getTools().getDefinitions()
    expect(defs).toHaveLength(3)
    expect(defs.map((d) => d.name)).toEqual(['bash', 'read', 'write'])
  })
})

describe('Agent Integration', () => {
  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log('Skipping integration tests - no API key')
    }
  })

  test.skipIf(SKIP_INTEGRATION)('should complete simple task', async () => {
    const agent = new Agent({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY!,
      tools: [BashTool],
    })

    const messages = [
      { role: 'user', content: 'Say hello in one word' },
    ]

    let result = ''
    for await (const step of agent.run(messages, 'loop')) {
      if (step.type === 'message') {
        result = step.content as string
        break
      }
    }

    expect(result.toLowerCase()).toContain('hello')
  })
})
```

- [ ] **Step 2: 运行所有测试**

```bash
cd simple-agent && bun test
```

- [ ] **Step 3: Commit**

```bash
git add simple-agent/tests/agent.test.ts
git commit -m "test: add agent integration tests"
```

---

## Summary

| Phase | Task | Description |
|-------|------|-------------|
| 1 | 1-2 | 项目初始化和类型定义 |
| 2 | 3 | 事件系统 |
| 3 | 4 | 存储系统 |
| 4 | 5-8 | LLM 抽象层 |
| 5 | 9-11 | 工具系统 |
| 6 | 12-13 | MCP 集成 |
| 7 | 14 | Agent 核心 |
| 8 | 15 | CLI 入口 |
| 9 | 16 | 示例代码 |
| 10 | 17 | 验收测试 |

**Total: 17 tasks**

---

## Dependencies

- Phase 1: None
- Phase 2: None
- Phase 3: None
- Phase 4: Phase 1
- Phase 5: Phase 1, 2
- Phase 6: Phase 1, 2
- Phase 7: Phase 2, 3, 4, 5
- Phase 8: Phase 7
- Phase 9: Phase 7
- Phase 10: All
