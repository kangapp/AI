# Claude Code 工具调用详细流程

> 基于 claude-code-2.1.88 源码分析

## 1. 工具调用完整生命周期

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Tool Use Lifecycle                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. MODEL DECIDES                                                          │
│     ┌─────────────────────────────────────────────────────────────────┐      │
│     │ model.generate_content()                                        │      │
│     │   └─→ ToolUseBlock { name: "Bash", input: { command: "ls" } }  │      │
│     └─────────────────────────────────────────────────────────────────┘      │
│                                   │                                          │
│                                   ▼                                          │
│  2. PRE-TOOL USE HOOKS                                                      │
│     ┌─────────────────────────────────────────────────────────────────┐      │
│     │ PreToolUse hooks execute in sequence:                           │      │
│     │   - Each hook receives: tool_name, tool_input, hookEvent        │      │
│     │   - Hooks can: allow, block, modify input, emit message         │      │
│     │   - Blocked hooks short-circuit the chain                       │      │
│     └─────────────────────────────────────────────────────────────────┘      │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                          │
│                    ▼                             ▼                          │
│              [blocked]                      [allowed]                        │
│                    │                             │                          │
│                    ▼                             ▼                          │
│  ┌──────────────────────┐         3. PERMISSION CHECK                       │
│  │ Return blocked result │         ┌─────────────────────────────────┐      │
│  │ to model              │         │ checkPermissions(input, context)│      │
│  └──────────────────────┘         │   └─→ 'allow' | 'deny' | 'ask'  │      │
│                                    └─────────────────────────────────┘      │
│                                                       │                      │
│                                       ┌───────────────┴───────────────┐      │
│                                       ▼                               ▼      │
│                                  [denied]                        [allowed]   │
│                                       │                               │      │
│                                       ▼                               ▼      │
│  ┌──────────────────────┐         4. TOOL EXECUTION                          │
│  │ Return denied result │         ┌─────────────────────────────────┐      │
│  │ to model             │         │ tool.call(                      │      │
│  └──────────────────────┘         │   args: parsed input,          │      │
│                                    │   context: ToolUseContext,      │      │
│                                    │   canUseTool,                   │      │
│                                    │   onProgress: callback           │      │
│                                    │ ): Promise<ToolResult>          │      │
│                                    │   └─→ Output + newMessages       │      │
│                                    └─────────────────────────────────┘      │
│                                                       │                      │
│                                                       ▼                      │
│  5. POST-TOOL USE HOOKS                                                      │
│     ┌─────────────────────────────────────────────────────────────────┐      │
│     │ PostToolUse hooks execute in sequence:                          │      │
│     │   - Each hook receives: tool_name, tool_input, tool_result      │      │
│     │   - Hooks can: emit additional messages                         │      │
│     │   - Errors don't block other hooks                              │      │
│     └─────────────────────────────────────────────────────────────────┘      │
│                                   │                                          │
│                                   ▼                                          │
│  6. RESULT RENDERING                                                          │
│     ┌─────────────────────────────────────────────────────────────────┐      │
│     │ tool.renderToolResultMessage(output, progressMessages, options)  │      │
│     │   └─→ React.ReactNode (UI display)                              │      │
│     └─────────────────────────────────────────────────────────────────┘      │
│                                   │                                          │
│                                   ▼                                          │
│  7. RESPONSE TO MODEL                                                       │
│     ┌─────────────────────────────────────────────────────────────────┐      │
│     │ ToolResultBlockParam {                                         │      │
│     │   type: "tool_result",                                         │      │
│     │   content: [ { type: "text", text: output } ]                  │      │
│     │ }                                                              │      │
│     └─────────────────────────────────────────────────────────────────┘      │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. ToolUseContext 详解

