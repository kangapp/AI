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

**注意**：`finish-step` 不是 plugin hook，是 `processor.ts` 内部流处理的事件。

## 核心设计

### Turn 生命周期

由于 `finish-step` 无法通过 plugin hook 捕获，采用以下设计：

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
chat.message (Turn N+1 开始) → 写入 Turn N 的完整 jsonl
  ↓
experimental.chat.messages.transform (记录 Turn N+1 输入)
  ...
```

**关键点**：`chat.message` 在新消息到来时触发，此时**上一轮的所有输出 hooks**（`text-complete`、`tool.execute.after`）都已执行完毕，因此可以安全地写入上一轮的完整数据。

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
| `chat.message` | 识别新 Turn 开始，**同时写入上一轮的完整 jsonl** |
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
3. `chat.message` 触发时写入上一轮的完整 jsonl

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
