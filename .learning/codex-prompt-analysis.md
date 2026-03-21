# Codex Prompt & Tool Calling 架构分析

## 概述

Codex 是 OpenAI 开发的开源编程代理，运行在用户的本地计算机上。本文档分析其 System Prompts 和工具调用机制的架构设计。

---

## 1. System Prompts 组织结构

### 1.1 目录位置

```
vendors/codex/codex-rs/
├── core/
│   ├── prompt.md                          # 核心基础指令
│   ├── gpt_5_codex_prompt.md              # GPT-5 Codex 特定指令
│   ├── review_prompt.md                   # 代码审查指南
│   ├── prompt_with_apply_patch_instructions.md
│   ├── hierarchical_agents_message.md
│   └── templates/
│       ├── memories/
│       │   ├── stage_one_system.md        # Memory Writing Agent
│       │   ├── stage_one_input.md
│       │   ├── consolidation.md
│       │   └── read_path.md
│       ├── search_tool/
│       │   ├── tool_description.md        # tool_search 描述
│       │   └── tool_suggest_description.md
│       ├── personalities/
│       │   ├── gpt-5.2-codex_friendly.md
│       │   └── gpt-5.2-codex_pragmatic.md
│       ├── collaboration_mode/
│       │   ├── default.md
│       │   ├── plan.md
│       │   ├── execute.md
│       │   └── pair_programming.md
│       ├── compact/
│       │   ├── prompt.md
│       │   └── summary_prefix.md
│       ├── agents/
│       │   └── orchestrator.md
│       └── collab/
│           └── experimental_prompt.md
└── protocol/src/prompts/
    ├── base_instructions/
    │   └── default.md                     # 同 core/prompt.md
    ├── permissions/
    │   ├── sandbox_mode/
    │   │   ├── read_only.md
    │   │   ├── workspace_write.md
    │   │   └── danger_full_access.md
    │   └── approval_policy/
    │       ├── never.md
    │       ├── unless_trusted.md
    │       ├── on_failure.md
    │       ├── on_request_rule.md
    │       └── on_request_rule_request_permission.md
    └── realtime/
        ├── realtime_start.md
        └── realtime_end.md
```

### 1.2 Prompt 加载机制

Codex 通过 `include_str!` 宏在编译时将 Markdown 文件嵌入到二进制中：

```rust
// protocol/src/models.rs
pub const BASE_INSTRUCTIONS_DEFAULT: &str = include_str!("prompts/base_instructions/default.md");

// core/src/models_manager/model_info.rs
pub const BASE_INSTRUCTIONS: &str = include_str!("../../prompt.md");

// core/src/client_common.rs
pub const REVIEW_PROMPT: &str = include_str!("../review_prompt.md");
```

---

## 2. 核心 System Prompt 分析

### 2.1 Base Instructions (core/prompt.md)

这是 Codex 的主 System Prompt，275 行，包含以下主要章节：

```
1. 身份定义
   - "You are a coding agent running in the Codex CLI"
   
2. 能力范围
   - 接收用户提示和上下文
   - 流式思考和响应
   - 执行函数调用

3. AGENTS.md 规范
   - AGENTS.md 文件的作用域规则
   - 优先级：系统指令 > AGENTS.md > 更浅层目录

4. 响应性 (Responsiveness)
   - Preamble 消息规范（工具调用前的简短说明）
   - 示例：8-12 words 的简洁描述

5. 规划 (Planning)
   - update_plan 工具的使用指南
   - 何时使用计划（复杂任务、多步骤、用户明确要求等）

6. 任务执行
   - apply_patch 工具使用规范
   - 编码准则（根因修复、避免过度复杂、不修复无关bug等）

7. 验证工作
   - 测试哲学：先专后广
   - 不同审批模式下的验证策略

8. 野心与精确度
   - 新任务：可发挥创意
   - 现有代码库：精确手术式执行

9. 进度更新
   - 8-10 words 的简洁更新

10. 最终答案结构和风格
    - Section Headers 规则
    - Bullets 规则
    - Monospace 使用
    - File References 格式
    - Tone 指导

11. 工具指南
    - Shell 命令规范
    - update_plan 工具使用
```

### 2.2 Review Prompt (core/review_prompt.md)

