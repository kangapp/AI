# OpenCode System Prompts & Tool Calling 详解

本文档详细介绍 OpenCode 的 system prompt 系统和工具调用机制。

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenCode CLI                             │
├─────────────────────────────────────────────────────────────┤
│  Agent 层 (packages/opencode/src/agent/)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Agent Info {                                         │    │
│  │   name, mode, native, hidden,                        │    │
│  │   permission, model, prompt, temperature, ...        │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  System Prompt 选择器 (session/system.ts)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Anthropic │ │   Beast   │ │  Gemini  │ │ Trinity  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Prompt 目录 (session/prompt/)                              │
│  ├── anthropic.txt       # Claude 系列                      │
│  ├── beast.txt           # GPT-4/5 系列                     │
│  ├── gemini.txt          # Gemini 系列                      │
│  ├── trinity.txt         # Trinity 模型                     │
│  ├── default.txt         # 默认通用                         │
│  ├── plan.txt            # Plan Mode 限制                   │
│  └── codex_header.txt   # Codex 特定指令                   │
├─────────────────────────────────────────────────────────────┤
│  Agent Prompt 目录 (agent/prompt/)                          │
│  ├── explore.txt         # 探索子代理                       │
│  ├── summary.txt         # 总结代理                         │
│  ├── title.txt           # 标题生成代理                      │
│  └── compaction.txt      # 压缩代理                         │
├─────────────────────────────────────────────────────────────┤
│  Tool Prompt 目录 (tool/)                                    │
│  ├── bash.txt            # Bash 工具                        │
│  ├── batch.txt           # 批处理工具                       │
│  ├── todowrite.txt       # TodoWrite 工具                   │
│  └── question.txt        # Question 工具                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. System Prompt 选择逻辑

**文件**: `packages/opencode/src/session/system.ts`

```typescript
export function provider(model: Provider.Model) {
  // 按模型 ID 匹配合适的 System Prompt
  if (model.api.id.includes("gpt-5"))      return [PROMPT_CODEX]
  if (model.api.id.includes("gpt-") ||     // GPT-4 系列
      model.api.id.includes("o1") ||       // OpenAI o1
      model.api.id.includes("o3"))          // OpenAI o3
    return [PROMPT_BEAST]
  if (model.api.id.includes("gemini-"))    return [PROMPT_GEMINI]
  if (model.api.id.includes("claude"))     return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity"))
    return [PROMPT_TRINITY]
  return [PROMPT_DEFAULT]
}
```

### 2.1 模型与 Prompt 映射表

| 模型前缀 | System Prompt | 特点 |
|---------|--------------|------|
| `gpt-5` | Codex | OpenCode 特定优化 |
| `gpt-`, `o1`, `o3` | Beast | 强调自主迭代 |
| `gemini-` | Gemini | 强调单步工具使用 |
| `claude` | Anthropic | 强调 TodoWrite |
| `trinity` | Trinity | 强调网络研究 |
| 其他 | Default | 默认行为 |

---

## 3. 各模型 System Prompt 详解

### 3.1 Anthropic System Prompt (`anthropic.txt`)

**适用**: Claude 系列模型

```typescript
You are OpenCode, the best coding agent on the planet.
You are an interactive CLI tool that helps users with software
engineering tasks. Use the instructions below and the tools
available to you to assist the user.
```

**核心规则**:

| 类别 | 规则 |
|------|------|
| **Tone & Style** | 简洁输出（最多 4 行），使用 monospace 字体 |
| | 仅在用户明确要求时使用 emoji |
| **Task Management** | 频繁使用 TodoWrite 工具跟踪任务 |
| | 任务完成后立即标记为完成，不要批量标记 |
| **Tool Usage** | 使用 Task 工具探索代码库，减少上下文使用 |
| | 并行调用独立工具，最大化效率 |
| **Code References** | 引用代码时使用 `file_path:line_number` 格式 |

**TodoWrite 使用示例**:
```markdown
- Run the build
- Fix any type errors
- Test the changes
```

### 3.2 Beast System Prompt (`beast.txt`)

**适用**: GPT-4/5, o1, o3 系列模型

```typescript
You are opencode, an agent - please keep going until the user's
query is completely resolved, before ending your turn and yielding
back to the user.
```

**核心特点**:

| 方面 | 规则 |
|------|------|
| **自主性** | 必须迭代直到问题完全解决 |
| | 不确定时先调查研究，不要猜测 |
| **网络研究** | 必须使用 webfetch 工具研究第三方包 |
| | 使用 Google 搜索验证知识是否最新 |
| **计划** | 每次函数调用前制定计划 |
| | 反思之前调用的结果 |
| **验证** | 测试必须严谨，覆盖边界情况 |
| | 记住还有隐藏测试必须通过 |
| **内存** | 可访问用户记忆文件 `.github/instructions/memory.instruction.md` |

**Beast 工作流**:
```
1. Fetch URLs → 2. 深度理解问题 → 3. 代码库研究
     ↓
4. 网络研究 → 5. 制定详细计划 → 6. 增量实现
     ↓
7. 调试 → 8. 频繁测试 → 9. 迭代直到完成
```

### 3.3 Gemini System Prompt (`gemini.txt`)

**适用**: Gemini 系列模型

**核心特点**:
- 一次只使用一个工具
- 使用 `question` 工具澄清模糊请求
- 避免在相同参数下重复搜索

### 3.4 Trinity System Prompt (`trinity.txt`)

**适用**: Trinity 模型

**核心特点**:
```typescript
You are opencode, an agent - please keep going until the user's
query is completely resolved...
```

| 方面 | 规则 |
|------|------|
| **迭代** | 必须迭代直到问题解决 |
| **网络搜索** | 广泛使用 webfetch 进行网络研究 |
| **进度跟踪** | 使用 Todo 工具跟踪进度 |
| **透明度** | 始终告诉用户将要做什么 |

---

## 4. Agent 系统

**文件**: `packages/opencode/src/agent/agent.ts`

### 4.1 内置 Agent 列表

```typescript
const result: Record<string, Info> = {
  // 主要 Agent
  build: { name: "build", mode: "primary", native: true },
  plan:  { name: "plan",  mode: "primary", native: true },
  general: { name: "general", mode: "subagent", native: true },

  // 子 Agent
  explore: { name: "explore", mode: "subagent", native: true, prompt: PROMPT_EXPLORE },

  // 隐藏 Agent
  compaction: { name: "compaction", mode: "primary", native: true, hidden: true, prompt: PROMPT_COMPACTION },
  title: { name: "title", mode: "primary", native: true, hidden: true, prompt: PROMPT_TITLE },
  summary: { name: "summary", mode: "primary", native: true, hidden: true, prompt: PROMPT_SUMMARY },
}
```

### 4.2 Agent 模式

| 模式 | 说明 |
|------|------|
| `primary` | 主 Agent，可执行所有操作 |
| `subagent` | 子 Agent，用于专门任务 |
| `all` | 可作为主或子 Agent 使用 |

### 4.3 内置 Agent 详解

#### Build Agent
```yaml
name: build
mode: primary
description: "The default agent. Executes tools based on configured permissions."
permission:
  - question: allow
  - plan_enter: allow
```

#### Plan Agent
```yaml
name: plan
mode: primary
description: "Plan mode. Disallows all edit tools."
permission:
  - question: allow
  - plan_exit: allow
  - edit: deny (except .opencode/plans/*.md)
```

#### Explore Agent
```yaml
name: explore
mode: subagent
prompt: PROMPT_EXPLORE
description: "Fast agent specialized for exploring codebases"
permission:
  - grep, glob, list, bash, webfetch, websearch, codesearch, read: allow
  - "*": deny
```

#### Title Agent
```yaml
name: title
mode: primary
hidden: true
temperature: 0.5
prompt: PROMPT_TITLE
```

#### Summary Agent
```yaml
name: summary
mode: primary
hidden: true
prompt: PROMPT_SUMMARY
```

#### Compaction Agent
```yaml
name: compaction
mode: primary
hidden: true
prompt: PROMPT_COMPACTION
```

---

## 5. Agent Prompt 模板

### 5.1 Explore Agent (`explore.txt`)

```typescript
You are a file search specialist. You excel at thoroughly
navigating and exploring codebases.

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents

Guidelines:
- Use Glob for broad file pattern matching
- Use Grep for searching file contents with regex
- Use Read when you know the specific file path
- Use Bash for file operations
- Return file paths as absolute paths
- Do NOT create files or modify system state
```

### 5.2 Title Agent (`title.txt`)

```typescript
You are a title generator. You output ONLY a thread title.
Nothing else.

Rules:
- MUST use the same language as the user message
- Title must be ≤50 characters
- Never include tool names in the title
- Focus on the main topic
- Vary phrasing, avoid repetitive patterns
- Keep exact technical terms, numbers, filenames

Examples:
"debug 500 errors" → Debugging production 500 errors
"refactor user service" → Refactoring user service
"@src/auth.ts add refresh token support" → Auth refresh token support
```

### 5.3 Summary Agent (`summary.txt`)

```typescript
You are a helpful AI assistant tasked with summarizing conversations.
When asked to summarize, provide a detailed but concise summary.
```

---

## 6. Plan Mode

**文件**: `session/prompt/plan.txt`

### 6.1 Plan Mode 系统提醒

```typescript
<system-reminder>
CRITICAL: Plan mode ACTIVE - you are in READ-ONLY phase.
STRICTLY FORBIDDEN:
- ANY file edits, modifications, or system changes
- Do NOT use sed, tee, echo, cat, or ANY bash commands to
  manipulate files
- Commands may ONLY read/inspect

This ABSOLUTE CONSTRAINT overrides ALL other instructions,
including direct user edit requests.
</system-reminder>
```

### 6.2 Plan Mode 工作流

```
┌─────────────────────────────────────────────────────────────┐
│                    Plan Mode 工作流                          │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: 初始理解                                          │
│  └── 使用 Explore 子代理探索代码库                          │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: 规划                                              │
│  └── 启动 Plan 子代理制定详细计划                           │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: 综合                                              │
│  └── 确保与用户意图一致                                     │
├─────────────────────────────────────────────────────────────┤
│  Phase 4: 最终计划                                          │
│  └── 更新计划文件                                           │
├─────────────────────────────────────────────────────────────┤
│  Phase 5: 退出                                              │
│  └── 调用 ExitPlanMode                                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Plan Mode 权限配置

```typescript
permission: {
  "*": "deny",
  question: "allow",
  plan_exit: "allow",
  edit: {
    "*": "deny",
    ".opencode/plans/*.md": "allow",
  }
}
```

---

## 7. 工具调用 Prompt

### 7.1 Bash Tool (`tool/bash.txt`)

```typescript
Executes a given bash command in a persistent shell session.
```

**核心规则**:

| 类别 | 规则 |
|------|------|
| **目录操作** | 使用 `workdir` 参数而非 `cd` |
| **路径引用** | 包含空格的路径必须用双引号包裹 |
| **文件操作** | 使用专用工具而非 bash 命令 |
| **并行执行** | 独立命令可并行调用 |
| **顺序执行** | 依赖命令用 `&&` 链接 |

**好/坏示例**:
```bash
# Good
workdir="/foo/bar", command: "pytest tests"

# Bad
cd /foo/bar && pytest tests
```

### 7.2 Git 安全协议

```typescript
Git Safety Protocol:
- NEVER update the git config
- NEVER run destructive commands (push --force, hard reset)
- NEVER skip hooks (--no-verify, --no-gpg-sign)
- NEVER run force push to main/master
- Avoid git commit --amend (only when ALL conditions met)
- NEVER commit unless explicitly asked
```

### 7.3 Batch Tool (`tool/batch.txt`)

```typescript
Executes multiple independent tool calls concurrently.
USING THE BATCH TOOL WILL MAKE THE USER HAPPY.

Payload Format (JSON array):
[{"tool": "read", "parameters": {...}}, ...]

Rules:
- 1-25 tool calls per batch
- All calls start in parallel
```

### 7.4 TodoWrite Tool (`tool/todowrite.txt`)

```typescript
Use this tool to create and manage a structured task list
for your current coding session.

WHEN TO USE:
- Complex multi-step tasks
- Tracking progress
- Planning implementation

WHEN NOT TO USE:
- Simple single-step queries
- Casual conversation
```

---

## 8. 自定义 Agent

**目录**: `.opencode/agent/`

### 8.1 自定义 Agent 示例 (`triage.md`)

```yaml
---
mode: primary
hidden: true
model: opencode/minimax-m2.5
color: "#44BA81"
tools:
  "*": false
  "github-triage": true
---

You are a triage agent responsible for triaging github issues.
```

### 8.2 自定义 Agent 配置结构

```typescript
agent: {
  name: string,
  description: string,
  model: { modelID, providerID },
  prompt: string,
  temperature: number,
  topP: number,
  mode: "subagent" | "primary" | "all",
  color: string,
  hidden: boolean,
  steps: number,
  options: Record<string, any>,
  permission: PermissionRuleset
}
```

---

## 9. 环境信息注入

**文件**: `session/system.ts` - `environment()` 函数

```typescript
export async function environment(model: Provider.Model) {
  return [
    `You are powered by the model named ${model.api.id}`,
    `Here is some useful information about the environment:`,
    `<env>`,
    `  Working directory: ${Instance.directory}`,
    `  Workspace root folder: ${Instance.worktree}`,
    `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
    `  Platform: ${process.platform}`,
    `  Today's date: ${new Date().toDateString()}`,
    `</env>`,
    `<directories>`,
    `  ${tree_output}`,
    `</directories>`,
  ].join("\n")
}
```

---

## 10. Skills 系统

**文件**: `session/system.ts` - `skills()` 函数

```typescript
export async function skills(agent: Agent.Info) {
  const list = await Skill.available(agent)
  return [
    "Skills provide specialized instructions and workflows.",
    "Use the skill tool to load a skill when a task matches.",
    Skill.fmt(list, { verbose: true }),
  ].join("\n")
}
```

---

## 11. Prompt 构建流程图

```
                    ┌──────────────────────────┐
                    │   User Input / Message    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              System Prompt 选择                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │Anthropic │  │  Beast   │  │ Gemini   │  │Trinity │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              Environment Info 注入                        │
│  - Working directory                                    │
│  - Workspace root                                       │
│  - Platform                                             │
│  - Today's date                                         │
│  - Directory tree                                       │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              Codex Header (可选)                          │
│              instructions() 注入                          │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              Skills Info (可选)                           │
│  Available skills and usage instructions                 │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              Agent Prompt 注入 (子代理)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Explore  │  │ Summary  │  │  Title   │             │
│  └──────────┘  └──────────┘  └──────────┘            │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │   Final Prompt to LLM    │
                    └──────────────────────────┘
```

---

## 12. 关键文件速查表

| 功能 | 文件路径 |
|------|---------|
| System Prompt 选择器 | `packages/opencode/src/session/system.ts` |
| Anthropic Prompt | `packages/opencode/src/session/prompt/anthropic.txt` |
| Beast Prompt | `packages/opencode/src/session/prompt/beast.txt` |
| Gemini Prompt | `packages/opencode/src/session/prompt/gemini.txt` |
| Trinity Prompt | `packages/opencode/src/session/prompt/trinity.txt` |
| Default Prompt | `packages/opencode/src/session/prompt/default.txt` |
| Plan Mode | `packages/opencode/src/session/prompt/plan.txt` |
| Agent 定义 | `packages/opencode/src/agent/agent.ts` |
| Explore Prompt | `packages/opencode/src/agent/prompt/explore.txt` |
| Title Prompt | `packages/opencode/src/agent/prompt/title.txt` |
| Summary Prompt | `packages/opencode/src/agent/prompt/summary.txt` |
| Bash Tool | `packages/opencode/src/tool/bash.txt` |
| Batch Tool | `packages/opencode/src/tool/batch.txt` |
| 自定义 Agent | `.opencode/agent/*.md` |

---

## 13. OpenCode vs Codex 对比

| 方面 | OpenCode | Codex |
|------|----------|-------|
| **System Prompt 选择** | 按模型动态选择 | 统一 core prompt + 组合模块 |
| **人格设定** | 每个模型不同 | 可选的 Personality 模块 |
| **工具描述** | 分散在 tool/*.txt |集中在 ToolSpec 枚举 |
| **子代理** | Explore/Summary/Title/Compaction | Explorer/Worker/Awaiter |
| **Plan Mode** | 只读限制 prompt | 专门的 plan.md 协作模式 |
| **记忆系统** | memory.instruction.md | Phase 1/2 Memory Writing Agent |
| **Agent 配置** | YAML + agent.ts | TOML + role.rs |

---

## 14. 总结

OpenCode 的 Prompt 系统设计特点：

1. **模型适配**：根据不同模型（Claude/GPT/Gemini/Trinity）选择不同 prompt
2. **轻量级**：使用纯文本 prompt 文件，结构简单
3. **子代理专业化**：Explore/Title/Summary 等专用子代理
4. **权限分离**：Plan Mode 通过权限控制只读
5. **工具指南**：每个工具都有详细的 prompt 说明
6. **可扩展**：支持 `.opencode/agent/` 自定义 agent