```typescript
// 文件: src/Tool.ts

export type ToolUseContext = {
  // 配置选项 (在构建时确定)
  options: {
    commands: Command[]              // 可用命令列表
    debug: boolean                   // 调试模式
    mainLoopModel: string            // 主循环使用的模型
    tools: Tools                     // 工具列表
    verbose: boolean                 // 详细输出
    thinkingConfig: ThinkingConfig   // 思考配置
    mcpClients: MCPServerConnection[] // MCP 客户端
    mcpResources: Record<string, ServerResource[]>
    isNonInteractiveSession: boolean
    agentDefinitions: AgentDefinitionsResult
    maxBudgetUsd?: number
    customSystemPrompt?: string
    appendSystemPrompt?: string
    refreshTools?: () => Tools       // 刷新工具列表的回调
  }

  // 执行控制
  abortController: AbortController  // 中止控制器
  readFileState: FileStateCache      // 文件状态缓存

  // 状态管理
  getAppState(): AppState
  setAppState(f: (prev: AppState) => AppState): void
  setAppStateForTasks?: (f: (prev: AppState) => AppState) => void

  // UI 集成
  setToolJSX?: SetToolJSXFn         // 设置工具 UI
  addNotification?: (notif: Notification) => void
  appendSystemMessage?: (msg: SystemMessage) => void
  sendOSNotification?: (opts: {...}) => void

  // 进度追踪
  setInProgressToolUseIDs: (f: (prev: Set<string>) => Set<string>) => void
  setHasInterruptibleToolInProgress?: (v: boolean) => void
  setResponseLength: (f: (prev: number) => number) => void

  // 上下文信息
  messages: Message[]               // 消息历史
  agentId?: AgentId                 // Agent ID (子 agent 时设置)
  agentType?: string                // Agent 类型
  toolUseId?: string                // 当前工具调用 ID

  // 权限相关
  toolDecisions?: Map<string, { source, decision, timestamp }>

  // 杂项
  criticalSystemReminder_EXPERIMENTAL?: string
  contentReplacementState?: ContentReplacementState
  // ...
}
```

## 3. 工具执行详细流程

### 3.1 工具调用入口

```typescript
// 查询执行入口 (src/query.ts 简化)
async function executeToolCall(toolUse: ToolUse) {
  const { name, input, id } = toolUse

  // 1. 查找工具
  const tool = findToolByName(getAllTools(), name)

  // 2. 验证输入
  const parsedInput = tool.inputSchema.parse(input)

  // 3. 检查权限
  const permissionResult = await tool.checkPermissions(parsedInput, context)

  // 4. 执行工具
  const result = await tool.call(
    parsedInput,
    context,
    canUseTool,
    parentMessage,
    onProgress,
  )

  // 5. 渲染结果
  const renderedMessage = tool.renderToolResultMessage(result.data, ...)

  return { toolUseId: id, result, renderedMessage }
}
```

### 3.2 进度回调机制

```typescript
// 工具执行中的进度更新
type ToolProgress<P extends ToolProgressData = ToolProgressData> = {
  toolUseID: string
  data: P
}

// 工具可以调用 onProgress 来报告进度
async function myToolCall(
  args: z.infer<Input>,
  context: ToolUseContext,
  canUseTool: CanUseToolFn,
  parentMessage: AssistantMessage,
  onProgress?: ToolCallProgress<P>,
) {
  // 报告开始
  onProgress?.({ toolUseID: context.toolUseId!, data: { type: 'start' } })

  // 执行中...
  for (const item of items) {
    await process(item)
    // 报告进度
    onProgress?.({
      toolUseID: context.toolUseId!,
      data: { type: 'progress', item: item.name }
    })
  }

  // 报告完成
  return { data: finalResult }
}
```

## 4. 工具权限系统

### 4.1 权限检查流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Permission Check Flow                          │
└─────────────────────────────────────────────────────────────────┘

tool.checkPermissions(input, context)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 规则匹配                                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ permissionContext.alwaysDenyRules                           │ │
│  │ permissionContext.alwaysAskRules                           │ │
│  │ permissionContext.alwaysAllowRules                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│    [matched deny]      [matched ask]       [matched allow]      │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│    { behavior:         { behavior:        { behavior:          │
│      'deny' }          'ask' }             'allow' }           │
│                                                                  │
│  无匹配 → 使用工具默认 checkPermissions()                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 工具特定检查 (如果默认返回 allow)                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 某些工具可能有额外的验证:                                     │ │
│  │ - BashTool: 检查危险命令                                     │ │
│  │ - FileWriteTool: 检查目标路径                                │ │
│  │ - AgentTool: 检查子 agent 权限                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 权限模式