用于代码审查场景，定义了：
- 8 条通用审查准则（判断是否为 bug）
- 6 条评论规范
- 优先级标签 [P0]-[P3]
- 输出 JSON Schema：
```json
{
  "findings": [{
    "title": "<80 chars>",
    "body": "Markdown explanation",
    "confidence_score": 0.0-1.0,
    "priority": 0-3,
    "code_location": {
      "absolute_file_path": "...",
      "line_range": {"start": int, "end": int}
    }
  }],
  "overall_correctness": "patch is correct" | "patch is incorrect",
  "overall_explanation": "1-3 sentences",
  "overall_confidence_score": 0.0-1.0
}
```

### 2.3 Memory Writing Agent (templates/memories/stage_one_system.md)

569 行的复杂 prompt，用于将对话历史转换为结构化记忆：
- 阶段分类：success | partial | fail | uncertain
- rollouts_summary 格式
- raw_memory 格式（含 frontmatter 和 task 分组）
- 严格的不做作规则（No-op allowed）

---

## 3. 工具调用(Tool Calling)架构

### 3.1 工具类型枚举

```rust
// core/src/client_common.rs
pub enum ToolSpec {
    Function(ResponsesApiTool),           // 标准函数工具
    ToolSearch {                          // 工具搜索
        execution: String,
        description: String,
        parameters: JsonSchema,
    },
    LocalShell {},                         // 本地 shell
    ImageGeneration {                     // 图像生成
        output_format: String,
    },
    WebSearch {                           // Web 搜索
        external_web_access: Option<bool>,
        filters: Option<ResponsesApiWebSearchFilters>,
        user_location: Option<ResponsesApiWebSearchUserLocation>,
        search_context_size: Option<WebSearchContextSize>,
        search_content_types: Option<Vec<String>>,
    },
    Freeform(FreeformTool),               // 自定义自由格式
}
```

### 3.2 核心工具清单

| 工具名称 | 类型 | 描述 |
|---------|------|------|
| `shell` | Function | 执行 shell 命令 |
| `exec_command` | Function | PTY 执行，返回 session ID |
| `write_stdin` | Function | 写入已存在的 exec session |
| `apply_patch` | Function | 文件补丁编辑 |
| `view_image` | Function | 查看本地图像 |
| `spawn_agent` | Function | 派生子代理 |
| `wait_agent` | Function | 等待代理完成 |
| `send_input` | Function | 向代理发送消息 |
| `resume_agent` | Function | 恢复已关闭的代理 |
| `close_agent` | Function | 关闭代理 |
| `tool_search` | ToolSearch | 搜索可用工具 |
| `tool_suggest` | Function | 建议安装/启用工具 |
| `request_user_input` | Function | 请求用户输入选项 |
| `request_permissions` | Function | 请求额外权限 |
| `grep_files` | Function | 正则搜索文件 |
| `web_search` | WebSearch | Web 搜索 |

### 3.3 工具路由架构

```
┌─────────────────────────────────────────────────────────────┐
│                     ToolRouter                              │
├─────────────────────────────────────────────────────────────┤
│  from_config(config, params)                                │
│    ├── build_specs_with_discoverable_tools()                │
│    │   └── ToolRegistryBuilder.build()                      │
│    └── model_visible_specs (filtered by code_mode)          │
├─────────────────────────────────────────────────────────────┤
│  build_tool_call(session, item)                             │
│    ├── ResponseItem::FunctionCall                           │
│    │   ├── parse_mcp_tool_name() → ToolPayload::Mcp         │
│    │   └── else → ToolPayload::Function                     │
│    ├── ResponseItem::ToolSearchCall → ToolPayload::Search    │
│    └── ResponseItem::CustomToolCall → ToolPayload::Custom    │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 工具调用流程图

```
┌──────────────┐    ResponseItem    ┌──────────────┐
│   LLM Model  │ ─────────────────► │ ToolRouter   │
└──────────────┘                    │build_tool_call│
                                   └──────┬───────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
           ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
           │ToolPayload::  │     │ToolPayload::  │     │ToolPayload::  │
           │  Function     │     │  Mcp         │     │  Search       │
           └───────┬───────┘     └───────┬───────┘     └───────┬───────┘
                   │                     │                     │
                   ▼                     ▼                     ▼
           ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
           │ToolRegistry   │     │MCP Connection │     │ ToolSearch    │
           │ dispatch()   │     │   Manager     │     │  Handler      │
           └───────┬───────┘     └───────┬───────┘     └───────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Shell   │  │ Apply   │  │ Spawn   │
