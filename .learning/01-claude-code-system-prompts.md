# Claude Code System Prompts & Tool Calls 架构分析

> 基于 claude-code-2.1.88 源码分析

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     buildEffectiveSystemPrompt()                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 优先级 (Priority Order):                                       │ │
│  │ 1. overrideSystemPrompt → 完全替换所有其他 prompt             │ │
│  │ 2. coordinatorSystemPrompt → 协调者模式                       │ │
│  │ 3. agentSystemPrompt → Agent 特定 prompt                     │ │
│  │ 4. customSystemPrompt → 用户通过 --system-prompt 指定         │ │
│  │ 5. defaultSystemPrompt → 标准 Claude Code prompt             │ │
│  │ + appendSystemPrompt → 始终追加在最后 (除非有 override)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 2. System Prompt 构建机制

### 2.1 核心类型定义

**文件**: `src/utils/systemPromptType.ts`

```typescript
// SystemPrompt 是一个只读字符串数组，带有品牌类型以防止误用
export type SystemPrompt = readonly string[] & {
  readonly __brand: 'SystemPrompt'
}

// 创建一个 SystemPrompt
export function asSystemPrompt(value: readonly string[]): SystemPrompt {
  return value as SystemPrompt
}
```

### 2.2 System Prompt Section 缓存机制

**文件**: `src/constants/systemPromptSections.ts`

```typescript
// 两种 section 类型：
// 1. systemPromptSection() - 缓存的，在 /clear 或 /compact 前保持不变
// 2. DANGEROUS_uncachedSystemPromptSection() - 每次都重新计算（会破坏 prompt 缓存）
```

### 2.3 Prompt 构建流程

```
用户消息
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  buildEffectiveSystemPrompt({                        │
│    mainThreadAgentDefinition,     ← 当前 Agent 定义  │
│    toolUseContext,                 ← 工具上下文       │
│    customSystemPrompt,             ← --system-prompt │
│    defaultSystemPrompt,            ← 默认 prompt     │
│    appendSystemPrompt,             ← 追加 prompt     │
│    overrideSystemPrompt            ← 覆盖 prompt     │
│  })                                                     │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  优先级判断:                                           │
│  if (overrideSystemPrompt) → 直接返回 [override]       │
│  if (coordinatorMode) → getCoordinatorSystemPrompt() │
│  if (agentSystemPrompt + proactive) → default + agent  │
│  if (agentSystemPrompt) → agent only                  │
│  if (customSystemPrompt) → custom only                │
│  else → defaultSystemPrompt                          │
│  + appendSystemPrompt (始终追加)                       │
└──────────────────────────────────────────────────────┘
```

## 3. 默认 System Prompt 组成

**文件**: `src/constants/prompts.ts` (59.5KB 的庞大文件)

默认 system prompt 由多个 section 组成，包括：

### 3.1 主要 Section 列表

| Section | 描述 |
|---------|------|
| `CapabilitiesSection` | 核心能力介绍 |
| `cliBasicsSection` | CLI 基础命令 |
| `envSection` | 环境信息 |
| `osSection` | 操作系统信息 |
| `toolDescriptionsSection` | 所有工具的描述 |
| `mcpServersSection` | MCP 服务器配置 |
| `memoryFilesSection` | 记忆文件 |
| `agentListSection` | 可用 Agent 列表 |
| `settingsSection` | 用户设置 |
| `claudeMdSection` | CLAUDE.md 内容 |
| `projectContextSection` | 项目上下文 |

### 3.2 工具描述的动态生成

每个工具通过 `prompt()` 方法生成自己的描述：

```typescript
// 工具的 prompt 方法签名
prompt(options: {
  getToolPermissionContext: () => Promise<ToolPermissionContext>
  tools: Tools
  agents: AgentDefinition[]
  allowedAgentTypes?: string[]
}): Promise<string>
```

## 4. 工具 (Tool) 架构

### 4.1 Tool 接口核心方法

