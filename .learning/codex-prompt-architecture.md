# Codex System Prompts 与工具架构详解

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [System Prompt 体系](#2-system-prompt-体系)
3. [工具 (Tools) 系统](#3-工具-tools-系统)
4. [协作模式 (Collaboration Modes)](#4-协作模式-collaboration-modes)
5. [记忆系统 (Memory System)](#5-记忆系统-memory-system)
6. [MCP 工具调用机制](#6-mcp-工具调用机制)
7. [Prompt 模板文件清单](#7-prompt-模板文件清单)
8. [关键数据流图](#8-关键数据流图)

---

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Codex 系统架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐  │
│  │   User      │────▶│              Codex Core (Rust)                   │  │
│  │  Terminal   │     │  ┌─────────────────────────────────────────────┐ │  │
│  └─────────────┘     │  │            Prompt System                    │ │  │
│                      │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │ │  │
│                      │  │  │  Base    │ │Personality│ │Collaboration │ │ │  │
│                      │  │  │ prompt   │ │ 模板      │ │ Mode 模板    │ │ │  │
│                      │  │  └──────────┘ └──────────┘ └──────────────┘ │ │  │
│                      │  └─────────────────────────────────────────────┘ │  │
│                      │                       │                          │  │
│                      │  ┌─────────────────────────────────────────────┐ │  │
│                      │  │            Tool System                       │ │  │
│                      │  │  ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │ │  │
│                      │  │  │ Built-in│ │   MCP   │ │ Dynamic Tools  │ │ │  │
│                      │  │  │ Handlers│ │ Servers │ │                 │ │ │  │
│                      │  │  └────┬────┘ └────┬────┘ └──────┬──────────┘ │ │  │
│                      │  │       │           │              │            │ │  │
│                      │  │       └───────────┴──────────────┘            │ │  │
│                      │  │                   │                           │ │  │
│                      │  │            Tool Registry                      │ │  │
│                      │  │     (ToolSpec → JSON Schema)                  │ │  │
│                      │  └─────────────────────────────────────────────────┘ │  │
│                      │                       │                          │  │
│                      │  ┌─────────────────────────────────────────────┐ │  │
│                      │  │          Agent Control Plane                  │ │  │
│                      │  │  • Role Config  • Memory System  • Guardian  │ │  │
│                      │  └─────────────────────────────────────────────┘ │  │
│                      └──────────────────────────────────────────────────────┘  │
│                                          │                                    │
│                      ┌───────────────────┼───────────────────┐               │
│                      ▼                   ▼                   ▼               │
│               ┌────────────┐      ┌────────────┐      ┌────────────┐         │
│               │  OpenAI    │      │  MCP       │      │   Shell    │         │
│               │  Responses │      │  Servers   │      │   Tool     │         │
│               │  API       │      │ (外部工具)  │      │   MCP      │         │
│               └────────────┘      └────────────┘      └────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Prompt 体系

### 2.1 Prompt 层次结构

Codex 的 System Prompt 由多个层次组成，按优先级排列：

```
┌──────────────────────────────────────────────────────────────────┐
│                     Prompt 优先级层次 (从高到低)                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. AGENTS.md         ← 用户在项目目录中创建的指令文件              │
│     (可继承、可覆盖)                                                │
│                         ↓ 覆盖                                    │
│  2. Base Instructions ← 核心 System Prompt (prompt.md)            │
│                         ↓ 合并                                    │
│  3. Personality       ← 人格模板 (friendly/pragmatic)             │
│                         ↓ 合并                                    │
│  4. Collaboration     ← 协作模式 (default/plan/pair/execute)      │
│     Mode                                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| `prompt.md` | `codex-rs/core/src/prompt.md` | 基础 System Prompt |
| `AGENTS.md` | `codex-rs/core/src/../AGENTS.md` | 项目级 Agent 指令 |
| `stage_one_system.md` | `codex-rs/core/templates/memories/` | 记忆系统 Prompt |
| `gpt-5.2-codex_instructions_template.md` | `codex-rs/core/templates/model_instructions/` | 模型指令模板 |

### 2.3 Base Instructions (`prompt.md`)

这是 Codex 的核心 System Prompt，主要内容包括：

```markdown
# 核心指令结构

## 身份定义
"You are Codex, a coding agent based on GPT-5."

## 行为准则
- 协作姿态：与用户作为平等的共建者
- 简洁直接：保持输出紧凑、低噪音
- 可操作性：优先提供可执行的指导

## 工具使用
- 优先使用 rg 进行搜索
- 使用 apply_patch 进行单文件编辑
- 使用 plan 工具进行复杂任务规划

## Git 行为
- 不自动 revert 非本人造成的更改
- 避免使用破坏性命令 (git reset --hard)
- 遇到未知变更立即停止并询问

## 代码风格
- 遵循: user > AGENTS.md > 本地约定 > 默认最佳实践
- 使用清晰的注释，避免无意义的注释
- 优先可读性而非技巧性
```

### 2.4 Personality 模板

人格模板定义了 Agent 的沟通风格，存在两个预设：

#### Friendly 模式 (`gpt-5.2-codex_friendly.md`)
```markdown
# Personality
You optimize for team morale and being a supportive teammate...

## Values
- Empathy: 调整解释、节奏和语气以最大化理解和信心
- Collaboration: 积极邀请输入、综合观点、使他人成功
- Ownership: 对代码和团队成员是否被解除阻碍负责

## Tone
- Warm, encouraging, conversational
- 使用 "we" 和 "let's"
- 决不粗鲁或轻蔑
```

#### Pragmatic 模式
简洁、直接、友好，优先高效沟通。

### 2.5 AGENTS.md 继承机制

```
workspace/
├── AGENTS.md          ← 顶层指令，作用于整个目录树
├── src/
│   └── AGENTS.md      ← 更深层嵌套的 AGENTS.md 优先
└── tests/
    └── AGENTS.md      ← 最优先
```

---

## 3. 工具 (Tools) 系统

### 3.1 工具类型分类

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ToolSpec 枚举类型                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ToolSpec::Function(ResponsesApiTool)                               │
│      ├── name: String           ← 工具名称                          │
│      ├── description: String    ← 工具描述                          │
│      ├── strict: bool           ← 是否严格模式                      │
│      ├── parameters: JsonSchema ← 参数 JSON Schema                  │
│      └── output_schema: Value   ← 输出 JSON Schema                  │
│                                                                     │
│  ToolSpec::ToolSearch { ... }      ← 工具搜索功能                   │
│  ToolSpec::LocalShell { }          ← 本地 Shell 执行               │
│  ToolSpec::ImageGeneration { ... } ← 图像生成                       │
│  ToolSpec::WebSearch { ... }       ← Web 搜索                       │
│  ToolSpec::Freeform(FreeformTool) ← Freeform 格式 (如 apply_patch) │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 内置工具 Handlers

工具处理器模块位于 `codex-rs/core/src/tools/handlers/`:

| Handler | 文件 | 功能 |
|---------|------|------|
| `apply_patch` | `apply_patch.rs` | 补丁应用 - 核心编辑工具 |
| `shell` | `shell.rs` | Shell 命令执行 |
| `unified_exec` | `unified_exec.rs` | 统一执行 (exec_command, write_stdin) |
| `read_file` | `read_file.rs` | 文件读取 |
| `grep_files` | `grep_files.rs` | 文件搜索 (rg) |
| `list_dir` | `list_dir.rs` | 目录列表 |
| `plan` | `plan.rs` | 规划工具 |
| `mcp` | `mcp.rs` | MCP 协议工具 |
| `mcp_resource` | `mcp_resource.rs` | MCP 资源访问 |
| `artifacts` | `artifacts.rs` | 工件管理 |
| `multi_agents` | `multi_agents.rs` | 多 Agent 支持 |
| `tool_search` | `tool_search.rs` | 工具搜索 |
| `tool_suggest` | `tool_suggest.rs` | 工具建议 |
| `request_permissions` | `request_permissions.rs` | 权限请求 |
| `request_user_input` | `request_user_input.rs` | 用户输入请求 |
| `js_repl` | `js_repl.rs` | JavaScript REPL |
| `test_sync` | `test_sync.rs` | 测试同步 |
| `view_image` | `view_image.rs` | 图像查看 |
| `dynamic` | `dynamic.rs` | 动态工具 |
| `code_mode` | `code_mode/mod.rs` | Code Mode 执行 |

### 3.3 核心工具详解

#### 3.3.1 exec_command (Shell 执行)

```rust
// 定义位置: codex-rs/core/src/tools/spec.rs:643-723

ToolSpec::Function(ResponsesApiTool {
    name: "exec_command",
    description: "Runs a command in a PTY...",
    parameters: JsonSchema::Object {
        properties: {
            "cmd": String,           // 要执行的命令
            "workdir": String,       // 工作目录
            "shell": String,         // Shell 类型
            "tty": Boolean,          // 是否分配 TTY
            "yield_time_ms": Number, // 等待输出的时间
            "max_output_tokens": Number, // 最大输出 token 数
            "login": Boolean,        // 是否使用登录 Shell
            "sandbox_permissions": String, // 沙箱权限
            "justification": String, // 权限提升理由
            "prefix_rule": [String], // 前缀命令建议
        },
        required: ["cmd"],
    },
    output_schema: unified_exec_output_schema(),
})
```

#### 3.3.2 apply_patch (补丁应用)

```rust
// apply_patch 支持两种格式

// 1. Freeform 格式
ToolSpec::Freeform(FreeformTool {
    name: "apply_patch",
    format: FreeformToolFormat::Patch,
})

// 2. JSON 格式 (ResponsesApiTool)
ToolSpec::Function(ResponsesApiTool {
    name: "apply_patch",
    description: "Apply patch to file...",
    parameters: JsonSchema::Object {
        properties: {
            "path": String,
            "edits": Array[{
                "old_string": String,
                "new_string": String,
                "replacement_count": Number,
            }],
        },
        required: ["path", "edits"],
    },
})
```

### 3.4 工具 JSON Schema 定义

```rust
// 位置: codex-rs/core/src/tools/spec.rs:470-524

pub enum JsonSchema {
    Boolean { description: Option<String> },
    String { description: Option<String> },
    Number { description: Option<String> },
    Array {
        items: Box<JsonSchema>,
        description: Option<String>,
    },
    Object {
        properties: BTreeMap<String, JsonSchema>,
        required: Option<Vec<String>>,
        additional_properties: Option<AdditionalProperties>,
    },
}
```

---

## 4. 协作模式 (Collaboration Modes)

### 4.1 模式类型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Collaboration Modes                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │     Default     │  │      Plan       │  │ Pair Programming│              │
│  │    (默认模式)    │  │     (计划模式)   │  │   (结对编程)     │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                   │                    │                        │
│           ▼                   ▼                    ▼                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 通用协作指令     │  │ 三阶段计划流程   │  │ 共享 Terminal   │              │
│  │ 简洁输出优先     │  │ 1. 环境探索      │  │ 实时同步        │              │
│  │ request_user    │  │ 2. 意图确认      │  │ 共享光标位置    │              │
│  │ _input 可用      │  │ 3. 实现讨论      │  │                │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                             │
│           ┌─────────────────┐                                                │
│           │     Execute     │                                                │
│           │     (执行模式)    │                                                │
│           └────────┬────────┘                                                │
│                    │                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────┐                                │
│  │ 专注执行任务                              │                                │
│  │ 与 Plan Mode 相反 - 执行而非规划          │                                │
│  │ 使用 update_plan 跟踪进度                 │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Plan Mode 详解

Plan Mode 是一个严格的三阶段流程：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Plan Mode 工作流                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                   │
│  │ PHASE 1      │ 环境探索 (Explore First)                          │
│  │ Ground in    │ ─────────────────────────────────────────────     │
│  │ environment  │ • 通过非变更性操作消除未知                          │
│  │              │ • 静默探索是允许的                                 │
│  │              │ • 只有无法从环境获得的信息才询问用户                 │
│  └──────┬───────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │ PHASE 2      │ 意图确认 (Intent Chat)                            │
│  │ Intent chat  │ ─────────────────────────────────────────────     │
│  │              │ • 明确: 目标 + 成功标准 + 受众                     │
│  │              │ • 明确: 范围、约束、当前状态                        │
│  │              │ • 偏好: 多问而非猜测                               │
│  └──────┬───────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │ PHASE 3      │ 实现讨论 (Implementation Chat)                    │
│  │ Implementation│ ─────────────────────────────────────────────     │
│  │ chat         │ • 明确: 方案、接口、数据流                         │
│  │              │ • 明确: 边界情况、测试、验收标准                     │
│  │              │ • 只有决策完备时才输出 <proposed_plan>              │
│  └──────┬───────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    <proposed_plan>                          │   │
│  │  # Title                    (必须包含)                        │   │
│  │  ## Summary                 (必须包含)                        │   │
│  │  ## Key Changes             (必须包含)                        │   │
│  │  ## Test Plan               (必须包含)                        │   │
│  │  ## Assumptions             (必须包含)                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. 记忆系统 (Memory System)

### 5.1 记忆架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Memory System Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Raw Memory Extraction                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  stage_one_system.md + stage_one_input.md                           │    │
│  │  → Memory Writing Agent                                              │    │
│  │  → 输出: rollout_summary + raw_memory                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  Phase 2: Consolidation                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  consolidation.md                                                   │    │
│  │  → 合并 raw_memories → memory_summary.md + MEMORY.md                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  记忆文件结构 ($memory_root/):                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  memory_summary.md      ← 始终加载到 System Prompt                  │    │
│  │  MEMORY.md              ← 手册条目，支持关键词搜索                    │    │
│  │  raw_memories.md        ← 临时文件: Phase 1 原始输出                 │    │
│  │  skills/<skill-name>/   ← 可复用程序: SKILL.md + scripts/           │    │
│  │  rollout_summaries/     ← 历史经验教训                              │    │
│  │    <rollout_slug>.md                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 记忆写入规则

```
NO-OP 优先原则:
┌─────────────────────────────────────────────────────────────────────┐
│  如果没有有价值的可复用学习 → 返回空字段                              │
│  {"rollout_summary":"", "rollout_slug":"", "raw_memory":""}        │
└─────────────────────────────────────────────────────────────────────┘

高价值记忆类型:
1. 稳定的用户操作偏好
   - 用户反复要求、纠正或中断以强制执行的
2. 高杠杆程序性知识
   - 硬掌握的快捷方式、失败防护、确切路径
3. 可靠的任务映射和决策触发器
   - 真相所在位置、如何判断错误方向
4. 持久的环境和工作流证据
   - 稳定的工具习惯、仓库约定
```

---

## 6. MCP 工具调用机制

### 6.1 MCP 架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MCP Tool Calling Flow                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Codex Core ──────▶ MCP Connection Manager ──────▶ MCP Server             │
│                      │                                │                      │
│                      │                                ▼                      │
│                      │                         ┌─────────────┐              │
│                      │                         │ shell-tool  │              │
│                      │                         │   -mcp      │              │
│                      │                         │  (内置)     │              │
│                      │                         └─────────────┘              │
│                      │                                │                      │
│                      │                                ▼                      │
│                      │                         ┌─────────────┐              │
│                      │                         │  External   │              │
│                      │                         │  MCP Servers│              │
│                      │                         │  (用户配置)  │              │
│                      │                         └─────────────┘              │
│                      │                                                       │
│                      ▼                                                       │
│               ┌─────────────────┐                                            │
│               │   Tool Call     │                                            │
│               │   Event Log     │                                            │
│               │ McpToolCallBegin │                                            │
│               │ McpToolCallEnd   │                                            │
│               └─────────────────┘                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 MCP 工具调用流程

```rust
// 位置: codex-rs/core/src/mcp_tool_call.rs

pub async fn handle_mcp_tool_call(
    sess: Arc<Session>,
    turn_context: &Arc<TurnContext>,
    call_id: String,
    server: String,        // MCP 服务器名称
    tool_name: String,    // 工具名称
    arguments: String,    // JSON 参数
) -> CallToolResult {

    // 1. 解析参数
    let arguments_value = serde_json::from_str(&arguments)?;

    // 2. 查找 MCP 工具元数据
    let metadata = lookup_mcp_tool_metadata(...).await;

    // 3. 检查工具策略
    let app_tool_policy = connectors::app_tool_policy(...);

    // 4. 发送开始事件
    sess.emit_mcp_tool_call_begin(...).await;

    // 5. 执行工具调用
    let result = mcp_connection_manager.call_tool(...).await;

    // 6. 发送结束事件
    sess.emit_mcp_tool_call_end(...).await;

    result
}
```

### 6.3 Shell Tool MCP 特性

`shell-tool-mcp` 是一个特殊的内置 MCP 服务器：

```
shell-tool-mcp 特性:
├── 拦截 execve(2) 系统调用
├── 通过 .rules 文件定义命令处理方式
│   ├── allow: 提升并在沙箱外运行
│   ├── prompt: 请求人工批准
│   └── forbidden: 以退出码 1 失败
└── 支持 sandbox state 查询
```

---

## 7. Prompt 模板文件清单

### 7.1 模板目录结构

```
codex-rs/core/templates/
├── agents/
│   └── orchestrator.md              # Agent 编排器提示
├── collab/
│   └── experimental_prompt.md       # 实验性提示
├── collaboration_mode/
│   ├── default.md                   # 默认协作模式
│   ├── execute.md                   # 执行模式
│   ├── pair_programming.md          # 结对编程模式
│   └── plan.md                      # 计划模式
├── compact/
│   ├── prompt.md                    # 上下文压缩提示
│   └── summary_prefix.md            # 压缩前缀
├── memories/
│   ├── consolidation.md             # 记忆整合 (Phase 2)
│   ├── read_path.md
│   ├── stage_one_input.md           # 记忆输入 (Phase 1)
│   └── stage_one_system.md          # 记忆系统提示 (Phase 1)
├── model_instructions/
│   └── gpt-5.2-codex_instructions_template.md  # 模型指令模板
├── personalities/
│   ├── gpt-5.2-codex_friendly.md    # 友好人格
│   └── gpt-5.2-codex_pragmatic.md   # 务实人格
├── review/
│   ├── exit_interrupted.xml
│   ├── exit_success.xml
│   ├── history_message_completed.md
│   └── history_message_interrupted.md
├── search_tool/
│   ├── tool_description.md
│   └── tool_suggest_description.md
└── tools/
    └── presentation_artifact.md
```

### 7.2 内嵌 Prompt (include_str!)

这些 Prompt 通过 `include_str!` 宏直接嵌入 Rust 二进制：

| 常量 | 文件 | 用途 |
|------|------|------|
| `REVIEW_PROMPT` | `../review_prompt.md` | 代码审查系统提示 |
| `REVIEW_EXIT_SUCCESS_TMPL` | `../templates/review/exit_success.xml` | 审查成功模板 |
| `REVIEW_EXIT_INTERRUPTED_TMPL` | `../templates/review/exit_interrupted.xml` | 审查中断模板 |
| `SUMMARIZATION_PROMPT` | `../templates/compact/prompt.md` | 压缩摘要提示 |
| `SUMMARY_PREFIX` | `../templates/compact/summary_prefix.md` | 摘要前缀 |
| `PROMPT` (memories) | `../../templates/memories/stage_one_system.md` | 记忆系统提示 |
| `COLLABORATION_MODE_PLAN` | `../../templates/collaboration_mode/plan.md` | 计划模式 |
| `COLLABORATION_MODE_DEFAULT` | `../../templates/collaboration_mode/default.md` | 默认模式 |
| `BASE_INSTRUCTIONS` | `../../prompt.md` | 基础指令 |
| `TOOL_SEARCH_DESCRIPTION_TEMPLATE` | `../../templates/search_tool/tool_description.md` | 工具搜索描述 |
| `TOOL_SUGGEST_DESCRIPTION_TEMPLATE` | `../../templates/search_tool/tool_suggest_description.md` | 工具建议描述 |

---

## 8. 关键数据流图

### 8.1 Prompt 组装流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Prompt 组装流程 (从请求到 API)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Input                                                                │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     Prompt Builder                                  │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │ 1. BaseInstructions (prompt.md)                              │  │    │
│  │  │ 2. + AGENTS.md (项目目录继承)                                 │  │    │
│  │  │ 3. + Personality (friendly/pragmatic)                       │  │    │
│  │  │ 4. + Collaboration Mode (default/plan/pair/execute)         │  │    │
│  │  │ 5. + Memory Summary (如果存在)                               │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                          Prompt                                     │    │
│  │  input: Vec<ResponseItem>        ← 对话上下文                       │    │
│  │  tools: Vec<ToolSpec>            ← 可用工具                          │    │
│  │  parallel_tool_calls: bool       ← 是否并行                          │    │
│  │  base_instructions: BaseInstructions                               │    │
│  │  personality: Option<Personality> ← 人格配置                         │    │
│  │  output_schema: Option<Value>     ← 输出 Schema                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│                           OpenAI Responses API                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 工具调用完整流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      工具调用完整流程                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Model 返回 Tool Call                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ { "tool": "exec_command", "arguments": { "cmd": "ls -la" } }       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  2. Tool Registry 查找 Handler                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ToolRegistryBuilder                                                 │    │
│  │   .add("exec_command", ShellCommandHandler)                        │    │
│  │   .add("apply_patch", ApplyPatchHandler)                            │    │
│  │   .add("read_file", ReadFileHandler)                                │    │
│  │   ...                                                                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  3. Handler 执行                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ShellCommandHandler::execute(call_id, arguments)                   │    │
│  │   ├── 解析参数 (serde_json)                                         │    │
│  │   ├── 权限检查 (sandbox_policy)                                     │    │
│  │   ├── 沙箱执行 (Seatbelt/sandbox-exec)                              │    │
│  │   └── 返回结果                                                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  4. 结果序列化                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ UnifiedExecOutput {                                                 │    │
│  │   chunk_id: String,                                                  │    │
│  │   wall_time_seconds: f32,                                           │    │
│  │   exit_code: i32,                                                   │    │
│  │   session_id: u32,                                                  │    │
│  │   original_token_count: u32,                                       │    │
│  │   output: String,                                                   │    │
│  │ }                                                                   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  5. 返回给 Model (作为 FunctionCallOutput)                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 附录: 关键源码文件索引

| 功能 | 文件路径 |
|------|----------|
| Prompt 定义 | `codex-rs/core/src/client_common.rs` |
| ToolSpec 定义 | `codex-rs/core/src/client_common.rs` (tools 模块) |
| 工具 Schema | `codex-rs/core/src/tools/spec.rs` |
| 工具 Handlers | `codex-rs/core/src/tools/handlers/mod.rs` |
| MCP 调用 | `codex-rs/core/src/mcp_tool_call.rs` |
| MCP 客户端 | `codex-rs/core/src/mcp/mod.rs` |
| 记忆系统 | `codex-rs/core/src/memories/mod.rs` |
| 协作模式 | `codex-rs/core/src/models_manager/collaboration_mode_presets.rs` |
| 自定义 Prompt | `codex-rs/core/src/custom_prompts.rs` |
| Shell Tool MCP | `shell-tool-mcp/src/index.ts` |

---

*文档生成日期: 2026-03-20*
*基于 Codex v2026-03 版本分析*