```typescript
type PermissionMode =
  | 'default'    // 交互式确认
  | 'bypass'      // 静默允许
  | 'dontAsk'     // 不询问，但记录

type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message?: string }
  | { behavior: 'ask'; updatedInput?: Record<string, unknown> }
```

## 5. MCP 工具集成

### 5.1 MCP 工具发现

```typescript
// MCP 工具通过以下方式被发现:
// 1. MCP 服务器连接时
// 2. ListMcpResourcesTool 列出资源
// 3. ReadMcpResourceTool 读取资源

// MCP 工具的 prompt() 方法返回:
async function getMcpToolPrompt(options): Promise<string> {
  return `MCP tool: ${mcpInfo.serverName}.${mcpInfo.toolName}

${description}

Parameters:
${inputSchema}

Returns:
${outputSchema}`
}
```

### 5.2 MCP 工具结构

```typescript
// MCP 工具继承标准 Tool 接口
const mcpTool: Tool = {
  name: `mcp__${serverName}__${toolName}`,  // 带前缀的唯一名称
  isMcp: true,
  mcpInfo: { serverName, toolName },

  // 从 MCP schema 转换
  inputSchema: convertMcpInputSchema(mcpSchema),
  inputJSONSchema: mcpSchema.inputSchema,  // 原始 JSON Schema

  // 执行委派给 MCP 客户端
  async call(args, context, canUseTool, onProgress) {
    const result = await mcpClient.callTool(toolName, args)
    return { data: result }
  },

  // 使用 MCP 提供的渲染器或默认渲染器
  renderToolResultMessage: mcpRenderer || defaultRenderer,
}
```

## 6. 工具结果处理

### 6.1 结果渲染流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Result Rendering Flow                         │
└─────────────────────────────────────────────────────────────────┘

