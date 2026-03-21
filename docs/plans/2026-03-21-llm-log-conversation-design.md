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

## 核心设计

### Turn 生命周期

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
finish-step (Turn N 结束) → 写入一条 jsonl
  ↓
chat.message (Turn N+1 开始)
...
```

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
| `chat.message` | 识别新 Turn 开始，初始化缓存 |
| `experimental.chat.messages.transform` | 获取完整输入消息 |
| `experimental.text.complete` | 收集每个文本块输出 |
| `tool.execute.after` | 收集工具执行结果 |
| `finish-step` | 触发写入 jsonl（Turn 结束） |

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
3. `finish-step` 时写入 jsonl

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