**文件**: `src/Tool.ts`

```typescript
export type Tool<
  Input extends AnyObject = AnyObject,    // 输入参数类型 (Zod schema)
  Output = unknown,                       // 输出类型
  P extends ToolProgressData = ToolProgressData,  // 进度数据类型
> = {
  name: string                           // 工具名称 (唯一标识)
  aliases?: string[]                     // 别名 (向后兼容)

  // 核心方法
  call(
    args: z.infer<Input>,                 // 解析后的输入参数
    context: ToolUseContext,              // 执行上下文
    canUseTool: CanUseToolFn,             // 权限检查函数
    parentMessage: AssistantMessage,       // 父消息 (用于流式)
    onProgress?: ToolCallProgress<P>,      // 进度回调
  ): Promise<ToolResult<Output>>          // 执行结果

  description(                           // 生成工具描述字符串
    input: z.infer<Input>,
    options: {...}
  ): Promise<string>

  // Schema 定义
  readonly inputSchema: Input             // Zod 输入 schema
  inputJSONSchema?: ToolInputJSONSchema   // JSON Schema 格式 (用于 MCP)

  // 行为配置
  isConcurrencySafe(input): boolean       // 是否可以并发执行
  isReadOnly(input): boolean              // 是否只读操作
  isDestructive?(input): boolean          // 是否破坏性操作

  // UI 渲染方法
  renderToolUseMessage(input): React.ReactNode      // 工具调用消息
  renderToolResultMessage(content, ...): React.ReactNode  // 结果消息
  renderToolUseProgressMessage(...): React.ReactNode     // 进度消息

  // 元数据
  maxResultSizeChars: number             // 结果最大字符数
  shouldDefer?: boolean                   // 是否需要 ToolSearch 延迟加载
  alwaysLoad?: boolean                   // 是否始终加载 (不延迟)
  isMcp?: boolean                         // 是否为 MCP 工具
  isLsp?: boolean                         // 是否为 LSP 工具
}
```

### 4.2 工具构建工厂

```typescript
// 使用 buildTool() 工厂函数创建工具，自动填充默认值
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>

// 默认值:
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: (_input?) => false,   // 默认不安全
  isReadOnly: (_input?) => false,          // 默认会写入
  isDestructive: (_input?) => false,
  checkPermissions: () => ({ behavior: 'allow', updatedInput }),
  toAutoClassifierInput: () => '',         // 默认跳过分类器
  userFacingName: () => name,             // 默认使用工具名
}
```

### 4.3 工具列表

**文件**: `src/tools.ts`

Claude Code 内置工具 (~40+):

| 类别 | 工具 |
|------|------|
| **文件操作** | FileReadTool, FileEditTool, FileWriteTool, NotebookEditTool |
| **搜索** | GlobTool, GrepTool, WebSearchTool, WebFetchTool |
| **执行** | BashTool, PowerShellTool |
| **任务管理** | TaskCreateTool, TaskGetTool, TaskUpdateTool, TaskListTool, TaskStopTool, TaskOutputTool |
| **Agent** | AgentTool, SkillTool |
| **计划模式** | EnterPlanModeTool, ExitPlanModeV2Tool |
| **工作流** | TodoWriteTool, BriefTool |
| **提问** | AskUserQuestionTool |
| **工作树** | EnterWorktreeTool, ExitWorktreeTool |
| **MCP** | ListMcpResourcesTool, ReadMcpResourceTool |
| **其他** | ConfigTool, LSPTool, ToolSearchTool, SnipTool, etc. |

### 4.4 工具池组装

```typescript
// 所有工具的组合函数
export function assembleToolPool(
  permissionContext: ToolPermissionContext,
  mcpTools: Tools,
): Tools {
  // 1. 获取内置工具
  const builtInTools = getTools(permissionContext)

  // 2. 过滤 MCP 工具
  const allowedMcpTools = filterToolsByDenyRules(mcpTools, permissionContext)

  // 3. 排序: 内置工具前缀 + MCP 工具 (保持 prompt 缓存稳定)
  return uniqBy(
    [...builtInTools].sort(byName).concat(allowedMcpTools.sort(byName)),
    'name',
  )
}
```

