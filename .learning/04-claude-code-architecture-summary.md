# Claude Code 整体架构总结

> 基于 claude-code-2.1.88 源码分析

## 1. 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              CLAUDE CODE 整体架构                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                           USER INTERFACE LAYER                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │
│  │  │   REPL.tsx  │  │   SDK.ts    │  │  CLI.tsx    │  │  Web/IDE    │         │  │
│  │  │  (Terminal) │  │  (API)      │  │  (Commands) │  │  Integration│         │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │  │
│  └──────────┼────────────────┼────────────────┼────────────────┼──────────────┘  │
│             │                │                │                │                  │
│             └────────────────┴────────────────┴────────────────┘                  │
│                                        │                                           │
│                                        ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                          QUERY ENGINE LAYER                                  │  │
│  │                                                                              │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │  │
│  │  │   query.ts      │───▶│  QueryEngine.ts │───▶│  messages.ts    │        │  │
│  │  │  (User Input)   │    │  (Orchestrator) │    │  (History)      │        │  │
│  │  └─────────────────┘    └────────┬────────┘    └─────────────────┘        │  │
│  │                                  │                                           │  │
│  │                    ┌─────────────┼─────────────┐                            │  │
│  │                    ▼             ▼             ▼                            │  │
│  │           ┌────────────┐ ┌────────────┐ ┌────────────┐                     │  │
│  │           │PreToolUse  │ │   TOOL     │ │PostToolUse │                     │  │
│  │           │   Hooks    │ │ EXECUTOR   │ │   Hooks    │                     │  │
│  │           └────────────┘ └─────┬──────┘ └────────────┘                     │  │
│  │                                │                                              │  │
│  │                                ▼                                              │  │
│  │           ┌─────────────────────────────────────┐                            │  │
│  │           │        TOOL SYSTEM                   │                            │  │
│  │           │  ┌───────────────────────────────┐   │                            │  │
│  │           │  │  Tool[] (40+ built-in tools) │   │                            │  │
│  │           │  │  + MCP Tools                  │   │                            │  │
│  │           │  │  + Custom Tools              │   │                            │  │
│  │           │  └───────────────────────────────┘   │                            │  │
│  │           │  ┌───────────────────────────────┐   │                            │  │
│  │           │  │  assembleToolPool()           │   │                            │  │
│  │           │  │  (Tool Pool Assembly)         │   │                            │  │
│  │           │  └───────────────────────────────┘   │                            │  │
│  │           └─────────────────────────────────────┘                            │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                           │
│                                        ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                          SYSTEM PROMPT LAYER                                 │  │
│  │                                                                              │  │
│  │           ┌─────────────────────────────────────┐                            │  │
│  │           │  buildEffectiveSystemPrompt()        │                            │  │
│  │           │                                     │                            │  │
│  │           │  Priority:                           │                            │  │
│  │           │  1. overrideSystemPrompt             │                            │  │
│  │           │  2. coordinatorSystemPrompt          │                            │  │
│  │           │  3. agentSystemPrompt                │                            │  │
│  │           │  4. customSystemPrompt               │                            │  │
│  │           │  5. defaultSystemPrompt              │                            │  │
│  │           │  + appendSystemPrompt                 │                            │  │
│  │           └─────────────────────────────────────┘                            │  │
│  │                                        │                                     │  │
│  │                                        ▼                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │  │
│  │  │  DEFAULT SYSTEM PROMPT SECTIONS:                                        │   │  │
│  │  │                                                                       │   │  │
│  │  │  [Capabilities] [cliBasics] [env] [os] [toolDescriptions]             │   │  │
│  │  │  [mcpServers] [memoryFiles] [agentList] [settings] [claudeMd]       │   │  │
│  │  │                                                                       │   │  │
│  │  └──────────────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                           │
│                                        ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                           API / MODEL LAYER                                 │  │
│  │                                                                              │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Claude API / Anthropic API                         │   │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │  │
│  │  │  │ Haiku       │  │ Sonnet      │  │ Opus        │                 │   │  │
│  │  │  │ (Fast/Low)  │  │ (Balanced)  │  │ (Powerful)  │                 │   │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Agent Loop 完整流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT LOOP (主循环)                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  START                                                                             │
│    │                                                                               │
│    ▼                                                                               │
│  ┌─────────────────┐                                                               │
│  │  User Input     │  ←────────────────────────────────────────┐                   │
│  │  /message       │                                       │                     │
│  └────────┬────────┘                                       │                     │
│           │                                                │                     │
│           ▼                                                │                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                      PRE-PROCESSING                                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ UserPromptSubmit │  │  PreHandle      │  │   /compact      │               │   │
│  │  │     Hooks       │  │   Middleware    │  │   Detection     │               │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                           │
│           ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    SYSTEM PROMPT CONSTRUCTION                                 │   │
│  │                                                                              │   │
│  │  buildEffectiveSystemPrompt({                                                 │   │
│  │    defaultSystemPrompt     ←── Sections resolved from constants/prompts.ts   │   │
│  │    agentSystemPrompt       ←── Current agent's custom prompt                │   │
│  │    appendSystemPrompt      ←── Skill/hook added prompts                      │   │
│  │  })                                                                           │   │
│  │                                                                              │   │
│  │  + resolveSystemPromptSections() → 缓存的 section 计算                      │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                           │
│           ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    API CALL → MODEL                                           │   │
│  │                                                                              │   │
│  │  queryModelWithStreaming({                                                   │   │
│  │    messages: [...history, newUserMessage],                                   │   │
│  │    systemPrompt: [...sections],                                              │   │
│  │    tools: [...toolPool],                                                     │   │
│  │  })                                                                           │   │
│  │                                                                              │   │
│  │            ┌─────────────────┐                                              │   │
│  │            │ Claude API       │                                              │   │
│  │            │ (Anthropic)     │                                              │   │
│  │            └────────┬────────┘                                              │   │
│  └─────────────────────│──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│                        │ streaming response                                        │
│                        ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         RESPONSE PROCESSING                                   │   │
│  │                                                                              │   │
│  │  While streaming:                                                           │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ case 'content_block_start':                                          │   │   │
│  │  │   - text_block → accumulate text                                     │   │   │
│  │  │   - tool_use_block → PRE-TOOL USE HOOKS                              │   │   │
│  │  │                                                                     │   │   │
│  │  │ case 'content_block_delta':                                          │   │   │
│  │  │   - text delta → append to text                                      │   │   │
│  │  │   - input_json_delta → accumulate tool params                        │   │   │
│  │  │                                                                     │   │   │
│  │  │ case 'message_delta':                                                │   │   │
│  │  │   - stop_reason → determine next action                              │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                           │
│           ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                       TOOL CALL EXECUTION                                    │   │
│  │                                                                              │   │
│  │  If stop_reason === 'tool_use':                                            │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ PRE-TOOL USE HOOKS                                                      │   │   │
│  │  │ for each PreToolUse hook:                                              │   │   │
│  │  │   result = hook.execute(tool_name, tool_input)                         │   │   │
│  │  │   if result.blocked: → return error to model, continue loop            │   │   │
│  │  │   if result.modified: → update tool_input                              │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                         │   │
│  │                                    ▼                                         │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ PERMISSION CHECK                                                        │   │   │
│  │  │ permissionResult = tool.checkPermissions(input, context)              │   │   │
│  │  │ if deny: → return denied result to model                               │   │   │
│  │  │ if ask: → show UI, wait for user confirmation                         │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                         │   │
│  │                                    ▼                                         │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ TOOL EXECUTION                                                          │   │   │
│  │  │ result = await tool.call(input, context, canUseTool, onProgress)       │   │   │
│  │  │   - onProgress → UI updates (spinner, progress messages)               │   │   │
│  │  │   - result.newMessages → additional messages to append                 │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                         │   │
│  │                                    ▼                                         │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ POST-TOOL USE HOOKS                                                     │   │   │
│  │  │ for each PostToolUse hook:                                             │   │   │
│  │  │   hook.execute(tool_name, tool_result)                                │   │   │
│  │  │   → may add messages to conversation                                   │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                         │   │
│  │               ┌────────────────────┴────────────────────┐                  │   │
│  │               ▼                                         ▼                  │   │
│  │  ┌─────────────────────┐              ┌─────────────────────┐             │   │
│  │  │ Error / Blocked    │              │  Success            │             │   │
│  │  │ → Error result msg │              │  → ToolResult msg  │             │   │
│  │  └─────────────────────┘              └──────────┬──────────┘             │   │
│  └───────────────────────────────────────────────────│───────────────────────┘   │
│                                                      │                           │
│                                                      ▼                           │
│                                              ┌─────────────────┐                 │
│                                              │  Append result  │                 │
│                                              │  to messages[]  │                 │
│                                              └────────┬────────┘                 │
│                                                       │                          │
│                              ┌────────────────────────┘                          │
│                              │                                                  │
│                              ▼                                                  │
│                      ┌───────────────┐                                          │
│                      │ More tools?  │                                          │
│                      │ (pending)     │                                          │
│                      └───────┬───────┘                                          │
│                              │                                                  │
│              ┌───────────────┴───────────────┐                                  │
│              │ NO                           │ YES                               │
│              ▼                               │                                   │
│    ┌─────────────────┐                      │                                   │
│    │ STOP_REASON:    │                      │                                   │
│    │ end_turn        │                      │                                   │
│    └────────┬────────┘                      │                                   │
│             │                              │                                   │
│             ▼                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         RESPONSE TO USER                                     ││
│  │  - Render AssistantMessage to UI                                             ││
│  │  - Tool use results rendered via tool.renderToolResultMessage()             ││
│  │  - Hooks can emit additional messages                                        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│             │                                                                       │
│             ▼                                                                       │
│  ┌─────────────────┐                                                             │
│  │ Loop Back?      │ ←── If new user input, go to START                        │
│  │ (end_turn)      │                                                             │
│  └────────┬────────┘                                                             │
│           │                                                                      │
│           ▼                                                                      │
│         END                                                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. 子系统架构图

