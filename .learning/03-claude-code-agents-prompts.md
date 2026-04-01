# Claude Code Agent System Prompts

> 基于 claude-code-2.1.88 源码分析

## 1. Agent 类型架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Architecture                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   Built-in  │     │    Custom   │     │  In-process │        │
│  │   Agents    │     │    Agents   │     │  Teammates  │        │
│  ├─────────────┤     ├─────────────┤     ├─────────────┤        │
│  │ verification│     │ .claude/    │     │  Swarm      │        │
│  │ claude-code │     │ agents/     │     │  backends   │        │
│  │ -guide      │     │ directory   │     │             │        │
│  │ statusline  │     │             │     │             │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  AgentDefinition 结构                         │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ agentType: string              // 唯一标识                    │ │
│  │ whenToUse: string               // 何时使用的描述               │ │
│  │ tools?: string[]                // 允许的工具列表              │ │
│  │ disallowedTools?: string[]      // 禁止的工具列表             │ │
│  │ getSystemPrompt(): string       // 获取系统 prompt            │ │
│  │ color?: string                  // UI 颜色                    │ │
│  │ background?: boolean            // 是否后台运行               │ │
│  │ source: 'built-in' | 'custom'  // 来源                       │ │
│  │ baseDir: string                 // 基础目录                   │ │
│  │ model?: string                  // 模型选择                  │ │
│  │ permissionMode?: PermissionMode // 权限模式                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 内置 Agent 详解

### 2.1 Verification Agent

**目的**: 在报告完成前验证实现是否正确

**System Prompt 核心内容**:

```typescript
const VERIFICATION_SYSTEM_PROMPT = `You are a verification specialist.
Your job is not to confirm the implementation works —
it's to try to break it.

=== CRITICAL: DO NOT MODIFY THE PROJECT ===
You are STRICTLY PROHIBITED from:
- Creating, modifying, or deleting any files IN THE PROJECT DIRECTORY
- Installing dependencies or packages
- Running git write operations

=== VERIFICATION STRATEGY ===
Adapt your strategy based on what was changed:
- Frontend: Start dev server → browser automation → curl subresources
- Backend/API: Start server → curl/fetch endpoints → verify shapes
- CLI/script: Run with inputs → verify stdout/stderr/exit codes
- Bug fixes: Reproduce original bug → verify fix → regression tests

=== REQUIRED STEPS (universal baseline) ===
1. Read CLAUDE.md / README for build/test commands
2. Run the build → broken build = automatic FAIL
3. Run test suite → failing tests = automatic FAIL
4. Run linters/type-checkers
5. Check for regressions

=== RECOGNIZE YOUR OWN RATIONALIZATIONS ===
- "The code looks correct" → RUN IT
- "The implementer's tests already pass" → VERIFY INDEPENDENTLY
- "This is probably fine" → PROBABLY ISN'T VERIFIED

=== OUTPUT FORMAT ===
Every check MUST include:
### Check: [what you're verifying]
**Command run:** [exact command]
**Output observed:** [actual output]
**Result: PASS** (or FAIL with Expected vs Actual)

VERDICT: PASS | FAIL | PARTIAL
`
```

**禁止使用的工具**:
```typescript
disallowedTools: [
  AGENT_TOOL_NAME,           // 不能启动其他 agent
  EXIT_PLAN_MODE_TOOL_NAME,   // 不能退出计划模式
  FILE_EDIT_TOOL_NAME,       // 不能编辑文件
  FILE_WRITE_TOOL_NAME,      // 不能写文件
  NOTEBOOK_EDIT_TOOL_NAME,   // 不能编辑 notebook
]
```

### 2.2 Claude Code Guide Agent

**目的**: 回答关于 Claude Code、Agent SDK 和 Claude API 的问题

**System Prompt 结构**:

```typescript
function getClaudeCodeGuideBasePrompt() {
  return `You are the Claude guide agent.