## 5. 工具 Prompt 示例

### 5.1 BashTool Prompt

**文件**: `src/tools/BashTool/prompt.ts`

```typescript
export function getSimplePrompt(): string {
  return [
    'Executes a given bash command and returns its output.',
    '',
    "The working directory persists between commands, but shell state does not.",
    '',
    `# Instructions`,
    // - 使用工具偏好 (避免直接用 bash)
    `File search: Use ${GLOB_TOOL_NAME} (NOT find or ls)`,
    `Read files: Use ${FILE_READ_TOOL_NAME} (NOT cat/head/tail)`,
    `Edit files: Use ${FILE_EDIT_TOOL_NAME} (NOT sed/awk)`,
    // - 背景任务
    'You can use run_in_background parameter...',
    // - Git 协议
    'Git Safety Protocol: ...',
    // - Sandbox 配置
    getSimpleSandboxSection(),
  ].join('\n')
}
```

### 5.2 AgentTool Prompt

**文件**: `src/tools/AgentTool/prompt.ts`

```typescript
export async function getPrompt(
  agentDefinitions: AgentDefinition[],
  isCoordinator?: boolean,
  allowedAgentTypes?: string[],
): Promise<string> {
  // 包含:
  // - Agent 列表 (inline 或通过 attachment)
  // - Fork 用法 (当 forkSubagent 启用时)
  // - 何时使用/不使用 Agent
  // - 编写 prompt 的指南
  // - 示例用法
}
```

### 5.3 FileEditTool Prompt

**文件**: `src/tools/FileEditTool/prompt.ts`

```typescript
function getDefaultEditDescription(): string {
  return `Performs exact string replacements in files.

Usage:
- You must use your \`${FILE_READ_TOOL_NAME}\` tool at least once...
- When editing text from Read tool output, ensure you preserve...
- ALWAYS prefer editing existing files...
- The edit will FAIL if \`old_string\` is not unique...
- Use \`replace_all\` for replacing and renaming strings...`
}
```

## 6. 内置 Agent System Prompts

### 6.1 Verification Agent

**文件**: `src/tools/AgentTool/built-in/verificationAgent.ts`

```typescript
const VERIFICATION_SYSTEM_PROMPT = `You are a verification specialist.
Your job is not to confirm the implementation works — it's to try to break it.

You have two documented failure patterns:
1. verification avoidance: when faced with a check, you find reasons not to run it
2. being seduced by the first 80%: you see a polished UI and feel inclined to pass it

=== CRITICAL: DO NOT MODIFY THE PROJECT ===
You are STRICTLY PROHIBITED from:
- Creating, modifying, or deleting any files
- Installing dependencies or packages
...

=== VERIFICATION STRATEGY ===
Adapt your strategy based on what was changed:
- Frontend changes: Start dev server → check browser automation tools...
- Backend/API changes: Start server → curl/fetch endpoints...
...

=== REQUIRED STEPS (universal baseline) ===
1. Read the project's CLAUDE.md / README...
2. Run the build...
3. Run the project's test suite...
4. Run linters/type-checkers...
...

=== OUTPUT FORMAT (REQUIRED) ===
Every check MUST follow this structure:
### Check: [what you're verifying]
**Command run:** [exact command]
**Output observed:** [actual output]
**Result: PASS** (or FAIL)
...

VERDICT: PASS | FAIL | PARTIAL
`
```

### 6.2 Claude Code Guide Agent

**文件**: `src/tools/AgentTool/built-in/claudeCodeGuideAgent.ts`

```typescript
const getClaudeCodeGuideBasePrompt(): string {
  return `You are the Claude guide agent.
Your primary responsibility is helping users understand and use
Claude Code, the Claude Agent SDK, and the Claude API effectively.

**Your expertise spans three domains:**
1. Claude Code (the CLI tool)
2. Claude Agent SDK
3. Claude API (formerly the Anthropic API)

**Documentation sources:**
- Claude Code docs (${CLAUDE_CODE_DOCS_MAP_URL})
- Claude Agent SDK docs (${CDP_DOCS_MAP_URL})
- Claude API docs (${CDP_DOCS_MAP_URL})

**Approach:**
1. Determine which domain the user's question falls into
2. Use WebFetch to fetch the appropriate docs map
3. Identify the most relevant documentation URLs
4. Fetch the specific documentation pages
5. Provide clear, actionable guidance
...
`
}
```

## 7. Hook System中的 Prompt

### 7.1 Prompt Hook 执行

**文件**: `src/utils/hooks/execPromptHook.ts`

```typescript
export async function execPromptHook(
  hook: PromptHook,
  hookName: string,
  hookEvent: HookEvent,
  jsonInput: string,
  signal: AbortSignal,
  toolUseContext: ToolUseContext,
  messages?: Message[],
  toolUseID?: string,
): Promise<HookResult> {
  // 1. 替换 prompt 中的 $ARGUMENTS 为 JSON 输入
  const processedPrompt = addArgumentsToPrompt(hook.prompt, jsonInput)

  // 2. 创建用户消息
  const userMessage = createUserMessage({ content: processedPrompt })

  // 3. 查询模型 (使用 Haiku)
  const response = await queryModelWithoutStreaming({
    messages: [userMessage],
    systemPrompt: asSystemPrompt([
      `You are evaluating a hook in Claude Code.

Your response must be a JSON object matching one of the following schemas:
1. If the condition is met, return: {"ok": true}
2. If the condition is not met, return: {"ok": false, "reason": "..."}`
    ]),
    // ...
  })

  // 4. 解析响应
  const parsed = hookResponseSchema().safeParse(json)
  if (!parsed.data.ok) {
    return {
      outcome: 'blocking',
      blockingError: { ... },
      preventContinuation: true,
    }
  }
}
```

## 8. Session Memory System

**文件**: `src/services/SessionMemory/prompts.ts`

### 8.1 默认模板

```markdown
# Session Title
_5-10 word descriptive title_

