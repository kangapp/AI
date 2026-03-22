# Turn Isolation V2 Design

## 需求

用户每一次发送消息，产生的一次完整对话（用户的输入、system prompt 和传参、agent 多次的工具调用、LLM 每次交互返回的结果等）放在一个 jsonl 文件。每次产生新的内容就 append 进去，捕获完整的 turn 直到对话结束返回最终完整的结果。下一次发送消息生成新的日志文件，以此类推。

## 核心设计原则

1. **一个 user 消息 = 一个独立 jsonl 文件**
2. **Turn 结束时才写入完整 response** - Turn 结束的判断基于 `step-finish.reason` 为 `stop/length/content-filter`
3. **自动消息不创建新文件** - 后台任务完成等自动触发的消息应复用当前 turn

## Turn 结束判断

根据 opencode 源码分析，Turn 结束有以下信号层级：

### Level 1: LLM 层 - step-finish.reason

| reason | 含义 | 是否结束 Turn |
|--------|------|--------------|
| `stop` | 正常停止 | ✅ 是 |
| `length` | 达到最大 token 限制 | ✅ 是 |
| `content-filter` | 内容被过滤 | ✅ 是 |
| `tool-calls` | 模型调用工具 | ❌ 否，继续累积 |
| `unknown` | 未知原因 | ❌ 否 |

**关键代码逻辑**:
```typescript
const modelFinished = processor.message.finish && !["tool-calls", "unknown"].includes(processor.message.finish)
```

### Level 2: Session 层

- `session.deleted` - session 被删除时，确保 pending 数据已写入

## 数据结构

### TurnState 接口

```typescript
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  filePath: string           // 文件路径，在创建时就确定
  responseWritten: boolean    // 标记 response 是否已写入文件
  request: {
    messages: any[]           // 完整的消息
    system: string[]          // system prompt（从 system.transform 获取）
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]           // 文本输出片段
    reasoning: string[]       // 思考过程（从 messages 提取）
    toolCalls: {             // 工具调用（从 messages 提取）
      id: string
      tool: string
      args: any
      callID: string
    }[]
    tools: {                 // 工具执行结果
      tool: string
      args: any
      output: string
      title: string
    }[]
  }
}
```

### 状态存储

```typescript
// key: `${sessionID}_${shortUUID}`
const turns = new Map<string, TurnState>()
// key: sessionID, value: shortUUID
const activeShortUUIDs = new Map<string, string>()
```

## Hook 处理逻辑

### 1. experimental.chat.messages.transform

**触发时机**: 消息历史转换时

**处理逻辑**:
1. 检测是否为 user 消息 (`role === "user"`)
2. 检测是否为自动消息（包含 `<!-- OMO_INTERNAL_INITIATOR -->`）- 跳过，不创建新文件
3. 如果是 user 消息且有旧 state：
   - 调用 `appendResponseToFile(state)` 写入上一个 turn 的 response
   - 删除旧 state 和 shortUUID
4. 如果是 user 消息且没有旧 state：
   - 生成新的 shortUUID
   - 创建新的 TurnState
   - 调用 `writeRequestToFile(state)` 写入 request

### 2. experimental.chat.system.transform

**触发时机**: system prompt 构建完成时

**处理逻辑**:
- 更新当前 state 的 `request.system`

### 3. experimental.text.complete

**触发时机**: 文本块完成时

**处理逻辑**:
- 将文本追加到 `state.response.texts`

### 4. tool.execute.before

**触发时机**: 工具执行前

**处理逻辑**:
- 记录 toolCall 到 `state.response.toolCalls`

### 5. tool.execute.after

**触发时机**: 工具执行后

**处理逻辑**:
- 记录 tool 结果到 `state.response.tools`

### 6. event (message.part.updated)

**触发时机**: 消息部分更新时

**处理逻辑**:
- 监听 `step-finish` 事件
- 当 `reason` 为 `stop/length/content-filter` 时：
  - 调用 `appendResponseToFile(state)`
  - **不**清除 shortUUID（保留给后续可能的会话）
- 当 `reason` 为 `tool-calls` 时：
  - 不写入文件，继续累积

### 7. event (session.deleted)

**触发时机**: session 删除时

**处理逻辑**:
- 如果有 pending state，写入 request 和 response
- 清除 shortUUID

## 文件格式

### 文件命名

```
{sessionID}_{shortUUID}.jsonl
```

示例: `ses_abc123_xyz78901abcd.jsonl`

### JSONL 内容

#### Request 记录
```json
{
  "type": "request",
  "turn": 1,
  "sessionID": "ses_xxx",
  "timestamp": "2026-03-22T00:00:00.000Z",
  "model": { "providerID": "...", "modelID": "..." },
  "agent": "...",
  "system": ["..."],
  "messages": [{ "role": "user/assistant", "content": [...] }]
}
```

#### Response 记录
```json
{
  "type": "response",
  "turn": 1,
  "sessionID": "ses_xxx",
  "timestamp": "2026-03-22T00:00:00.000Z",
  "texts": ["..."],
  "fullText": "...",
  "reasoning": ["..."],
  "toolCalls": [{ "id": "...", "tool": "...", "args": {}, "callID": "..." }],
  "tools": [{ "tool": "...", "args": {}, "output": "...", "title": "..." }],
  "finishReason": "stop"
}
```

## 关键设计决策

### 决策 1: shortUUID 清除时机

**问题**: 何时清除 `activeShortUUIDs` 中的 shortUUID？

**决策**:
- 在 `chat.messages.transform` 检测到新 user 消息时，清除上一个 shortUUID
- 在 `session.deleted` 时，清除 shortUUID
- **不在** `step-finish` 时清除（因为 tool-calls 后可能还有后续对话）

### 决策 2: 自动消息识别

**问题**: 如何识别后台任务完成等自动消息而不创建新文件？

**决策**: 检测消息内容是否包含 `<!-- OMO_INTERNAL_INITIATOR -->`

### 决策 3: 重复写入防护

**问题**: 如何防止同一个 response 被多次写入文件？

**决策**: 使用 `responseWritten` flag，在 `appendResponseToFile` 时检查并设置

## 目录结构

```
.opencode/
  logs/
    ses_{sessionID}_{shortUUID}.jsonl  ← 每个 turn 一个文件
  plugin/
    log-conversation.ts                  ← 插件主文件
```

## 测试验证

1. 连续发送 3 条用户消息
2. 验证生成 3 个独立文件
3. 验证每个文件包含成对的 request + response
4. 验证文件中不包含其他 user 消息的数据
