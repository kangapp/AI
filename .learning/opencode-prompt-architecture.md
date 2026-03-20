# OpenCode Prompt 架构详解

## 目录
1. [整体架构概览](#1-整体架构概览)
2. [System Prompt 层次结构](#2-system-prompt-层次结构)
3. [模型适配机制](#3-模型适配机制)
4. [Agent 系统](#4-agent-系统)
5. [Tool 工具系统](#5-tool-工具系统)
6. [Skills 技能系统](#6-skills-技能系统)
7. [Instruction 指令系统](#7-instruction-指令系统)
8. [工具描述格式](#8-工具描述格式)
9. [权限与配置](#9-权限与配置)
10. [流程图解](#10-流程图解)

---

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OpenCode Prompt Architecture                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    System Prompt (模型相关)                        │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐  │   │
│  │  │ anthropic   │ │   beast     │ │  gemini   │ │   default   │  │   │
│  │  │   (Claude)  │ │ (GPT/O1/O3) │ │ (Gemini)  │ │   (其他)    │  │   │
│  │  └────────────┘ └────────────┘ └──────────┘ └─────────────┘  │   │
│  │         │              │              │              │       │   │
│  │         └──────────────┴──────────────┴──────────────┘       │   │
│  │                            │                                   │   │
│  │                            ▼                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │              Environment Info (环境信息)                   │  │   │
│  │  │  • Working Directory  • Git Repo Status  • Platform     │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   Instruction Prompts (指令)                      │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │   │
│  │  │  AGENTS.md  │  │  CLAUDE.md   │  │  Custom Instructions   │  │   │
│  │  │  (项目级)   │  │   (全局)     │  │     (.opencode/)       │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Skills (技能系统)                              │   │
│  │     ┌─────────────────────────────────────────────────────┐      │   │
│  │     │  <available_skills>                                  │      │   │
│  │     │    <skill>                                           │      │   │
│  │     │      <name>skill-name</name>                         │      │   │
│  │     │      <description>...</description>                  │      │   │
│  │     │      <location>file:///...</location>                │      │   │
│  │     │    </skill>                                          │      │   │
│  │     │  </available_skills>                                  │      │   │
│  │     └─────────────────────────────────────────────────────┘      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   Tool Descriptions (工具描述)                    │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │  bash  │ │  read  │ │ write  │ │  edit  │ │  glob  │  ...   │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Prompt 层次结构

### 2.1 Prompt 文件位置
```
packages/opencode/src/session/prompt/
├── anthropic.txt          # Claude 系列模型
├── anthropic-20250930.txt # Claude 旧版本
├── beast.txt              # GPT / O1 / O3 系列
├── default.txt            # 默认提示词
├── gemini.txt             # Gemini 模型
├── trinity.txt            # Trinity 模型
├── codex_header.txt       # Codex 特定指令
├── copilot-gpt-5.txt      # GPT-5 Copilot
├── plan.txt               # Plan 模式提示词
├── plan-reminder-anthropic.txt # Plan 模式提醒
├── build-switch.txt       # 构建切换提示词
└── max-steps.txt          # 最大步数限制
```

### 2.2 模型选择逻辑

```typescript
// packages/opencode/src/session/system.ts
export function provider(model: Provider.Model) {
  if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
  if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3"))
    return [PROMPT_BEAST]     // GPT-4, GPT-3.5, O1, O3
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
  return [PROMPT_DEFAULT]
}
```

### 2.3 各模型 Prompt 特点对比

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     System Prompt 特性对比                               │
├─────────────────┬───────────────┬───────────────┬─────────────────────┤
│     特性        │  anthropic    │     beast     │       default        │
├─────────────────┼───────────────┼───────────────┼─────────────────────┤
│  模型代表       │    Claude     │  GPT-4/O1/O3  │       其他          │
│  语气风格       │   专业简洁    │   极度简洁    │      详细           │
│  输出长度       │   少于3行     │   少于4行     │      完整           │
│  Todo使用       │   频繁使用    │    适度       │      完整           │
│  代码注释       │    允许      │    禁止       │      允许           │
│  工具批量调用   │    支持      │    支持       │      支持           │
│  主动操作       │   被禁止     │   被禁止      │      允许           │
│  Commit规则     │   显式请求   │   显式请求    │      显式请求        │
└─────────────────┴───────────────┴───────────────┴─────────────────────┘
```

---

## 3. 模型适配机制

### 3.1 Anthropic (Claude) Prompt 核心内容

```markdown
# anthropic.txt 核心指令

You are OpenCode, the best coding agent on the planet.

## 核心原则
- 遵循项目现有约定
- 不假设库/框架可用
- 模仿现有代码风格
- 使用绝对路径进行文件操作

## 主要工作流
1. Understand: 使用 grep/glob 理解代码库上下文
2. Plan: 基于理解构建连贯计划
3. Implement: 使用工具执行计划
4. Verify: 运行测试
5. Verify Standards: 运行 lint/typecheck

## 工具使用策略
- 代码库探索时，优先使用 Task 工具
- 使用专用工具而非 bash 命令
- 并行调用独立工具

## Todo 管理
- 频繁使用 TodoWrite 追踪任务
- 复杂任务立即创建 todo list
- 任务完成立即标记
```

### 3.2 Beast (GPT/O1/O3) Prompt 核心差异

```markdown
# beast.txt 核心特点

## 语气要求 - 极度简洁
- 少于4行输出
- 无序论/结论语
- 直接回答问题
- 避免解释

## 禁止事项
- 不要添加代码注释（除非用户要求）
- 不要主动操作（除非用户要求）
- 不要总结代码变更

## 代码风格
- 遵循现有代码约定
- 不假设库可用
- 验证后再使用

## 主动 vs 被动
- 被要求时才行动
- 平衡"做正确的事"和"不惊喜用户"
```

### 3.3 Default Prompt (通用模型)

```markdown
# default.txt 核心特点

## 自主性要求
- 持续迭代直到问题解决
- 深入思考但不冗余
- 问题未完全解决不终止

## 必需操作
- 频繁使用 webfetch 收集信息
- 使用 Google 验证第三方包
- 创建 todo list 并追踪
- 详细计划每步操作

## 工作流
1. Fetch URLs
2. Deeply Understand
3. Codebase Investigation
4. Internet Research
5. Develop Plan
6. Implement
7. Debug
8. Test
9. Iterate
10. Reflect
```

---

## 4. Agent 系统

### 4.1 内置 Agent 类型

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent 类型架构                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────┐     ┌─────────────────────────────────┐   │
│  │       Primary Agent     │     │        Subagent                 │   │
│  │     (主代理,可见)        │     │      (子代理,任务专用)            │   │
│  ├─────────────────────────┤     ├─────────────────────────────────┤   │
│  │  ┌─────────┐ ┌────────┐  │     │  ┌─────────┐ ┌────────────────┐   │   │
│  │  │  build  │ │  plan  │  │     │  │ general │ │    explore     │   │   │
│  │  │ 默认执行 │ │ 计划模式│  │     │  │ 通用多步 │ │   代码库探索   │   │   │
│  │  └─────────┘ └────────┘  │     │  └─────────┘ └────────────────┘   │   │
│  │  ┌─────────┐ ┌────────┐  │     │                                 │   │
│  │  │compact. │ │ title  │  │     │  ┌─────────────────────────┐    │   │
│  │  │ 压缩代理 │ │ 标题生成│  │     │  │   Custom Agents         │    │   │
│  │  └─────────┘ └────────┘  │     │  │   (.opencode/agent/*.md)│    │   │
│  │  ┌─────────┐              │     │  └─────────────────────────┘    │   │
│  │  │ summary │              │     │                                 │   │
│  │  │ 总结代理│              │     │                                 │   │
│  │  └─────────┘              │     │                                 │   │
│  └─────────────────────────┘     └─────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 内置 Agent 详细配置

```typescript
// packages/opencode/src/agent/agent.ts

// Build Agent - 默认执行代理
build: {
  name: "build",
  mode: "primary",
  permission: { question: "allow", plan_enter: "allow", ... },
  native: true
}

// Plan Agent - 计划模式（禁用编辑工具）
plan: {
  name: "plan",
  mode: "primary",
  permission: {
    edit: { "*": "deny", ".opencode/plans/*.md": "allow" },
    ...
  }
}

// Explore Agent - 代码库探索专家
explore: {
  name: "explore",
  mode: "subagent",
  prompt: PROMPT_EXPLORE,
  permission: {
    "*": "deny",
    grep: "allow", glob: "allow", read: "allow",
    bash: "allow", webfetch: "allow", ...
  }
}

// General Agent - 通用多步任务
general: {
  name: "general",
  mode: "subagent",
  permission: { todoread: "deny", todowrite: "deny", ... }
}

// Compaction Agent - 上下文压缩
compaction: { mode: "primary", hidden: true, prompt: PROMPT_COMPACTION }

// Title Agent - 会话标题生成
title: { mode: "primary", hidden: true, temperature: 0.5 }

// Summary Agent - 会话总结
summary: { mode: "primary", hidden: true }
```

### 4.3 Explore Agent Prompt

```markdown
# packages/opencode/src/agent/prompt/explore.txt

You are a file search specialist. You excel at thoroughly navigating
and exploring codebases.

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents

Guidelines:
- Use Glob for broad file pattern matching
- Use Grep for searching file contents with regex
- Use Read when you know the specific file path
- Use Bash for file operations
- Adapt search approach based on thoroughness level
- Return absolute paths
- Do not create files or modify system state
```

---

## 5. Tool 工具系统

### 5.1 工具注册表

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Tool Registry (工具注册表)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  packages/opencode/src/tool/registry.ts                                 │
│                                                                          │
│  export async function all(): Promise<Tool.Info[]> {                    │
│    return [                                                              │
│      InvalidTool,     // 无效工具                                        │
│      QuestionTool,   // 提问工具                                        │
│      BashTool,       // Shell 命令执行                                   │
│      ReadTool,       // 文件读取                                        │
│      GlobTool,       // 文件模式搜索                                     │
│      GrepTool,       // 正则搜索                                        │
│      EditTool,       // 字符串替换                                       │
│      WriteTool,      // 文件写入                                        │
│      TaskTool,       // 子代理启动                                      │
│      TodoWriteTool,  // Todo 写入                                        │
│      WebSearchTool,  // 网络搜索                                        │
│      WebFetchTool,   // 网页抓取                                        │
│      CodeSearchTool, // 代码语义搜索                                     │
│      SkillTool,      // 技能加载                                        │
│      ApplyPatchTool, // 补丁应用                                        │
│      LspTool,        // LSP 语言服务器                                   │
│      BatchTool,      // 批量操作                                        │
│      PlanExitTool,   // 计划模式退出                                     │
│      ...custom       // 自定义工具                                      │
│    ]                                                                    │
│  }                                                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 工具描述文件

```
packages/opencode/src/tool/
├── bash.txt      # Shell 命令执行
├── read.txt      # 文件读取
├── write.txt     # 文件写入
├── edit.txt      # 字符串替换
├── glob.txt      # 文件模式搜索
├── grep.txt      # 正则表达式搜索
├── task.txt      # 子代理启动
├── webfetch.txt  # 网页抓取
├── websearch.txt # 网络搜索
├── codesearch.txt# 代码语义搜索
├── lsp.txt       # LSP 语言服务器
├── plan-enter.txt# 进入计划模式
└── plan-exit.txt # 退出计划模式
```

---

## 6. Skills 技能系统

### 6.1 技能发现机制

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Skill 发现与加载流程                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Skill Scan Pattern:                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ~/.claude/skills/**/SKILL.md          (全局)                   │   │
│  │  ~/.agents/skills/**/SKILL.md          (全局)                   │   │
│  │  .claude/skills/**/SKILL.md            (项目级)                 │   │
│  │  {skill,skills}/**/SKILL.md             (opencode 内置)          │   │
│  │  配置指定路径/**/SKILL.md               (自定义)                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Skill Format:                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ---                                                             │   │
│  │  name: skill-name                                               │   │
│  │  description: Skill description                                 │   │
│  │  ---                                                             │   │
│  │  # Skill Content                                                 │   │
│  │  技能的具体指令和工作流程...                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 技能格式化输出

```typescript
// Skill verbose 格式输出
export function fmt(list: Info[], opts: { verbose: boolean }) {
  if (opts.verbose) {
    return [
      "<available_skills>",
      ...list.flatMap((skill) => [
        "  <skill>",
        `    <name>${skill.name}</name>`,
        `    <description>${skill.description}</description>`,
        `    <location>${pathToFileURL(skill.location).href}</location>`,
        "  </skill>",
      ]),
      "</available_skills>",
    ].join("\n")
  }
  // 非 verbose 格式
  return ["## Available Skills", ...list.map((skill) =>
    `- **${skill.name}**: ${skill.description}`
  )].join("\n")
}
```

---

## 7. Instruction 指令系统

### 7.1 指令文件加载顺序

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  Instruction 加载优先级 (覆盖式)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. AGENTS.md (项目根目录)           - 项目代理规范                      │
│           │                                                                │
│           ▼                                                                │
│  2. AGENTS.md (全局配置)            - ~/.config/opencode/AGENTS.md       │
│           │                                                                │
│           ▼                                                                │
│  3. CLAUDE.md (项目根目录)           - Claude 代码规范                    │
│           │                                                                │
│           ▼                                                                │
│  4. CLAUDE.md (全局)                 - ~/.claude/CLAUDE.md                │
│           │                                                                │
│           ▼                                                                │
│  5. CONTEXT.md (已废弃)              - 上下文文件                         │
│                                                                          │
│  注意: 后加载的文件会覆盖前面的内容                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 指令加载代码

```typescript
// packages/opencode/src/session/instruction.ts

export async function system() {
  const paths = await systemPaths()
  const files = Array.from(paths).map(async (p) => {
    const content = await Filesystem.readText(p).catch(() => "")
    return content ? "Instructions from: " + p + "\n" + content : ""
  })
  // 支持 URL 远程加载
}
```

---

## 8. 工具描述格式

### 8.1 Bash 工具描述

```markdown
# packages/opencode/src/tool/bash.txt

Executes a given bash command in a persistent shell session with
optional timeout, ensuring proper handling and security measures.

## 关键规则

1. Directory Verification:
   - 创建目录/文件前，先用 ls 验证父目录存在
   - 例如: mkdir foo/bar 前先 ls foo

2. Command Execution:
   - 包含空格的路径用双引号括起
   - 正确: mkdir "/Users/name/My Documents"
   - 错误: mkdir /Users/name/My Documents

3. 避免使用的 Bash 命令:
   - find, grep, cat, head, tail, sed, awk, echo
   - 应使用专用工具: Glob, Grep, Read, Edit, Write

4. 多命令执行:
   - 独立命令: 并行调用
   - 依赖命令: 用 && 链式调用
   - 禁止: cd <dir> && <command> (使用 workdir 参数)

## Git 操作规则

Only create commits when requested by the user.

Git Safety Protocol:
- NEVER update git config
- NEVER run destructive git commands
- NEVER skip hooks
- NEVER force push to main/master
- NEVER commit unless explicitly asked
```

### 8.2 Read 工具描述

```markdown
# packages/opencode/src/tool/read.txt

Read a file or directory from the local filesystem.

Usage:
- filePath: 绝对路径
- offset: 起始行号 (1-indexed)
- limit: 返回行数 (默认 2000)

Features:
- 行号前缀格式: "1: content\n2: content\n"
- 目录返回: 每行一个条目,子目录带 /
- 超过 2000 字符的行会被截断
- 可读取图片和 PDF

Best Practices:
- 并行读取多个已知路径的文件
- 避免微小分片 (30 行)
- 需要更多上下文时读取更大窗口
```

### 8.3 Task 工具描述

```markdown
# packages/opencode/src/tool/task.txt

Launch a new agent to handle complex, multistep tasks autonomously.

Available agent types and the tools they have access to:
{agents}

When to use Task:
- 执行复杂的多步骤任务
- 匹配专用代理描述的任务
- 用户要求执行自定义 slash 命令

When NOT to use Task:
- 读取特定文件路径 -> 使用 Read/Glob
- 搜索特定类定义 -> 使用 Glob
- 搜索文件内容 -> 使用 Grep

Usage Notes:
1. 尽可能并行启动多个代理
2. 代理结果对用户不可见,需要主动汇报
3. 每次调用都是新上下文,除非提供 task_id
4. 明确告知代理是研究还是写代码
```

---

## 9. 权限与配置

### 9.1 权限配置层次

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Permission Layers (权限层次)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Default Permissions                            │   │
│  │  {                                                              │   │
│  │    "*": "allow",          // 默认允许所有                        │   │
│  │    doom_loop: "ask",      // 死循环询问                          │   │
│  │    question: "deny",       // 提问禁止                           │   │
│  │    plan_enter: "deny",     // 进入计划模式禁止                   │   │
│  │    plan_exit: "deny",     // 退出计划模式禁止                    │   │
│  │    read: {                                                        │   │
│  │      "*": "allow",                                               │   │
│  │      "*.env": "ask",        // .env 文件询问                      │   │
│  │      "*.env.*": "ask",                                            │   │
│  │      "*.env.example": "allow"                                    │   │
│  │    }                                                             │   │
│  │  }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    User Permissions (用户配置)                   │   │
│  │              .opencode/opencode.jsonc 中配置                     │   │
│  │  {                                                              │   │
│  │    "tools": {                                                    │   │
│  │      "github-triage": false,                                    │   │
│  │      "github-pr-search": false                                  │   │
│  │    }                                                             │   │
│  │  }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Agent-Specific Permissions                     │   │
│  │                                                                   │   │
│  │  Explore Agent:                                                 │   │
│  │  {                                                              │   │
│  │    "*": "deny",           // 禁止大部分工具                      │   │
│  │    grep: "allow", glob: "allow", read: "allow",                │   │
│  │    bash: "allow", webfetch: "allow", websearch: "allow"        │   │
│  │  }                                                              │   │
│  │                                                                   │   │
│  │  Plan Agent:                                                    │   │
│  │  {                                                              │   │
│  │    edit: { "*": "deny", ".opencode/plans/*.md": "allow" }       │   │
│  │  }                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 自定义 Agent 配置

```yaml
# .opencode/agent/translator.md
---
description: Translate content for a specified locale
mode: subagent
model: opencode/gemini-3.1-pro
color: "#44BA81"
tools:
  "*": false
  "github-triage": true
---

You are a professional translator and localization specialist.
```

---

## 10. 流程图解

### 10.1 消息构建流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Message Construction Flow                              │
│                    (消息构建流程)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Input                                                             │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. Select Agent (基于配置和模式)                                    │   │
│  │    • build (默认主代理)                                            │   │
│  │    • plan (计划模式)                                               │   │
│  │    • custom (用户定义)                                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 2. Build System Prompt                                            │   │
│  │    ┌────────────────────────────────────────────────────────────┐ │   │
│  │    │ a. Model-specific prompt (基于模型选择)                      │ │   │
│  │    │    anthropic.txt / beast.txt / gemini.txt / default.txt   │ │   │
│  │    ├────────────────────────────────────────────────────────────┤ │   │
│  │    │ b. Environment Info                                         │ │   │
│  │    │    • Working directory                                      │ │   │
│  │    │    • Git repo status                                        │ │   │
│  │    │    • Platform                                               │ │   │
│  │    │    • Today's date                                           │ │   │
│  │    ├────────────────────────────────────────────────────────────┤ │   │
│  │    │ c. Instructions (AGENTS.md, CLAUDE.md)                      │ │   │
│  │    ├────────────────────────────────────────────────────────────┤ │   │
│  │    │ d. Skills (available_skills XML format)                    │ │   │
│  │    └────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 3. Build Tool Descriptions                                        │   │
│  │    ┌────────────────────────────────────────────────────────────┐ │   │
│  │    │ Tool descriptions from *.txt files                        │ │   │
│  │    │ • bash.txt: Shell 命令                                     │ │   │
│  │    │ • read.txt: 文件读取                                       │ │   │
│  │    │ • edit.txt: 字符串替换                                     │ │   │
│  │    │ • glob.txt: 文件搜索                                       │ │   │
│  │    │ • grep.txt: 内容搜索                                       │ │   │
│  │    │ • task.txt: 子代理                                         │ │   │
│  │    │ • webfetch.txt: 网页抓取                                   │ │   │
│  │    │ • websearch.txt: 网络搜索                                   │ │   │
│  │    │ • skill.txt: 技能加载                                       │ │   │
│  │    └────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 4. Apply Permission Filter (基于 Agent 权限)                      │   │
│  │    • 某些工具可能被禁用                                            │   │
│  │    • 某些工具可能需要确认                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 5. Add Agent-Specific Prompt (如果是专用代理)                      │   │
│  │    • explore.txt: 探索代理                                        │   │
│  │    • compaction.txt: 压缩代理                                    │   │
│  │    • summary.txt: 总结代理                                       │   │
│  │    • title.txt: 标题代理                                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 6. Final Message to Model                                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Tool Call 执行流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Tool Call Execution Flow                               │
│                    (工具调用执行流程)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Model Response (tool_use)                                              │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Permission Check (权限检查)                                       │   │
│  │    ┌────────────────────────────────────────────────────────────┐│   │
│  │    │ 1. Is tool allowed for this agent?                        ││   │
│  │    │ 2. Does action match permission rules?                     ││   │
│  │    │ 3. Pattern matching (e.g., "*.env" -> ask)                 ││   │
│  │    └────────────────────────────────────────────────────────────┘│   │
│  │           │                    │                    │            │   │
│  │           ▼                    ▼                    ▼            │   │
│  │    ┌───────────┐       ┌───────────┐        ┌───────────┐        │   │
│  │    │   Allow   │       │    Ask    │        │   Deny    │        │   │
│  │    │  执行工具  │       │ 请求用户确认│        │  拒绝执行  │        │   │
│  │    └─────┬─────┘       └─────┬─────┘        └───────────┘        │   │
│  └──────────┼───────────────────┼───────────────────────────────────┘   │
│             │                   │                                        │
│             ▼                   ▼                                        │
│  ┌───────────────────┐  ┌───────────────────┐                          │
│  │ Tool Execution    │  │ User Confirmation │                          │
│  │                   │  │                   │                          │
│  │ • Read file       │  │ • Show prompt     │                          │
│  │ • Write file      │  │ • Wait for input  │                          │
│  │ • Bash command    │  │ • Continue/Deny   │                          │
│  │ • Search codebase │  └─────────┬─────────┘                          │
│  │ • Launch agent    │            │                                     │
│  └─────────┬─────────┘            │ (if confirmed)                       │
│            │                      ▼                                     │
│            └──────────┬───────────────────────────────────┐             │
│                       ▼                                                   │
│              ┌───────────────────┐                                     │
│              │ Tool Result       │                                     │
│              │                   │                                     │
│              │ • Success: output │                                     │
│              │ • Error: message  │                                     │
│              │ • Truncated: file │                                     │
│              └─────────┬─────────┘                                     │
│                        │                                                │
│                        ▼                                                │
│              ┌───────────────────┐                                     │
│              │ Continue to Next   │                                     │
│              │ Model Turn         │                                     │
│              └───────────────────┘                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 完整对话生命周期

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Complete Conversation Lifecycle                        │
│                    (完整对话生命周期)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User: "Fix the login bug"                                              │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Session Init                                                      │   │
│  │    • Load agent config (build/plan/custom)                       │   │
│  │    • Load system prompt (model-specific)                         │   │
│  │    • Load instructions (AGENTS.md, CLAUDE.md)                   │   │
│  │    • Load available skills                                       │   │
│  │    • Build tool list with descriptions                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Turn 1: Model Processing                                          │   │
│  │    • Analyze user request                                         │   │
│  │    • Plan investigation steps                                    │   │
│  │    • Use grep/glob to search codebase                             │   │
│  │    • Decide tool calls                                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Tool Execution Loop                                               │   │
│  │    │                                                               │   │
│  │    ├───► Read auth/login.ts                                      │   │
│  │    │         │                                                    │   │
│  │    ├───► Grep "password" in auth/                                │   │
│  │    │         │                                                    │   │
│  │    ├───► Read config/auth.json                                   │   │
│  │    │         │                                                    │   │
│  │    └───► Analyze findings                                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Turn N: Implementation                                           │   │
│  │    • Edit files to fix bug                                       │   │
│  │    • Use TodoWrite to track progress                             │   │
│  │    • Run tests to verify                                         │   │
│  │    • Run lint/typecheck                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Completion                                                        │   │
│  │    • Summarize changes                                           │   │
│  │    • Mark todos complete                                         │   │
│  │    • Yield to user                                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 附录: 关键文件路径

| 类别 | 文件路径 |
|------|----------|
| **模型 Prompt** | `packages/opencode/src/session/prompt/*.txt` |
| **系统选择逻辑** | `packages/opencode/src/session/system.ts` |
| **Agent 定义** | `packages/opencode/src/agent/agent.ts` |
| **Agent Prompt** | `packages/opencode/src/agent/prompt/*.txt` |
| **工具注册** | `packages/opencode/src/tool/registry.ts` |
| **工具描述** | `packages/opencode/src/tool/*.txt` |
| **技能系统** | `packages/opencode/src/skill/skill.ts` |
| **指令加载** | `packages/opencode/src/session/instruction.ts` |
| **命令模板** | `packages/opencode/src/command/template/*.txt` |
| **用户配置** | `.opencode/opencode.jsonc` |
| **自定义代理** | `.opencode/agent/*.md` |

---

*文档生成时间: 2026-03-19*
*基于 OpenCode 源码分析*