# Current State
_What is actively being worked on?_

# Task specification
_What did the user ask to build?_

# Files and Functions
_Important files and their purpose_

# Workflow
_Bash commands and their order_

# Errors & Corrections
_Errors encountered and fixes_

# Codebase and System Documentation
_Important system components_

# Learnings
_What worked well? What to avoid?_

# Key results
_Exact output the user requested_

# Worklog
_Step by step, what was attempted_
```

### 8.2 Update Prompt

```typescript
function getDefaultUpdatePrompt(): string {
  return `IMPORTANT: This message and these instructions are NOT part of
the actual user conversation...

Based on the user conversation above, update the session notes file.
The file {{notesPath}} has already been read for you.

Your ONLY task is to use the Edit tool to update the notes file,
then stop. You can make multiple edits in parallel in a single message.

CRITICAL RULES FOR EDITING:
- Maintain exact structure with all sections
- NEVER modify, delete, or add section headers
- NEVER modify the italic _section description_ lines
- ONLY update actual content below those descriptions
...
`
}
```

## 9. Teammate System Prompt Addendum

**文件**: `src/utils/swarm/teammatePromptAddendum.ts`

```typescript
export const TEAMMATE_SYSTEM_PROMPT_ADDENDUM = `
# Agent Teammate Communication

IMPORTANT: You are running as an agent in a team. To communicate:
- Use the SendMessage tool with \`to: "<name>"\` to send to specific teammates
- Use the SendMessage tool with \`to: "*"\` for team-wide broadcasts

Just writing a response in text is not visible to others -
you MUST use the SendMessage tool.

The user interacts primarily with the team lead.
Your work is coordinated through the task system and teammate messaging.
`
```

## 10. 关键架构图

### 10.1 工具调用流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Use Flow                               │
└─────────────────────────────────────────────────────────────────┘

User/Model Decides to Call Tool
    │
    ▼
┌─────────────────┐
│  PreToolUse     │ ← Hook 可以阻止或修改
│  Hooks          │
└────────┬────────┘
    │         │
    ▼         ▼ (blocked)
┌─────────┐  ┌──────────┐
│canUseTool│  │ Return   │
│(权限检查) │  │ blocked  │
└────┬────┘  └──────────┘
    │
    │ allowed
    ▼
┌─────────────────┐
│  tool.call()    │ ← 实际执行工具
│  (with context) │
└────────┬────────┘
    │
    ▼
┌─────────────────┐
│ PostToolUse     │ ← Hook 可以添加消息
│ Hooks           │
└────────┬────────┘
    │
    ▼
┌─────────────────┐
│ renderToolResult│ ← UI 渲染结果
│ Message         │
└─────────────────┘
```

