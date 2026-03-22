# Findings: LLM Log Conversation Plugin

## SessionID 生成逻辑

- 格式: `ses_{6字节时间戳+计数器hex}_{12位随机base62}`
- 例如: `ses_0c1e5a8f2d_AbCdEfGhIjKlMnOpQrStUv`
- 位于: `src/id/id.ts`

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

## Turn 生命周期 (关键发现)

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

### 关键发现

1. **Turn 结束检测**: `step-finish` part 的 `reason` 字段:
   - `"stop"`: 表示对话真正结束
   - `"tool-calls"`: 表示 AI 调用工具，不算真正结束

2. **System prompt 时机**: `chat.messages.transform` 时 system 未构建，需要用 `chat.system.transform` 获取

3. **toolCalls vs tools**: `toolCalls` 在 `tool.execute.before` 时记录，`tools` 在 `tool.execute.after` 时记录

4. **消息历史问题**: `output.messages` 是完整历史，不能直接保存，需要只保存当前 turn 的消息

## Part 类型

| Part Type | 说明 |
|-----------|------|
| `text` | 文本输出 |
| `reasoning` | 思考过程 (Ultra Think) |
| `tool` | 工具调用 |
| `step-finish` | Turn 结束标志 (含 reason 字段) |
| `step-start` | Turn 开始标志 |

## Turn Isolation 实现

### 目标
每个用户消息生成一个独立的 jsonl 文件，避免多个对话混在一起。

### 核心逻辑

1. **文件命名**: `{sessionID}_{shortUUID}.jsonl`
2. **shortUUID**: `crypto.randomUUID().substring(0, 12)`
3. **turn 编号**: 每个文件都从 turn=1 开始

### 分阶段写入

| 阶段 | 时机 | 操作 |
|------|------|------|
| 1 | `chat.messages.transform` (user) | 创建新文件，写入 request |
| 2 | `tool.execute.before` | 记录 toolCalls |
| 3 | `tool.execute.after` | 记录 tools |
| 4 | `text.complete` | 累积 texts |
| 5 | `step-finish` (reason !== "tool-calls") | 追加 response |
| 6 | `session.deleted` | 写入最后的 response |

### 关键代码片段

```typescript
// chat.messages.transform: user 消息时
if (isUserMessage) {
  // 写入前一个 turn（如果存在）
  if (state) {
    appendResponseToFile(state)
  }
  // 创建新 state，只保存当前 user 消息
  state.request.messages = [{ role: "user", content: lastMsg.parts }]
  writeRequestToFile(state)
  return
}

// step-finish: 非 tool-calls 时追加 response
if (reason !== "tool-calls") {
  appendResponseToFile(state)
  turns.delete(turnKey)
  activeShortUUIDs.delete(sessionID)
}
```

## Timeline Log 格式

### turn_start
```json
{
  "type": "turn_start",
  "timestamp": "...",
  "sessionID": "ses_xxx",
  "shortUUID": "abc123",
  "turn": 1,
  "model": { "providerID": "...", "modelID": "..." },
  "agent": "...",
  "system": ["..."],
  "messages": [{ "role": "user", "content": [...] }]
}
```

### text
```json
{
  "type": "text",
  "timestamp": "...",
  "content": "..."
}
```

### reasoning
```json
{
  "type": "reasoning",
  "timestamp": "...",
  "content": "thinking..."
}
```

### tool_call
```json
{
  "type": "tool_call",
  "timestamp": "...",
  "id": "call_xxx",
  "tool": "read_file",
  "args": { "path": "..." }
}
```

### tool_result
```json
{
  "type": "tool_result",
  "timestamp": "...",
  "tool": "read_file",
  "args": { "path": "..." },
  "output": "...",
  "title": "..."
}
```

### turn_complete
```json
{
  "type": "turn_complete",
  "timestamp": "...",
  "reason": "stop",
  "texts": ["..."],
  "fullText": "...",
  "reasoning": ["..."],
  "toolCalls": [...],
  "tools": [...]
}
```