**Your expertise spans three domains:**
1. Claude Code (the CLI tool): Installation, hooks, skills, MCP...
2. Claude Agent SDK: Building custom AI agents
3. Claude API (formerly Anthropic API): Direct model interaction

**Documentation sources:**
- Claude Code docs: https://code.claude.com/docs/en/claude_code_docs_map.md
- Claude Agent SDK docs: https://platform.claude.com/llms.txt
- Claude API docs: https://platform.claude.com/llms.txt

**Approach:**
1. Determine which domain the question falls into
2. Fetch the appropriate docs map
3. Identify relevant documentation URLs
4. Fetch and provide guidance based on official docs
5. Use WebSearch if docs don't cover the topic
`
}
```

**可用工具** (根据环境条件):
```typescript
// 有嵌入式搜索工具时
tools: [BASH_TOOL_NAME, FILE_READ_TOOL_NAME, WEB_FETCH_TOOL_NAME, WEB_SEARCH_TOOL_NAME]

// 无嵌入式搜索工具时
tools: [GLOB_TOOL_NAME, GREP_TOOL_NAME, FILE_READ_TOOL_NAME, WEB_FETCH_TOOL_NAME, WEB_SEARCH_TOOL_NAME]
```

### 2.3 Statusline Setup Agent

**目的**: 帮助用户配置 Claude Code 状态栏

```typescript
const STATUSLINE_SETUP_AGENT: BuiltInAgentDefinition = {
  agentType: 'statusline-setup',
  whenToUse: 'Use this agent to configure the status bar in your editor...',
  source: 'built-in',
  baseDir: 'built-in',
  // 使用 statusline-specific system prompt
}
```

## 3. 自定义 Agent 加载

**文件**: `src/tools/AgentTool/loadAgentsDir.ts`

### 3.1 Agent 定义目录结构

```
.claude/
└── agents/
    ├── my-agent/
    │   ├── agent.md        # 必需：agent 定义
    │   ├── SKILL.md         # 可选：技能定义
    │   ├── prompts/
    │   │   └── *.md         # 自定义 prompt
    │   └── config.json      # 可选：配置
    └── another-agent/
        └── agent.md
```

### 3.2 Agent 定义格式 (agent.md)

```markdown
---
name: my-agent
description: Use this agent when you need to...
tools:
  - Read
  - Edit
  - Bash
model: sonnet
color: blue
background: false
---

# System Prompt (可选，覆盖默认)

You are a specialized agent for...

Additional instructions...
```

### 3.3 Agent 加载逻辑

```typescript
interface AgentDefinition {
  agentType: string                    // 唯一标识
  whenToUse: string                     // 使用场景描述 (给模型看)
  tools?: string[]                     // 允许的工具
  disallowedTools?: string[]           // 禁止的工具
  getSystemPrompt(context?): string    // 系统 prompt
  source: 'built-in' | 'custom'        // 来源
  baseDir: string                       // 基础目录
  model?: string                       // 模型 ('inherit', 'haiku', 'sonnet', etc.)
  permissionMode?: PermissionMode       // 权限模式
  color?: string                       // UI 颜色
  background?: boolean                  // 是否后台运行
}

// 加载流程
async function loadAgents() {
  const agentsDir = '.claude/agents/'
  const agentFolders = await fs.readdir(agentsDir)

  for (const folder of agentFolders) {
    const agentMdPath = path.join(agentsDir, folder, 'agent.md')
    const agentDef = await parseAgentMd(agentMdPath)
    agents.push(agentDef)
  }

  return agents
}
```

## 4. AgentTool Prompt 详解

**文件**: `src/tools/AgentTool/prompt.ts`

### 4.1 完整 Prompt 结构

```typescript
export async function getPrompt(
  agentDefinitions: AgentDefinition[],
  isCoordinator?: boolean,
  allowedAgentTypes?: string[],
): Promise<string> {
  // 1. Agent 列表
  const agentListSection = listViaAttachment
    ? `Available agent types are listed in <system-reminder> messages.`
    : `Available agent types:
${effectiveAgents.map(a => formatAgentLine(a)).join('\n')}`

  // 2. Fork 机制 (启用时)
  const whenToForkSection = forkEnabled ? `
## When to fork
Fork yourself when intermediate output isn't worth keeping in context.
- Research: fork open-ended questions
- Implementation: prefer forking for 2+ edits
**Don't peek** at fork output mid-flight.
**Don't race** - wait for notification.
` : ''

  // 3. 编写 Prompt 指南
  const writingThePromptSection = `
## Writing the prompt
Brief the agent like a smart colleague who just walked into the room.
- Explain what you're trying to accomplish and why
- Describe what you've already learned
- Give enough context for judgment calls
**Never delegate understanding.**
`

  // 4. 示例
  const examplesSection = forkEnabled ? forkExamples : currentExamples

  // 5. 非 Coordinator 模式的额外内容
  const whenNotToUseSection = !forkEnabled ? `
When NOT to use the Agent tool:
- If you want to read a specific file → use Read tool
- If searching for a class definition → use Glob/Grep tool
- If searching within 2-3 files → use Read tool
` : ''

  // 组合
  return `${sharedCorePrompt}
${whenNotToUseSection}
${concurrencyNote}
${writingThePromptSection}
${examplesSection}`
}
```

### 4.2 Agent 列表格式

```typescript
// 每个 Agent 格式化为一行星期
function formatAgentLine(agent: AgentDefinition): string {
  const toolsDescription = getToolsDescription(agent)
  return `- ${agent.agentType}: ${agent.whenToUse} (Tools: ${toolsDescription})`
}

// 示例输出:
// - verification: Use this agent to verify implementation before reporting... (Tools: Bash, Read, Glob, Grep, WebFetch, WebSearch, TodoWrite)
// - claude-code-guide: Use this agent when the user asks about... (Tools: Glob, Grep, Read, WebFetch, WebSearch)
```

## 5. 多 Agent 协作

### 5.1 Fork Subagent vs Fresh Agent

```typescript
// Fork: 继承当前上下文
AgentTool({
  name: "research-branch",    // 用于标识
  // 无 subagent_type → Fork
  prompt: "Research X, focusing on Y...",
  // 继承父 agent 的所有工具和上下文
})

// Fresh Agent: 全新开始
AgentTool({
  name: "code-review",
  subagent_type: "code-reviewer",  // 指定类型
  prompt: "Review the migration file...",  // 需要完整上下文
})
```

### 5.2 Teammate System Prompt Addendum

**文件**: `src/utils/swarm/teammatePromptAddendum.ts`

```typescript
const TEAMMATE_SYSTEM_PROMPT_ADDENDUM = `
# Agent Teammate Communication

IMPORTANT: You are running as an agent in a team.

To communicate with teammates:
- Use SendMessage tool with \`to: "<name>"\` for specific teammates
- Use SendMessage tool with \`to: "*"\` for team-wide broadcasts

Just writing a response in text is NOT visible to others -
you MUST use the SendMessage tool.

The user interacts primarily with the team lead.
Your work is coordinated through the task system and teammate messaging.
`
```

### 5.3 Coordinator Mode

**文件**: `src/coordinator/coordinatorMode.ts`

```typescript
// Coordinator 的职责:
// 1. 分解复杂任务为子任务
// 2. 分发任务给 Worker agents
// 3. 收集和汇总结果
// 4. 向用户报告进度

interface CoordinatorState {
  tasks: Task[]           // 待处理任务
  workers: Worker[]        // 工作中的 worker
  completedTasks: Task[]   // 已完成任务
}
```

## 6. Agent 选择算法

### 6.1 模型如何选择 Agent

```typescript
// 工具描述中包含 whenToUse
// 模型根据用户请求匹配 whenToUse 描述

// 示例:
// - verification: "Use this agent to verify that implementation work is correct..."
// - claude-code-guide: "Use this agent when the user asks questions about Claude Code..."