### 10.2 System Prompt 组装

```
┌─────────────────────────────────────────────────────────┐
│            Default System Prompt Sections                 │
├─────────────────────────────────────────────────────────┤
│ [CapabilitiesSection]     - 核心能力                      │
│ [cliBasicsSection]       - CLI 基础                     │
│ [envSection]             - 环境变量                     │
│ [osSection]              - 操作系统信息                  │
│ [toolDescriptionsSection] - 所有工具的 prompt() 输出      │
│ [mcpServersSection]      - MCP 服务器配置                │
│ [memoryFilesSection]      - 记忆文件内容                  │
│ [agentListSection]       - 可用 Agent 列表               │
│ [settingsSection]        - 用户设置                      │
│ [claudeMdSection]        - CLAUDE.md 内容               │
│ [projectContextSection]  - 项目上下文                    │
└─────────────────────────────────────────────────────────┘
           │
           ▼ (join with newlines)
    SystemPrompt (string[])
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│           buildEffectiveSystemPrompt()                    │
│  + override/coordinator/agent/custom prompt (按优先级)   │
│  + appendSystemPrompt (始终追加)                         │
└─────────────────────────────────────────────────────────┘
```

## 11. 缓存策略

### 11.1 System Prompt Section 缓存

- **正常 Section**: 在 `/clear` 或 `/compact` 前保持缓存
- **Uncached Section**: 每次 turn 都重新计算 (会破坏缓存)
- **缓存 Key**: 与 `Statsig` 动态配置同步以保持跨用户缓存

### 11.2 工具 Schema 缓存

```typescript
// NOTE: This MUST stay in sync with:
// https://console.statsig.com/4aF3Ewatb6xPVpCwxb5nA3/dynamic_configs/claude_code_global_system_caching
```

## 12. 权限系统集成

```typescript
export type ToolPermissionContext = DeepImmutable<{
  mode: PermissionMode                    // 'default' | 'ask' | 'bypass'
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
  isBypassPermissionsModeAvailable: boolean
  // ...
}>
```

工具通过 `checkPermissions()` 方法与权限系统集成：
- `behavior: 'allow'` - 允许执行
- `behavior: 'deny'` - 拒绝执行
- `behavior: 'ask'` - 需要用户确认

## 13. 总结

Claude Code 的 prompt 系统是一个精心设计的分层架构：

1. **优先级分明**: override > coordinator > agent > custom > default
2. **模块化 Section**: 每个 section 独立计算和缓存
3. **工具抽象**: 统一的 Tool 接口，每个工具负责自己的 prompt 生成
4. **缓存策略**: 多级缓存 (section 缓存、工具 schema 缓存)
5. **权限集成**: 工具级别和规则级别的权限控制
6. **Hook 系统**: PreToolUse/PostToolUse 允许在执行前后拦截

这套架构使得：
- 新增工具只需实现 Tool 接口
- Prompt 缓存管理自动化
- 权限控制细粒度化
- 多 Agent 协作成为可能