│ Handler │  │ Patch   │  │ Agent   │
└─────────┘  └─────────┘  └─────────┘
```

---

## 4. 权限和安全模型

### 4.1 沙箱模式 (Sandbox Mode)

```
protocol/src/prompts/permissions/sandbox_mode/
├── read_only.md         → "The sandbox only permits reading files"
├── workspace_write.md   → 允许写入工作区
└── danger_full_access.md → 禁用沙箱
```

### 4.2 审批策略 (Approval Policy)

```
protocol/src/prompts/permissions/approval_policy/
├── never.md               → 从不审批，直接执行
├── unless_trusted.md      → 除非信任全部执行
├── on_failure.md          → 失败时审批
├── on_request_rule.md    → 按请求规则审批
└── on_request_rule_request_permission.md
```

### 4.3 权限请求工具参数

```rust
create_approval_parameters(exec_permission_approvals_enabled):
├── sandbox_permissions: "use_default" | "require_escalated" | "with_additional_permissions"
├── justification: String  (当 require_escalated 时)
├── prefix_rule: Vec<String>  (当 require_escalated 时)
└── additional_permissions: {  (当 enabled 时)
      network: { enabled: bool },
      file_system: { read: [], write: [] }
    }
```

---

## 5. MCP (Model Context Protocol) 集成

### 5.1 MCP 工具调用

```rust
// core/src/tools/router.rs
pub enum ToolPayload {
    Function { arguments: Value },
    Mcp {
        server: String,
        tool: String,
        raw_arguments: Value,
    },
    Search { query: String },
    Custom { name: String, arguments: Value },
}
```

### 5.2 MCP 工具发现

- `tool_search`: BM25 搜索 MCP 服务器上的工具元数据
- `tool_suggest`: 建议安装/启用连接器或插件

---

## 6. 协作模式 (Collaboration Mode)

### 6.1 模式类型

```
templates/collaboration_mode/
├── default.md         → 默认协作模式
├── plan.md           → 计划模式
├── execute.md        → 执行模式
└── pair_programming.md → 结对编程模式
```

### 6.2 多代理工具

- `spawn_agent`: 派生子代理
- `wait_agent`: 等待代理完成（支持超时）
- `send_input`: 向代理发送消息（支持 interrupt）
- `resume_agent`: 恢复已关闭的代理
- `close_agent`: 关闭代理

---

## 7. 关键设计模式

### 7.1 Prompt 模块化

- 核心指令与场景特定指令分离
- 通过 `include_str!` 编译时嵌入，便于版本控制

### 7.2 工具发现机制

- 静态工具：编译时注册
- 动态工具：通过 `tool_search` 发现
- MCP 工具：运行时连接

### 7.3 权限分层

```
User Approval
      │
      ▼
┌─────────────┐
│   Sandbox   │ ←── 沙箱模式决定文件系统/网络访问
└─────────────┘
      │
      ▼
┌─────────────┐
│   Tool      │ ←── 工具调用
└─────────────┘
```

---

## 8. 文件位置速查表

| 功能 | 文件路径 |
|------|---------|
| 核心 Prompt | `core/prompt.md` |
| GPT-5 指令 | `core/gpt_5_codex_prompt.md` |
| 审查 Prompt | `core/review_prompt.md` |
| Memory Agent | `core/templates/memories/stage_one_system.md` |
| 工具规范 | `core/src/tools/spec.rs` |
| 工具路由 | `core/src/tools/router.rs` |
| 工具类型定义 | `core/src/client_common.rs` |
| 协议模型 | `protocol/src/models.rs` |
| OpenAI 模型类型 | `protocol/src/openai_models.rs` |
| 沙箱 Prompt | `protocol/src/prompts/permissions/sandbox_mode/*.md` |
| 审批策略 | `protocol/src/prompts/permissions/approval_policy/*.md` |
