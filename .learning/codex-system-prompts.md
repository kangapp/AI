# Codex System Prompts & Tool Calling 详解

本文档详细介绍 Codex CLI 的 system prompt 系统和工具调用机制。

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Codex CLI                               │
├─────────────────────────────────────────────────────────────┤
│  Prompt 构建层 (core/src/client_common.rs)                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Prompt {                                            │    │
│  │   input: Vec<ResponseItem>,     // 对话历史          │    │
│  │   tools: Vec<ToolSpec>,         // 工具列表          │    │
│  │   parallel_tool_calls: bool,    // 是否并行调用      │    │
│  │   base_instructions: BaseInstructions,              │    │
│  │   personality: Option<Personality>,                 │    │
│  │   output_schema: Option<Value>                       │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Prompt 来源分层                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Core Prompt  │  │ Collaboration │  │   Personality   │    │
│  │ (prompt.md)  │  │    Mode       │  │    Module      │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  工具层 (ToolSpec 枚举)                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │ Function │ │ToolSearch│ │LocalShell│ │ImageGeneration│   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘   │
│  ┌──────────┐ ┌──────────┐                                  │
│  │WebSearch │ │ Freeform │                                  │
│  └──────────┘ └──────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core System Prompt (prompt.md)

**文件路径**: `codex-rs/core/prompt.md`

### 2.1 Agent 身份定义

```
You are a coding agent running in the Codex CLI, a terminal-based coding assistant.
Codex CLI is an open source project led by OpenAI.
```

### 2.2 人格设定 (Personality)

```markdown
Your default personality and tone is concise, direct, and friendly.
You communicate efficiently, always keeping the user clearly informed
about ongoing actions without unnecessary detail.
```

### 2.3 AGENTS.md 规范

Codex 支持仓库中的 `AGENTS.md` 文件，为 Agent 提供局部工作指引：

```
- AGENTS.md 的作用范围是其所在目录的整个子树
- 最终 patch 中每个文件必须遵守覆盖该文件的 AGENTS.md 指令
- 代码风格、结构、命名等指令仅在 AGENTS.md 范围内生效
- 更深嵌套的 AGENTS.md 在冲突时优先
- 直接的系统/开发者/用户指令优先于 AGENTS.md
```

### 2.4 Preamble 规则

Tool call 前需要发送 preamble 简报，示例：

```
"I've explored the repo; now checking the API route definitions."
"Next, I'll patch the config and update the related tests."
```

原则：
- 相关动作分组到同一个 preamble
- 保持简洁（8-12 词）
- 保持轻松友好的语气
- 异常：简单读取文件不需要 preamble

### 2.5 Planning 工具

```rust
update_plan 工具用于跟踪步骤和进度
```

使用场景：
- 任务复杂且需要多步操作
- 有逻辑依赖关系
- 工作有歧义需要概述
- 用户一次要求多件事

### 2.6 代码风格指南

```
- 优先修复根本原因而非表面补丁
- 解决方案避免不必要的复杂性
- 不尝试修复无关的 bug
- 按需更新文档
- 更改保持与现有代码库一致
- 使用 git log 和 git blame 获取额外上下文
- 永远不添加版权或许可证头
- apply_patch 后不重新读取文件（工具调用失败会通知）
- 不进行 git commit 或创建分支（除非明确要求）
- 不添加内联注释（除非明确要求）
- 不使用单字母变量名（除非明确要求）
```

---

## 3. Collaboration Modes (协作模式)

### 3.1 模式列表

| 模式 | 文件路径 | 描述 |
|------|---------|------|
| Default | `templates/collaboration_mode/default.md` | 默认模式 |
| Plan | `templates/collaboration_mode/plan.md` | 规划模式 |
| Execute | `templates/collaboration_mode/execute.md` | 执行模式 |
| Pair Programming | `templates/collaboration_mode/pair_programming.md` | 结对编程 |

### 3.2 Plan Mode 详解 (三阶段工作流)

```
┌─────────────────────────────────────────────────────────┐
│                    Plan Mode                            │
├─────────────────────────────────────────────────────────┤
│  PHASE 1: Ground in environment                          │
│  ├── 优先探索而非提问                                    │
│  ├── 消除可以通过探索回答的歧义                          │
│  └── 沉默探索是允许的                                   │
├─────────────────────────────────────────────────────────┤
│  PHASE 2: Intent Chat (what they actually want)         │
│  ├── 保持提问直到能清晰说明：目标 + 成功标准              │
│  ├── 偏差于提问而非猜测                                 │
│  └── 如有高影响歧义，暂不规划                           │
├─────────────────────────────────────────────────────────┤
│  PHASE 3: Implementation Chat (what/how we'll build)   │
│  ├── 保持提问直到规格决策完整                            │
│  ├── 方法、接口、数据流、边缘情况                       │
│  └── 测试 + 验收标准                                    │
└─────────────────────────────────────────────────────────┘
```

**Plan Mode 关键约束**：

| 允许 (非变更) | 不允许 (变更) |
|--------------|--------------|
| 读取/搜索文件 | 编辑/写入文件 |
| 静态分析 | 运行格式化程序 |
| 干运行命令 | 应用补丁 |
| 测试/构建（写缓存） | 执行计划 |

**最终计划格式**：
```markdown
<proposed_plan>
# 计划标题

## Summary
...

## Key Changes
...

## Test Plan
...

## Assumptions
...
</proposed_plan>
```

---

## 4. Personality 模块

### 4.1 Friendly Personality

**文件**: `templates/personalities/gpt-5.2-codex_friendly.md`

核心价值：
- **Empathy**: 调整解释、节奏和语气以最大化理解和信心
- **Collaboration**: 主动邀请输入，综合观点，让他人成功
- **Ownership**: 不仅对代码负责，也对队友是否被解除阻碍负责

语气特点：
- 温暖、鼓励、对话性
- 使用 "we" 和 "let's"
- 绝不冷漠或 dismissive
- 耐心、不易沮丧

### 4.2 Pragmatic Personality

**文件**: `templates/personalities/gpt-5.2-codex_pragmatic.md`

强调：
- 清晰、务实、严谨
- 高效沟通
- 直接提供可执行指导

---

## 5. 工具调用系统 (ToolSpec)

### 5.1 ToolSpec 枚举

**文件**: `codex-rs/core/src/tools/spec.rs`

```rust
pub(crate) enum ToolSpec {
    // OpenAI Responses API 函数工具
    Function(ResponsesApiTool),

    // 工具搜索（BM25 搜索 Apps/Connectors）
    ToolSearch {
        execution: String,
        description: String,
        parameters: JsonSchema,
    },

    // 本地 Shell 执行
    LocalShell {},

    // 图像生成
    ImageGeneration { output_format: String },

    // Web 搜索
    WebSearch {
        external_web_access: Option<bool>,
        filters: Option<ResponsesApiWebSearchFilters>,
        user_location: Option<ResponsesApiWebSearchUserLocation>,
        search_context_size: Option<WebSearchContextSize>,
    },

    // Freeform 工具（自定义格式）
    Freeform(FreeformTool),
}
```

### 5.2 apply_patch 工具

Codex 的核心文件编辑工具，支持两种格式：

**Freeform 格式**：
```rust
{"command":["apply_patch","*** Begin Patch\n*** Update File: path/to/file.py\n@@ def example():\n- pass\n+ return 123\n*** End Patch"]}
```

**JSON 格式**：
```rust
{
  "command": "apply_patch",
  "path": "path/to/file.py",
  "patch": "@@ def example():\n- pass\n+ return 123\n"
}
```

### 5.3 工具分类

| 工具类型 | 用途 | 示例 |
|---------|------|------|
| Function | 标准函数调用 | `grep`, `read`, `write` |
| ToolSearch | 动态发现工具 | 搜索 Apps/Connectors |
| LocalShell | 执行 shell 命令 | `bash`, `zsh` |
| ImageGeneration | 生成图像 | DALL-E 图像生成 |
| WebSearch | 搜索网络 | 搜索文档/代码 |
| Freeform | 自定义格式工具 | `apply_patch` |

---

## 6. Agent Roles (内置角色)

**文件**: `codex-rs/core/src/agent/role.rs`

### 6.1 内置角色

```rust
// Default Role
const DEFAULT_ROLE_NAME: &str = "default";

// Explorer Role - 用于代码库探索
"explorer": {
    description: "Use for specific codebase questions. Fast and authoritative.",
    rules: [
        "避免重复 explorer 已完成的工作",
        "鼓励并行 spawn 多个 explorer",
        "复用现有 explorer 处理相关问题"
    ]
}

// Worker Role - 用于执行和生产工作
"worker": {
    description: "Use for execution and production work.",
    tasks: [
        "实现功能部分",
        "修复测试或 bug",
        "将大型重构拆分为独立块"
    ],
    rules: [
        "明确分配任务所有权（文件/职责）",
        "告知 worker 他们不是一个人在代码库中"
    ]
}
```

### 6.2 Role 配置继承

```
┌─────────────────────────────────────────────────────┐
│  Config Layer Stack (优先级从低到高)                  │
├─────────────────────────────────────────────────────┤
│  1. Base Config                                     │
│  2. User Config (~/.config/codex/)                  │
│  3. Project Config (./.codex/)                       │
│  4. Agent Role Config                              │
│  5. Session Flags (运行时参数)                       │
└─────────────────────────────────────────────────────┘
```

---

## 7. Guardian 安全审查系统

**文件**: `codex-rs/core/src/guardian/policy.md`

### 7.1 Guardian Prompt

```markdown
You are performing a risk assessment of a coding-agent tool call.
Your primary objective is to determine whether the planned action
poses a high risk of irreversible damage to the user or organization.
```

### 7.2 风险评估原则

| 高风险动作 | 低风险动作 |
|-----------|-----------|
| 删除/损坏重要数据 | 创建/编辑小型本地文件 |
| 泄露凭证 | 重试被阻止的命令 |
| 暴露敏感信息到外部 | 移除明显空的路径 |
| 破坏性的大规模变更 | 用户明确要求的动作 |

### 7.3 Guardian 输出格式

```json
{
  "type": "object",
  "properties": {
    "risk_level": { "type": "string", "enum": ["low", "medium", "high"] },
    "risk_score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "rationale": { "type": "string" },
    "evidence": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

## 8. Memory System (记忆系统)

### 8.1 记忆读取路径

**文件**: `templates/memories/read_path.md`

```
Memory 布局 (从通用到具体):
├── {{ base_path }}/memory_summary.md      (摘要，已提供)
├── {{ base_path }}/MEMORY.md              (可搜索注册表)
├── {{ base_path }}/skills/<skill-name>/   (技能文件夹)
│   ├── SKILL.md                          (入口指令)
│   ├── scripts/                          (可选辅助脚本)
│   ├── examples/                         (可选示例)
│   └── templates/                        (可选模板)
└── {{ base_path }}/rollout_summaries/     (每次运行的总结)
```

### 8.2 快速记忆查询流程

```
1. 浏览 MEMORY_SUMMARY，提取任务相关关键词
2. 在 MEMORY.md 中搜索关键词
3. 仅当 MEMORY.md 直接指向 rollout summaries/skills 时，
   打开最相关的 1-2 个文件
4. 如不明确，搜索 rollout_path 获取精确证据
5. 如无相关命中，停止记忆查询，正常继续
```

### 8.3 Memory Writing Agent (Phase 1)

**文件**: `templates/memories/stage_one_system.md`

任务分类：

| Outcome | 描述 |
|---------|------|
| success | 任务完成，达到正确最终结果 |
| partial | 有意义进展，但不完全/未验证 |
| uncertain | 无明确成功/失败信号 |
| fail | 任务未完成，结果错误，陷入循环 |

**No-Op 门控**：如果 rollout 不包含有价值的可重用学习，返回：
```json
{"rollout_summary":"","rollout_slug":"","raw_memory":""}
```

---

## 9. Protocol 层 Base Instructions

**文件**: `protocol/src/prompts/base_instructions/default.md`

### 9.1 权限批准策略

| 策略 | 文件路径 | 描述 |
|------|---------|------|
| never | `permissions/approval_policy/never.md` | 从不自动批准 |
| on_failure | `permissions/approval_policy/on_failure.md` | 失败时批准 |
| on_request | `permissions/approval_policy/on_request_rule.md` | 按请求批准 |
| unless_trusted | `permissions/approval_policy/unless_trusted.md` | 除非信任否则批准 |

### 9.2 Sandbox 模式

| 模式 | 文件路径 | 描述 |
|------|---------|------|
| danger_full_access | `sandbox_mode/danger_full_access.md` | 完全访问权限 |
| read_only | `sandbox_mode/read_only.md` | 只读模式 |
| workspace_write | `sandbox_mode/workspace_write.md` | 仅工作区写入 |

---

## 10. Review System

### 10.1 Review Prompt

**文件**: `codex-rs/core/review_prompt.md`

Bug 优先级定义：
- **P0**: 崩溃、严重错误
- **P1**: 主要功能不工作
- **P2**: 次要问题
- **P3**: 微小问题

### 10.2 Review 输出格式

```xml
<!-- exit_success.xml -->
<review_complete>
  <summary>...</summary>
  <bug_count p0="0" p1="0" p2="0" p3="0"/>
</review_complete>

<!-- exit_interrupted.xml -->
<review_interrupted reason="..."/>
```

---

## 11. 自定义 Prompts

**文件**: `codex-rs/core/src/custom_prompts.rs`

Codex 支持从 `$CODEX_HOME/prompts` 目录加载自定义 prompt 文件。

**YAML Frontmatter 格式**：
```yaml
---
description: "自定义 prompt 描述"
argument-hint: "参数提示"
---
# Prompt 内容
```

---

## 12. Prompt 构建流程图

```
                    ┌──────────────────────────┐
                    │   User Input / Message   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              BaseInstructions 合并                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Default Base │  │ Sandbox Mode  │  │ Permissions  │  │
│  │ Instructions │  │   Policy     │  │   Policy     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                  Core Prompt 注入                         │
│              (prompt.md 内容)                            │
│  - Agent 身份定义                                         │
│  - Personality                                           │
│  - AGENTS.md 规范                                        │
│  - Preamble 规则                                         │
│  - Planning 指南                                          │
│  - Tool Guidelines                                       │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│              Collaboration Mode 注入                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Default │  │   Plan   │  │ Execute  │  │  Pair  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                Personality 注入 (可选)                    │
│  ┌──────────┐  ┌──────────┐                             │
│  │ Friendly │  │ Pragmatic │                             │
│  └──────────┘  └──────────┘                             │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                 Memory Context (可选)                    │
│  - memory_summary                                        │
│  - MEMORY.md                                             │
│  - rollout_summaries/                                    │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                   Tools 注入                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Function │  │ToolSearch│  │LocalShell│              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐                            │
│  │WebSearch │  │ Freeform │                            │
│  └──────────┘  └──────────┘                            │
└──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │   Final Prompt to LLM    │
                    └──────────────────────────┘
```

---

## 13. 关键文件速查表

| 功能 | 文件路径 |
|------|---------|
| 主 System Prompt | `codex-rs/core/prompt.md` |
| Plan Mode | `codex-rs/core/templates/collaboration_mode/plan.md` |
| Explorer Role | `codex-rs/core/src/agent/builtins/explorer.toml` |
| Guardian Policy | `codex-rs/core/src/guardian/policy.md` |
| Memory Read Path | `codex-rs/core/templates/memories/read_path.md` |
| Memory Phase 1 | `codex-rs/core/templates/memories/stage_one_system.md` |
| ToolSpec 定义 | `codex-rs/core/src/tools/spec.rs` |
| Prompt 构建 | `codex-rs/core/src/client_common.rs` |
| Agent Roles | `codex-rs/core/src/agent/role.rs` |
| Base Instructions | `protocol/src/prompts/base_instructions/default.md` |

---

## 14. 总结

Codex 的 Prompt 系统设计特点：

1. **分层组合**：Base Instructions + Core Prompt + Collaboration Mode + Personality
2. **模块化**：各部分独立，可按需组合
3. **工具丰富**：Function、WebSearch、LocalShell、ImageGeneration、Freeform
4. **安全优先**：Guardian 系统提供风险评估
5. **记忆系统**：支持长期上下文和历史学习
6. **可扩展**：支持自定义 Prompts 和 Agent Roles
