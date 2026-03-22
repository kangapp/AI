# Findings: LLM Log Conversation Plugin

## SessionID 生成逻辑

- 格式: `ses_{6字节时间戳+计数器hex}_{12位随机base62}`
- 例如: `ses_0c1e5a8f2d_AbCdEfGhIjKlMnOpQrStUv`

## Opencode Plugin Hooks

| Hook | 类型 | 说明 |
|------|------|------|
| `chat.message` | 输入 | 用户消息到达 |
| `chat.params` | 输入 | LLM 参数 |
| `chat.headers` | 输入 | HTTP headers |
| `tool.execute.before` | 工具 | 工具执行前记录 toolCall |
| `tool.execute.after` | 工具 | 工具执行后记录结果 |
| `experimental.chat.messages.transform` | 消息 | 消息历史转换 |
| `experimental.chat.system.transform` | 消息 | System prompt 转换 |
| `experimental.text.complete` | 输出 | 文本块完成 |
| `event` | 特殊 | Bus 事件 |

## Turn 生命周期

### 完整数据流

```
1. 用户发送消息
   ↓
2. chat.messages.transform (获取 msgs，但 system 未构建)
   ↓
3. chat.system.transform (可获取 system prompt)
   ↓
4. processor.process() → LLM 调用
   ↓
5. 流式输出: text-complete, tool-result, reasoning
   ↓
6. step-finish part 保存 → Bus.publish("message.part.updated", { part })
   ↓
7. event hook 收到 "message.part.updated" 事件
```

### Turn 索引规则（设计澄清 2026-03-22）

- **同一个 session 的多个 turn 在同一个文件**
- **Turn 递增时机**: `step-finish reason=tool-calls` 后，新的 `turn_start` 时 `turn += 1`
- **Turn 结束时机**: `step-finish reason=stop/length/content-filter/null` 时写入 `turn_complete`

### Turn 流程示例

```
user msg 1
  → turn_start turn=1
  → step-finish reason=tool-calls → turn += 1 (不写 turn_complete)
  → turn_start turn=2
  → step-finish reason=stop → 写入 turn_complete turn=2
```

## Part 类型

| Part Type | 事件 | 说明 |
|-----------|------|------|
| `text` | text | 文本输出 |
| `reasoning` | reasoning | 思考过程 (Ultra Think) |
| `tool` | (merged into tool_call_result) | 工具调用 |
| `step-finish` | turn_complete | Turn 结束标志 |
| `step-start` | step_start | 思维步骤开始 |
| `agent` | agent_switch | Agent 切换 |
| `retry` | retry | 重试事件 |
| `file` | file_reference | 引用文件 |
| `subtask` | subtask_start | 子任务（独立文件） |

## TurnState 数据结构

```typescript
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string | null
  filePath: string
  responseWritten: boolean  // 防止重复写入 turn_complete
  request: {
    messages: any[]
    system: string[]
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]
    reasoning: string[]
    toolCalls: { id, tool, args, output, title }[]
    tools: { tool, args, output, title }[]
  }
}
```

## Timeline Log 事件格式

### turn_start
```json
{
  "type": "turn_start",
  "turn": 1,
  "sessionID": "ses_xxx",
  "shortUUID": "abc123",
  "parentShortUUID": null,
  "model": {...},
  "agent": "...",
  "system": [...],
  "messages": [...]
}
```

### tool_call_result
```json
{
  "type": "tool_call_result",
  "id": "call_xxx",
  "tool": "read_file",
  "args": {...},
  "output": "...",
  "title": "..."
}
```

### turn_complete
```json
{
  "type": "turn_complete",
  "turn": 1,
  "reason": "stop",
  "texts": [...],
  "fullText": "...",
  "reasoning": [...],
  "toolCalls": [...],
  "tools": [...]
}
```