### 3.1 System Prompt 子系统

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM PROMPT SUBSYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  buildEffectiveSystemPrompt()                                                       │
│         │                                                                           │
│         ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                        PROMPT PRIORITY MATRIX                                │   │
│  │                                                                              │   │
│  │   Priority │ Source              │ Description                              │   │
│  │   ─────────┼────────────────────┼──────────────────────────────────────    │   │
│  │   1 (HIGH) │ overrideSystemPrompt│ --system-prompt 完全替换 (loop mode)    │   │
│  │   2        │ coordinatorSystem   │ 协调者模式                              │   │
│  │   3        │ agentSystemPrompt   │ 自定义 Agent prompt                     │   │
│  │   4        │ customSystemPrompt  │ 用户指定 --system-prompt               │   │
│  │   5 (BASE) │ defaultSystemPrompt │ 标准 Claude Code prompt                 │   │
│  │   +APPEND  │ appendSystemPrompt  │ 始终追加 (hooks, skills)               │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                           │
│         ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    DEFAULT PROMPT SECTIONS (from prompts.ts)                  │   │
│  │                                                                              │   │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │   │
│  │   │ Capabilities    │  │ cliBasics       │  │ envSection      │            │   │
│  │   │ - Core abilities│  │ - /commands     │  │ - env vars      │            │   │
│  │   │ - Tool overview │  │ - CLI behavior  │  │ - Paths         │            │   │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘            │   │
│  │                                                                              │   │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │   │
│  │   │ osSection       │  │ toolDescs       │  │ mcpServers      │            │   │
│  │   │ - OS type/vers  │  │ - Tool prompts  │  │ - MCP config    │            │   │
│  │   │ - Shell info    │  │ - Each tool.p() │  │ - Server list  │            │   │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘            │   │
│  │                                                                              │   │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │   │
│  │   │ memoryFiles     │  │ agentList       │  │ settingsSection │            │   │
│  │   │ - CLAUDE.md     │  │ - Built-in      │  │ - User prefs   │            │   │
│  │   │ - .claude/**    │  │ - Custom        │  │ - Config      │            │   │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘            │   │
│  │                                                                              │   │
│  │   ┌─────────────────┐  ┌─────────────────┐                                │   │
│  │   │ claudeMdSection │  │ projectContext   │                                │   │
│  │   │ - CLAUDE.md     │  │ - Git state     │                                │   │
│  │   │ - Custom docs   │  │ - Recent files │                                │   │
│  │   └─────────────────┘  └─────────────────┘                                │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                           │
│         ▼                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                       SECTION CACHING                                        │   │
│  │                                                                              │   │
│  │   systemPromptSection()              │ DANGEROUS_uncachedSystemPromptSection()│   │
│  │   ├── Memoized until /clear          │ ├── Recomputes every turn           │   │
│  │   ├── Cache key = Statsig sync       │ ├── Breaks prompt cache             │   │
│  │   └── MemoryFiles, Settings          │ └── Used sparingly                   │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tool 子系统

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              TOOL SUBSYSTEM                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  TOOL POOL ASSEMBLY                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │   │
│  │   │ Built-in     │    │ MCP Tools    │    │ Custom Tools │                 │   │
│  │   │ Tools (40+)  │    │ (Dynamic)    │    │ (Plugins)    │                 │   │
│  │   ├──────────────┤    ├──────────────┤    ├──────────────┤                 │   │
│  │   │ BashTool     │    │ mcp__server__│    │ from skills/ │                 │   │
│  │   │ ReadTool     │    │ toolName     │    │ commands     │                 │   │
│  │   │ EditTool     │    │              │    │              │                 │   │
│  │   │ WriteTool    │    │              │    │              │                 │   │
│  │   │ AgentTool    │    │              │    │              │                 │   │
│  │   │ GlobTool     │    │              │    │              │                 │   │
│  │   │ GrepTool     │    │              │    │              │                 │   │
│  │   │ ...          │    │              │    │              │                 │   │
│  │   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │   │
│  │          │                    │                    │                         │   │
│  │          └────────────────────┼────────────────────┘                         │   │
│  │                               │                                                │   │
│  │                               ▼                                                │   │
│  │                    ┌──────────────────┐                                      │   │
│  │                    │ assembleToolPool │                                      │   │
│  │                    │ ()               │                                      │   │
│  │                    └────────┬─────────┘                                      │   │
│  │                             │                                                 │   │
│  │          ┌──────────────────┼──────────────────┐                            │   │
│  │          ▼                  ▼                  ▼                             │   │
│  │   ┌────────────┐    ┌────────────┐    ┌────────────┐                      │   │
│  │   │ Filter by  │    │ Sort by    │    │ Dedup by  │                      │   │
│  │   │ Deny Rules │    │ name       │    │ name       │                      │   │
│  │   └────────────┘    └────────────┘    └────────────┘                      │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                               │                                                     │
│                               ▼                                                     │
│  TOOL INTERFACE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   interface Tool<Input, Output, Progress> {                                 │   │
│  │                                                                              │   │
│  │     // 标识                                                                 │   │
│  │     name: string                                                           │   │
│  │     aliases?: string[]                                                      │   │
│  │                                                                              │   │
│  │     // Schema                                                               │   │
│  │     inputSchema: ZodSchema                                                 │   │
│  │     inputJSONSchema?: JSONSchema  // for MCP                               │   │
│  │                                                                              │   │
│  │     // 执行                                                                 │   │
│  │     call(args, context, canUseTool, onProgress): Promise<ToolResult>       │   │
│  │     description(input, options): Promise<string>                           │   │
│  │                                                                              │   │
│  │     // 行为                                                                 │   │
│  │     isConcurrencySafe(input): boolean                                      │   │
│  │     isReadOnly(input): boolean                                             │   │
│  │     isDestructive?(input): boolean                                          │   │
│  │     interruptBehavior?(): 'cancel' | 'block'                              │   │
│  │                                                                              │   │
│  │     // 权限                                                                 │   │
│  │     checkPermissions(input, context): Promise<PermissionResult>             │   │
│  │                                                                              │   │
│  │     // 渲染                                                                 │   │
│  │     renderToolUseMessage(input, options): ReactNode                         │   │
│  │     renderToolResultMessage(output, progress, options): ReactNode          │   │
│  │     renderToolUseProgressMessage(progress, options): ReactNode            │   │
│  │                                                                              │   │
│  │     // 元数据                                                               │   │
│  │     maxResultSizeChars: number                                              │   │
│  │     shouldDefer?: boolean  // needs ToolSearch                             │   │
│  │     alwaysLoad?: boolean   // never deferred                               │   │
│  │   }                                                                          │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Agent 子系统

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT SUBSYSTEM                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  AGENT DEFINITION                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   interface AgentDefinition {                                               │   │
│  │     agentType: string           // 唯一标识                                  │   │
│  │     whenToUse: string          // 何时使用 (给模型看的描述)                 │   │
│  │     tools?: string[]           // Allowlist                                │   │
│  │     disallowedTools?: string[]  // Denylist                                 │   │
│  │     getSystemPrompt(context?): string  // 动态生成                          │   │
│  │     source: 'built-in' | 'custom'                                          │   │
│  │     baseDir: string                                                          │   │
│  │     model?: 'inherit' | 'haiku' | 'sonnet' | 'opus'                        │   │
│  │     permissionMode?: PermissionMode                                          │   │
│  │     color?: string                                                          │   │
│  │     background?: boolean                                                    │   │
│  │   }                                                                          │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  BUILT-IN AGENTS                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │   │
│  │  │ verification    │  │ claude-code-    │  │ statusline-     │           │   │
│  │  │                 │  │ guide           │  │ setup           │           │   │
│  │  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤           │   │
│  │  │ Purpose:        │  │ Purpose:        │  │ Purpose:        │           │   │
│  │  │ Verify impl     │  │ Answer ? about  │  │ Help configure  │           │   │
│  │  │ before claiming │  │ CC, SDK, API    │  │ status bar      │           │   │
│  │  │ completion      │  │                 │  │                 │           │   │
│  │  │                 │  │                 │  │                 │           │   │
│  │  │ Tools:          │  │ Tools:          │  │ Tools:          │           │   │
│  │  │ - Bash         │  │ - Read         │  │ - ...          │           │   │
│  │  │ - Read         │  │ - Glob/Grep    │  │                │           │   │
│  │  │ - Glob/Grep    │  │ - WebFetch     │  │                │           │   │
│  │  │ - WebFetch     │  │ - WebSearch    │  │                │           │   │
│  │  │ - WebSearch    │  │                │  │                │           │   │
│  │  │                 │  │                │  │                 │           │   │
│  │  │ Disallowed:     │  │ Model: haiku   │  │                │           │   │
│  │  │ - Agent        │  │ (fast/cheap)   │  │                │           │   │
│  │  │ - Edit/Write   │  │                │  │                 │           │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  AGENT SPAWNING                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   AgentTool({                                                               │   │
│  │     name: "my-agent",           // 标识符                                   │   │
│  │     description: "...",         // 简短描述                                  │   │
│  │     subagent_type?: "agent-type", // 专用 Agent 类型                        │   │
│  │     prompt: "...",              // 任务描述                                  │   │
│  │     model?: "sonnet",           // 模型选择                                  │   │
│  │     run_in_background?: true,  // 后台运行                                 │   │
│  │     isolation?: "worktree",     // 隔离模式                                 │   │
│  │   })                                                                         │   │
│  │                                                                              │   │
│  │   ┌────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                     SUBAGENT TYPES                                  │   │   │
│  │   │                                                                    │   │   │
│  │   │  ┌─────────────────┐      ┌─────────────────┐                      │   │   │
│  │   │  │ FORK            │      │ FRESH AGENT     │                      │   │   │
│  │   │  │ (no subagent_   │      │ (with subagent_ │                      │   │   │
│  │   │  │  type)          │      │  type specified)│                      │   │   │
│  │   │  ├─────────────────┤      ├─────────────────┤                      │   │   │
│  │   │  │ • Inherits full │      │ • Starts fresh  │                      │   │   │
│  │   │  │   context       │      │ • Needs full    │                      │   │   │
│  │   │  │ • Shares prompt │      │   context       │                      │   │   │
│  │   │  │   cache         │      │ • Own prompt    │                      │   │   │
│  │   │  │ • Cheap         │      │   cache         │                      │   │   │
│  │   │  │ • For research, │      │ • For specialized│                      │   │   │
│  │   │  │   quick tasks   │      │   sub-agents    │                      │   │   │
│  │   │  └─────────────────┘      └─────────────────┘                      │   │   │
│  │   │                                                                    │   │   │
│  │   └────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  CUSTOM AGENTS                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   .claude/agents/                                                          │   │
│  │   ├── my-agent/                                                            │   │
│  │   │   ├── agent.md          ← AgentDefinition YAML                         │   │
│  │   │   ├── SKILL.md         ← 技能定义 (可选)                              │   │
│  │   │   └── prompts/         ← 自定义 prompts (可选)                        │   │
│  │   │       └── system.md                                                   │   │
│  │   └── another-agent/                                                       │   │
│  │       └── agent.md                                                         │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Hook 子系统

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              HOOK SUBSYSTEM                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  HOOK TYPES                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │  Session Hooks                    │  Tool Hooks                             │   │
│  │  ────────────────────────────────┼──────────────────────────────────────   │   │
│  │  SessionStart                    │ PreToolUse                              │   │
│  │  SessionEnd                      │ PostToolUse                             │   │
│  │  UserPromptSubmit               │                                         │   │
│  │  PreCompact                     │                                         │   │
│  │  PostCompact                    │                                         │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  HOOK CONFIGURATION                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │  {                                                                    }   │   │
│  │    "hooks": [                                                          }   │   │
│  │      {                                                                }   │   │
│  │        "matchers": ["Bash git *", "Write *"],                         }   │   │
│  │        "if": "git status",  // $ARGUMENTS available                    }   │   │
│  │        "postToolUse": {                                                 }   │   │
│  │          "prompt": "Review the git operation for safety concerns..."   }   │   │
│  │        }                                                                }   │   │
│  │      }                                                                  }   │   │
│  │    ]                                                                    }   │   │
│  │  }                                                                          │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  HOOK EXECUTION FLOW                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   PreToolUse Hook Chain:                                                  │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐               │   │
│  │   │ Hook 1  │───▶│ Hook 2  │───▶│ Hook 3  │───▶│ Continue │               │   │
│  │   └────┬────┘    └────┬────┘    └────┬────┘    └─────────┘               │   │
│  │        │               │               │                                  │   │
│  │        ▼               ▼               ▼                                  │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐                             │   │
│  │   │ blocked │    │ blocked │    │ blocked │                             │   │
│  │   │ → STOP  │    │ → STOP  │    │ → STOP  │                             │   │
│  │   └─────────┘    └─────────┘    └─────────┘                             │   │
│  │                                                                              │   │
│  │   PostToolUse Hook Chain:                                                 │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐               │   │
│  │   │ Hook 1  │───▶│ Hook 2  │───▶│ Hook 3  │───▶│ Complete │               │   │
│  │   └─────────┘    └─────────┘    └─────────┘    └─────────┘               │   │
│  │        │               │               │                                  │   │
│  │        ▼               ▼               ▼                                  │   │
│  │   [messages]     [messages]      [messages]                              │   │
│  │   may add        may add          may add                                 │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  PROMPT HOOK (LLM-based)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   execPromptHook(hook, event, jsonInput, context)                          │   │
│  │          │                                                                   │   │
│  │          ▼                                                                   │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │   │  1. Replace $ARGUMENTS with jsonInput                             │     │   │
│  │   │  2. Create user message with processed prompt                     │     │   │
│  │   │  3. Query Haiku model:                                           │     │   │
│  │   │     systemPrompt: "Evaluate condition, return {ok: true/false}"  │     │   │
│  │   │  4. Parse JSON response:                                         │     │   │
│  │   │     {ok: true} → allow                                           │     │   │
│  │   │     {ok: false, reason: "..."} → block with reason               │     │   │
│  │   └─────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Permission 子系统

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PERMISSION SUBSYSTEM                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  PERMISSION MODES                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │  'default'     │ 'bypass'        │ 'dontAsk'                                │   │
│  │  ─────────────┼─────────────────┼─────────────────────                       │   │
│  │  交互式确认    │ 静默允许所有    │ 不询问但记录日志                         │   │
│  │               │                 │                                           │   │
│  │  ┌─────────┐  │  ┌─────────┐   │  ┌─────────┐                             │   │
│  │  │ Allow?  │  │  │ Allow   │   │  │ Allow   │                             │   │
│  │  │  ┌────┐ │  │  │ Always  │   │  │ Without │                             │   │
│  │  │  │Yes │ │  │  │         │   │  │ Asking  │                             │   │
│  │  │  └────┘ │  │  └─────────┘   │  └─────────┘                             │   │
│  │  │  ┌────┐ │  │               │                                           │   │
│  │  │  │No  │ │  │               │                                           │   │
│  │  │  └────┘ │  │               │                                           │   │
│  │  │   ↓     │  │               │                                           │   │
│  │  │ Dialog  │  │               │                                           │   │
│  │  └─────────┘  │               │                                           │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  PERMISSION CHECK流程                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   tool.checkPermissions(input, context)                                     │   │
│  │          │                                                                   │   │
│  │          ▼                                                                   │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │   │  Step 1: Rule Matching                                          │     │   │
│  │   │                                                                 │     │   │
│  │   │   permissionContext.alwaysDenyRules → match? → DENY             │     │   │
│  │   │   permissionContext.alwaysAskRules  → match? → ASK              │     │   │
│  │   │   permissionContext.alwaysAllowRules → match? → ALLOW           │     │   │
│  │   │                                                                 │     │   │
│  │   └─────────────────────────────────────────────────────────────────┘     │   │
│  │          │                                                                   │   │
│  │          ▼                                                                   │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │   │  Step 2: Tool-Specific Check                                     │     │   │
│  │   │                                                                 │     │   │
│  │   │   // BashTool: 检查危险命令                                      │     │   │
│  │   │   // WriteTool: 检查目标路径                                     │     │   │
│  │   │   // AgentTool: 检查子agent权限                                  │     │   │
│  │   │                                                                 │     │   │
│  │   └─────────────────────────────────────────────────────────────────┘     │   │
│  │          │                                                                   │   │
│  │          ▼                                                                   │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │   │  Step 3: Return Result                                           │     │   │
│  │   │                                                                 │     │   │
│  │   │   { behavior: 'allow', updatedInput? }                           │     │   │
│  │   │   { behavior: 'deny', message? }                                │     │   │
│  │   │   { behavior: 'ask', updatedInput? }                            │     │   │
│  │   │                                                                 │     │   │
│  │   └─────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Session Memory 子系统

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          SESSION MEMORY SUBSYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  SESSION MEMORY LIFECYCLE                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │   Session Start                                                              │   │
│  │       │                                                                      │   │
│  │       ▼                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │   │  /compact Triggered?                                              │     │   │
│  │   │         │                                                         │     │   │
│  │   │    ┌────┴────┐                                                   │     │   │
│  │   │   YES        NO                                                  │     │   │
│  │   │    │          │                                                   │     │   │
│  │   │    ▼          ▼                                                    │     │   │
│  │   │ ┌──────────────────┐     ┌──────────────────┐                     │     │   │
│  │   │ │ Session Memory   │     │ Continue Normal  │                     │     │   │
│  │   │ │ Update Prompt    │     │ Loop             │                     │     │   │
│  │   │ │                  │     │                  │                     │     │   │
│  │   │ │ Read notes file  │     │                  │                     │     │   │
│  │   │ │ Update via LLM   │     │                  │                     │     │   │
│  │   │ │ Write back       │     │                  │                     │     │   │
│  │   │ └──────────────────┘     └──────────────────┘                     │     │   │
│  │   │         │                                                               │   │
│  │   │         ▼                                                               │   │
│  │   │   ┌──────────────────┐                                               │   │
│  │   │   │ Compact Messages  │ ←─── Summarize old messages                   │   │
│  │   │   │ + Include Memory  │                                               │   │
│  │   │   └──────────────────┘                                               │     │
│  │   │         │                                                               │   │
│  │   └─────────┼───────────────────────────────────────────────────────────┘   │
│  │             │                                                                   │
│  │             ▼                                                                   │
│  │         Session continues...                                                    │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  SESSION MEMORY TEMPLATE                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │  # Session Title           ← 5-10 word distinctive title                    │   │
│  │  _A short and distinctive 5-10 word descriptive title..._                  │   │
│  │                                                                              │   │
│  │  # Current State           ← 正在做什么                                     │   │
│  │  _What is actively being worked on right now..._                            │   │
│  │                                                                              │   │
│  │  # Task specification       ← 用户要求什么                                   │   │
│  │  _What did the user ask to build?..._                                      │   │
│  │                                                                              │   │
│  │  # Files and Functions      ← 重要文件和函数                                 │   │
│  │  _What are the important files?..._                                        │   │
│  │                                                                              │   │
│  │  # Workflow                 ← 常用命令流程                                   │   │
│  │  _What bash commands are usually run?..._                                   │   │
│  │                                                                              │   │
│  │  # Errors & Corrections     ← 错误和纠正                                     │   │
│  │  _Errors encountered and how they were fixed..._                            │   │
│  │                                                                              │   │
│  │  # Learnings               ← 学到的经验                                      │   │
│  │  _What has worked well? What has not?..._                                  │   │
│  │                                                                              │   │
│  │  # Key results             ← 关键输出                                        │   │
│  │  _If the user asked for specific output..._                                  │   │
│  │                                                                              │   │
│  │  # Worklog                 ← 工作日志                                       │   │
│  │  _Step by step, what was attempted?..._                                    │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. 数据流总图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   USER                 CLAUDE CODE                    CLAUDE API                   │
│   ────                 ────────────                    ────────────                │
│     │                        │                              │                        │
│     │ /message               │                              │                        │
│     │ ──────────────────────▶│                              │                        │
│     │                        │                              │                        │
│     │                 ┌──────┴──────┐                       │                        │
│     │                 │ Build       │                       │                        │
│     │                 │ System      │                       │                        │
│     │                 │ Prompt      │                       │                        │
│     │                 └──────┬──────┘                       │                        │
│     │                        │                              │                        │
│     │                        │  messages[] = [              │                        │
│     │                        │    system + history +         │                        │
│     │                        │    new user message          │                        │
│     │                        │  ]                           │                        │
│     │                        │                              │                        │
│     │                        │  api.call({                 │                        │
│     │                        │    model, messages,         │                        │
│     │                        │    tools: [...],            │                        │
│     │                        │  })                         │                        │
│     │                        │─────────────────────────────▶│                        │
│     │                        │                              │                        │
│     │                        │    streaming response        │                        │
│     │                        │◀─────────────────────────────│                        │
│     │                        │                              │                        │
│     │                        │  ┌─────────────────────┐     │                        │
│     │                        │  │ ToolUseBlock       │     │                        │
│     │                        │  │ name: "Bash"       │     │                        │
│     │                        │  │ input: {...}      │     │                        │
│     │                        │  └─────────┬─────────┘     │                        │
│     │                        │            │               │                        │
│     │                        │    ┌───────┴───────┐      │                        │
│     │                        │    ▼               ▼      │                        │
│     │                        │ ┌─────────┐  ┌─────────┐   │                        │
│     │                        │ │ PreHook │  │Permiss- │   │                        │
│     │                        │ │Chain    │  │ionCheck │   │                        │
│     │                        │ └────┬────┘  └────┬────┘   │                        │
│     │                        │      │            │       │                        │
│     │                        │      │      ┌──────┴────┐   │                        │
│     │                        │      │      ▼           │   │                        │
│     │                        │      │  ┌─────────┐      │   │                        │
│     │                        │      │  │  Tool   │      │   │                        │
│     │                        │      │  │ Execute │      │   │                        │
│     │                        │      │  └───┬────┘      │   │                        │
│     │                        │      │      │            │   │                        │
│     │                        │      │      ▼            │   │                        │
│     │                        │      │  ┌─────────┐      │   │                        │
│     │                        │      │  │Result   │      │   │                        │
│     │                        │      │  └────┬────┘      │   │                        │
│     │                        │      │       │            │   │                        │
│     │                        │      │  ┌─────┴─────┐     │   │                        │
│     │                        │      │  │PostHook  │     │   │                        │
│     │                        │      │  │Chain     │     │   │                        │
│     │                        │      │  └────┬─────┘     │   │                        │
│     │                        │      │       │           │   │                        │
│     │                        │      │       ▼           │   │                        │
│     │                        │      │  ┌───────────┐     │   │                        │
│     │                        │      │  │ToolResult│     │   │                        │
│     │                        │      │  │  Block   │     │   │                        │
│     │                        │      │  └────┬─────┘     │   │                        │
│     │                        │      │       │           │   │                        │
│     │                        │◀─────┴───────┘           │   │                        │
│     │                        │                              │                        │
│     │          (append to messages[])                      │                        │
│     │                        │                              │                        │
│     │         Response to user ◀────── (rendered)          │                        │
│     │                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 5. 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/Tool.ts` | Tool 接口定义、buildTool 工厂 |
| `src/tools.ts` | 工具注册、assembleToolPool |
| `src/utils/systemPrompt.ts` | buildEffectiveSystemPrompt |
| `src/utils/systemPromptType.ts` | SystemPrompt 类型 |
| `src/constants/systemPromptSections.ts` | Section 缓存机制 |
| `src/constants/prompts.ts` | 默认 prompt sections |
| `src/query.ts` | 主查询循环 |
| `src/QueryEngine.ts` | 查询引擎编排器 |
| `src/tools/AgentTool/prompt.ts` | AgentTool prompt |
| `src/tools/AgentTool/loadAgentsDir.ts` | Agent 加载 |
| `src/tools/AgentTool/built-in/*.ts` | 内置 Agent 定义 |
| `src/utils/hooks/execPromptHook.ts` | Prompt hook 执行 |
| `src/services/SessionMemory/prompts.ts` | Session memory prompts |
| `src/utils/swarm/teammatePromptAddendum.ts` | Teammate addendum |

## 6. 核心设计原则

### 6.1 Prompt 缓存策略

```
缓存稳定性原则：
┌─────────────────────────────────────────────────────────────────────────────┐
│  目标：跨用户、跨会话的 prompt 缓存最大化                                     │
│                                                                              │
│  做法：                                                                     │
│  1. Section 分离：将不变化的 parts 抽取为独立的 cached sections              │
│  2. 动态部分隔离：将每次变化的 parts (如 tool result) 排除在缓存外          │
│  3. 规范对齐：与 Statsig 动态配置同步 cache key                             │
│  4. 排序固定：built-in tools 始终在前，MCP tools 在后，保持顺序一致         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 工具抽象原则

```
统一工具接口：
┌─────────────────────────────────────────────────────────────────────────────┐
│  所有工具 (内置/MCP/自定义) 实现相同的 Tool 接口                             │
│                                                                              │
│  好处：                                                                     │
│  1. 工具池组装一致：assembleToolPool 对所有工具一视同仁                      │
│  2. 权限检查统一：permissionContext 规则适用于所有工具                      │
│  3. UI 渲染统一：renderToolUseMessage/Result 统一接口                       │
│  4. 缓存管理一致：tool schema 缓存策略统一                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 权限分层原则

```
纵深防御：
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Layer 1: alwaysDenyRules    ← 强制禁止 ( blanket denials )                 │
│                                                                              │
│  Layer 2: alwaysAskRules     ← 必须确认 ( dangerous operations )            │
│                                                                              │
│  Layer 3: tool.checkPermissions() ← 工具特定检查                            │
│                                                                              │
│  Layer 4: alwaysAllowRules   ← 静默允许 ( safe operations )                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7. 总结

Claude Code 的架构是一个精心设计的分层系统：

1. **UI Layer**: REPL / SDK / CLI 统一入口
2. **Query Engine**: 编排 hooks、tools、messages
3. **Tool System**: 统一接口的 40+ 内置工具 + MCP + 自定义
4. **System Prompt**: 分层优先级 + Section 缓存
5. **Agent System**: 内置 + 自定义 + Fork/Teammate 协作
6. **Hook System**: PreToolUse/PostToolUse 拦截链
7. **Permission System**: 规则驱动的多层权限
8. **Session Memory**: 自动记忆化 + compaction

这个架构使得系统：
- **可扩展**：新增工具只需实现 Tool 接口
- **可配置**：通过 hooks、permissions、agents 定制行为
- **可观测**：通过 hooks 追踪所有工具调用
- **高效**：通过 section 缓存和 prompt 优化减少 token 消耗
