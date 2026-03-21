# LLM Log Conversation Plugin 设计文档

## 目的

深入学习和了解 agent 和 LLM 交互的完整流程，通过实时观察每个 Turn 的输入输出来理解 opencode 的内部机制。

## 方案选择

**Plugin 方案**：利用 opencode 现有的 hook 系统，无需修改源码。

## 实现位置

```
.opencode/
├── plugin/
│   └── log-conversation.ts   # 核心 tracer plugin
└── opencode.json            # 配置加载 plugin
```

输出文件：
```
.opencode/logs/
└── {session-id}.jsonl       # 每个对话一个 jsonl 文件
```

## Opencode Plugin Hooks

Opencode 提供的有效 plugin hooks 如下：

| Hook | 类型 | 说明 |
|------|------|------|
| `chat.message` | **输入** | 用户消息到达 |
| `chat.params` | **输入** | LLM 参数（temperature 等） |
| `chat.headers` | **输入** | HTTP headers |
| `command.execute.before` | **工具** | 命令执行前 |
| `tool.execute.before` | **工具** | 工具执行前 |
| `shell.env` | **工具** | Shell 环境变量 |
| `tool.execute.after` | **工具** | 工具执行后 |
| `experimental.chat.messages.transform` | **消息** | 消息历史转换 |
| `experimental.chat.system.transform` | **消息** | System prompt 转换 |
| `experimental.session.compacting` | **消息** | Session 压缩前 |
| `experimental.text.complete` | **输出** | 文本块完成 |
| `tool.definition` | **工具** | 工具定义修改 |
| `permission.ask` | **权限** | 权限询问 |
| `event` | **特殊** | 捕获所有 Bus 事件 |
| `config` | **特殊** | 配置加载时 |
| `tool` | **特殊** | 工具定义 |
| `auth` | **特殊** | 认证 |

**注意**：`finish-step` 不是 plugin hook，是 `processor.ts` 内部流处理的事件。但可以通过 `message.part.updated` 事件监听 `step-finish` part 来检测 Turn 结束。

## 核心设计

### Turn 生命周期

完整的数据流如下：

```
1. 组装 msgs (消息历史)
   ↓
2. experimental.chat.messages.transform (获取 msgs，提取 tool/reasoning parts)
   ↓
3. 构建 system prompt (SystemPrompt.environment, skills, instructions)
   ↓
4. experimental.chat.system.transform (获取 system prompt)
   ↓
5. processor.process() → LLM 调用
   ↓
6. 流式输出: text-complete, tool-result, reasoning
   ↓
7. step-finish part 保存 → Bus.publish("message.part.updated", { part: step-finish })
   ↓
8. event hook 收到 "message.part.updated" 事件
   ↓
9. 检测到 part.type === "step-finish" → 立即写入 Turn N 的完整 jsonl
```

**关键点**：
- `chat.messages.transform` 时 msgs 中包含完整的 parts（包括 tool、reasoning 等）
- `chat.system.transform` 时 system prompt 刚刚构建完成
- 通过 `event` hook 监听 `step-finish` part，在 Turn 结束时立即写入

### 数据结构

**输入（LLM Request）**
```typescript
interface LLMRequest {
  turn: number
  sessionID: string
  timestamp: string
  model: {
    providerID: string
    modelID: string
  }
  agent: string
  system: string[]           // system prompt（从 system.transform 获取）
  messages: {
    role: "system" | "user" | "assistant"
    content: Part[]          // 完整的 parts（包含 tool、reasoning）
  }[]
}
```

**输出（LLM Response）**
```typescript
interface LLMResponse {
  turn: number
  sessionID: string
  timestamp: string
  reasoning: string[]         // 思考过程（从 messages 的 ReasoningPart 提取）
  textParts: string[]       // 文本输出片段
  fullText: string          // 合并后的完整文本
  toolCalls: [{             // 工具调用（从 messages 的 ToolPart 提取）
    id: string
    tool: string
    args: any
    callID: string
  }]
  tools: [{                 // 工具执行结果（从 tool.execute.after 收集）
    tool: string
    args: any
    output: string
    title: string
  }]
  finishReason: string
  usage?: {
    tokens: number
    cost: number
  }
}
```

**JSONL 单行记录**
```json
{"type": "request", ...}
{"type": "response", ...}
```

### Hook 使用

| Hook | 用途 |
|------|------|
| `event` | 监听 `message.part.updated` 事件，当 `part.type === "step-finish"` 时触发写入 |
| `experimental.chat.messages.transform` | 获取 msgs，提取 ToolPart 和 ReasoningPart |
| `experimental.chat.system.transform` | 获取 system prompt |
| `experimental.text.complete` | 收集文本输出 |
| `tool.execute.after` | 收集工具执行结果 |

### 输出格式

每条 jsonl 记录：
```json
{"type":"request","turn":1,"sessionID":"abc123",...}
{"type":"response","turn":1,"sessionID":"abc123",...}
```

## 文件内容

### .opencode/plugin/log-conversation.ts

核心逻辑：
1. 管理 Turn 计数器和缓存
2. 在各 hook 中收集数据
3. `event` hook 监听 `message.part.updated` 事件，检测到 `step-finish` 时立即写入 jsonl
4. `chat.message` 用于写入最后一个 Turn（session 结束时可能没有 step-finish）

### .opencode/opencode.json

```json
{
  "plugin": ["file:///path/to/.opencode/plugin/log-conversation.ts"]
}
```

## 验证方式

1. 运行 opencode 进行一次对话
2. 检查 `.opencode/logs/{session-id}.jsonl` 是否生成
3. 验证每条 jsonl 包含完整的 request/response 对