tool.mapToolResultToToolResultBlockParam(output, toolUseID)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  ToolResultBlockParam 结构:                                      │
│  {                                                               │
│    type: "tool_result",                                         │
│    content: [                                                    │
│      { type: "text", text: "..." },                             │
│      { type: "image", source: { type: "base64", ... } },        │
│      { type: "resource", ... }                                  │
│    ],                                                            │
│    tool_use_id: "..."                                            │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  tool.renderToolResultMessage()                                 │
│  - 在 REPL 中显示的自定义 UI                                     │
│  - 可以返回 null (使用默认渲染器)                                │
│  - 可以返回 React.ReactNode (自定义 UI)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 常见工具的渲染方式

| 工具 | 渲染方式 |
|------|----------|
| BashTool | 终端输出，带语法高亮 |
| FileReadTool | 文件内容预览，可折叠 |
| FileEditTool | diff 显示 |
| WebSearchTool | 搜索结果卡片 |
| AgentTool | Agent 结果汇总 |
| TaskOutputTool | 任务输出流 |

## 7. 工具搜索 (ToolSearch)

### 7.1 延迟加载机制

```typescript
// 当工具设置 shouldDefer: true 时，不会立即加载到 prompt 中
// 模型需要先调用 ToolSearch 来发现工具

const ToolSearchTool: Tool = {
  name: 'ToolSearch',
  shouldDefer: false,  // ToolSearch 本身不延迟

  async call(args, context) {
    // 1. 搜索工具注册表
    // 2. 返回匹配的工具信息
    // 3. 模型可以决定是否使用该工具
  },

  async description() {
    return `Search for available tools...

Use this tool to discover deferred tools that weren't included
in the original tool list. Search by keywords to find relevant tools.`
  }
}
```

### 7.2 ToolSearch 流程

```
┌─────────────────────────────────────────────────────────────────┐
│                 ToolSearch Flow                                   │
└─────────────────────────────────────────────────────────────────┘

1. Model doesn't see deferred tool in initial prompt
         │
         ▼
2. Model calls ToolSearch({ query: "git commit" })
         │
         ▼
3. ToolSearch searches registry for matching tools
         │
         ▼
4. Returns tool info (name, description, schema)
         │
         ▼
5. Model can now call the discovered tool
         │
         ▼
6. Tool is dynamically loaded for this session
```

## 8. 工具调用的并发处理

### 8.1 并发安全检查

```typescript
// 工具定义 isConcurrencySafe()
const BashTool: Tool = {
  // Bash 命令可能修改文件，所以不安全
  isConcurrencySafe: (input) => {
    const cmd = input.command
    // 某些只读命令可以安全并发
    if (cmd.match(/^(ls|ps|whoami|git status)/)) {
      return true
    }
    return false  // 写入命令不安全
  }
}
```

### 8.2 并发调用序列

```
┌─────────────────────────────────────────────────────────────────┐
│              Concurrent Tool Calls Example                        │
└─────────────────────────────────────────────────────────────────┘

User: "Check all three files at once"
         │
         ▼
Model: [Parallel ToolUseBlocks]
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ ToolUse     │ │ ToolUse     │ │ ToolUse     │
│ name: Read  │ │ name: Read  │ │ name: Read  │
│ input: {    │ │ input: {    │ │ input: {    │
│   file: A   │ │   file: B   │ │   file: C   │  ← 同时发起
│ }           │ │ }           │ │ }           │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ isConcurren │ │ isConcurren │ │ isConcurren │
│ Safe: true  │ │ Safe: true  │ │ Safe: true  │  ← 都安全
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
        ┌─────────────────────────────┐
        │   Parallel Execution        │
        │   (Promise.all)             │
        └─────────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │   Collect All Results       │
        │   [resultA, resultB, ...]  │
        └─────────────────────────────┘
```

## 9. 错误处理

### 9.1 工具错误处理流程

```typescript
// 工具执行中的错误处理
async function toolCallWrapper(
  tool: Tool,
  args: unknown,
  context: ToolUseContext
) {
  try {
    const result = await tool.call(args, context, canUseTool, onProgress)
    return result
  } catch (error) {
    // 1. 分类错误
    if (error instanceof ToolExecutionError) {
      // 可恢复错误 → 返回错误结果给模型
      return {
        data: { error: error.message },
        // renderToolUseErrorMessage 会被调用
      }
    }

    if (error instanceof AbortError) {
      // 中止 → 停止执行
      throw error
    }

    // 2. 未知错误 → 记录并返回通用错误
    logError(error)
    return {
      data: { error: 'An unexpected error occurred' }
    }
  }
}
```

### 9.2 模型接收错误结果

```typescript
// 工具返回错误时，模型收到:
{
  type: "tool_result",
  content: [{
    type: "text",
    text: "Error: File not found\n\nThe file at path 'foo.txt' does not exist."
  }],
  tool_use_id: "..."
}

// 模型应该:
// 1. 理解这是一个错误
// 2. 决定是否重试 (不同参数)
// 3. 或者告知用户错误
```

## 10. 实践指南

### 10.1 添加新工具的检查清单

```typescript
// 1. 在 tools.ts 中导入工具
import { MyTool } from './MyTool/MyTool.js'

// 2. 在 getAllBaseTools() 中添加
return [
  // ... 其他工具
  MyTool,
]

// 3. 实现 Tool 接口:
const MyTool: Tool = {
  name: 'MyTool',              // 唯一名称
  inputSchema: z.object({...}), // Zod schema

  async call(args, context, canUseTool, onProgress) {
    // 实现逻辑
  },

  async description(input, options) {
    // 返回工具描述字符串
  },

  isConcurrencySafe: (input) => true/false,
  isReadOnly: (input) => true/false,
  isDestructive: (input) => true/false,

  // UI 渲染 (可选)
  renderToolUseMessage: (input, options) => <div>...</div>,
  renderToolResultMessage: (output, progress, options) => <div>...</div>,

  // 权限 (可选)
  checkPermissions: async (input, context) => {
    return { behavior: 'allow' }
  },
}
```

### 10.2 工具命名约定

| 类型 | 格式 | 示例 |
|------|------|------|
| 内置工具 | PascalCase | `BashTool`, `FileReadTool` |
| MCP 工具 | `mcp__server__tool` | `mcp__playwright__click` |
| 内置 Agent | kebab-case | `verification-agent` |
| 工具名称常量 | UPPER_SNAKE | `BASH_TOOL_NAME = "Bash"` |
