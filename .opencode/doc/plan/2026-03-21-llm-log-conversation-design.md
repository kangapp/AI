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

通过 `event` hook 监听 `message.part.updated` 事件，当收到 `step-finish` 类型的 part 时表示一个 Turn 结束，立即写入 jsonl：

```
chat.message (Turn N 开始)
  ↓
experimental.chat.messages.transform (记录 Turn N 的输入)
  ↓
LLM.stream() ... 流式输出
  ↓
experimental.text.complete (收集输出文本)
tool.execute.after (收集工具调用)
  ↓
step-finish part 保存 → Bus.publish("message.part.updated", { part: step-finish })
  ↓
event hook 收到 "message.part.updated" 事件
  ↓
检测到 part.type === "step-finish" → 立即写入 Turn N 的完整 jsonl
```

**关键点**：
- `step-finish` part 保存时会触发 `message.part.updated` 事件
- 通过 `event` hook 监听此事件，在 Turn 结束时立即写入
- 不需要等待下一条消息

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
  system: string[]           // system prompt 片段
  messages: {
    role: "system" | "user" | "assistant"
    content: any[]           // 消息内容 (parts)
  }[]
}
```

**输出（LLM Response）**
```typescript
interface LLMResponse {
  turn: number
  sessionID: string
  timestamp: string
  reasoning: string[]        // 思考过程（如有）
  textParts: string[]        // 文本输出片段
  fullText: string           // 合并后的完整文本
  tools: {
    tool: string
    args: any
    output: string
    title: string
  }[]
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
| `experimental.chat.messages.transform` | 获取完整输入消息 |
| `experimental.text.complete` | 收集每个文本块输出 |
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