// 模型收到:
// "Please write a function that checks if a number is prime"
// → 不匹配任何 agent whenToUse
// → 使用默认工具 (BashTool, ReadTool, EditTool)

// 模型收到:
// "I've finished implementing the authentication system as outlined in step 3"
// → 匹配 "verification" agent (验证工作是否完成)
```

### 6.2 Agent 过滤

```typescript
// 当 AgentTool 指定 allowedAgentTypes 时
AgentTool({
  allowedAgentTypes: ['verification', 'code-reviewer'],
  // 只显示允许的 agent 类型
})

// 过滤后的列表:
// - verification: ...
// - code-reviewer: ...
// (其他 agent 被隐藏)
```

## 7. Agent 与工具的关系

### 7.1 工具限制

```typescript
// 方式 1: Allowlist (指定可以使用哪些工具)
const myAgent: AgentDefinition = {
  agentType: 'limited-assistant',
  tools: ['Read', 'Bash', 'Glob'],  // 只有这些工具
}

// 方式 2: Denylist (禁止使用哪些工具)
const myAgent: AgentDefinition = {
  agentType: 'researcher',
  disallowedTools: ['Write', 'Edit', 'Bash'],  // 禁止这些
}

// 运行时过滤
function filterToolsForAgent(tools: Tools, agent: AgentDefinition): Tools {
  if (agent.tools?.length > 0) {
    // Allowlist 模式
    return tools.filter(t => agent.tools!.includes(t.name))
  }
  if (agent.disallowedTools?.length > 0) {
    // Denylist 模式
    return tools.filter(t => !agent.disallowedTools!.includes(t.name))
  }
  return tools  // 无限制
}
```

### 7.2 工具在 Agent Context 中的可用性

```
Main Agent Context:
┌─────────────────────────────────────────────────────────────┐
│ Tools: [Bash, Read, Edit, Write, Glob, Grep, Agent, ...]   │
│ Agents: [verification, code-reviewer, ...]                 │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ AgentTool spawns...
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Verification Agent Context:                                │
│ Tools: [Bash, Read, Glob, Grep, WebFetch, WebSearch, ...]  │
│         ↑ 移除了: Agent, Write, Edit, NotebookEdit          │
│ Agents: (不可用 - 不能嵌套 spawn)                          │
└─────────────────────────────────────────────────────────────┘
```

## 8. 内置 Agent 总结表

| Agent | Type | 用途 | 禁用工具 |
|-------|------|------|----------|
| `verification` | built-in | 验证实现正确性 | Agent, Write, Edit |
| `claude-code-guide` | built-in | 回答关于 CC/API 的问题 | 无限制 |
| `statusline-setup` | built-in | 配置状态栏 | - |

## 9. 最佳实践

### 9.1 何时使用 Agent

```typescript
// ✓ 使用 Agent
- 复杂、多步骤任务
- 需要专门知识的领域
- 验证实现是否正确
- 需要并行处理多个独立任务

// ✗ 不使用 Agent
- 简单文件读取
- 单个编辑操作
- 搜索特定内容
- 直接回答问题
```

### 9.2 编写 Agent Prompt

```typescript
// ✓ 好的 Agent Prompt
prompt: `
Review the migration file: migrations/0042_user_schema.sql

Context:
- Adding NOT NULL column to 50M-row table
- Existing rows get backfill default
- Concern: concurrent writes safety

Request: Second opinion on whether backfill approach is safe.
Report: Is this safe, and if not, what specifically breaks?
`

// ✗ 差的 Agent Prompt
prompt: "Review the migration file."
prompt: "Based on your findings, fix any issues."
```

### 9.3 Agent 命名

```typescript
// 好的命名
name: "migration-review"
name: "ship-audit"
name: "test-runner"

// 命名用于:
// - Teams 面板显示
// - SendMessage 目标
// - 日志和追踪
```
