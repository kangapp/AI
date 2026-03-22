# Timeline Log Design

## 需求

用时间线日志格式记录与 LLM 的交互过程，体现完整的交互序列。

## 核心设计原则

1. **每个事件一条记录** - 不区分 request/response，用事件类型描述交互过程
2. **按时间顺序追加** - 每个新事件追加到 jsonl 文件
3. **完整的 turn 生命周期** - 从 turn_start 到 turn_complete

## 事件类型

| 事件 | 说明 | 触发时机 |
|------|------|----------|
| `turn_start` | turn 开始 | 用户消息到来，system prompt 已获取 |
| `text` | 文本输出 | `text.complete` hook |
| `reasoning` | 思考过程 | 从 messages 提取 |
| `tool_call` | 工具调用 | `tool.execute.before` hook |
| `tool_result` | 工具结果 | `tool.execute.after` hook |
| `turn_complete` | turn 完成 | `step-finish reason=stop/length/content-filter/null` |

## 事件数据结构

### turn_start

```json
{
  "type": "turn_start",
  "timestamp": "2026-03-22T00:00:00.000Z",
  "sessionID": "ses_xxx",
  "shortUUID": "abc123def456",
  "turn": 1,
  "model": {
    "providerID": "...",
    "modelID": "..."
  },
  "agent": "...",
  "system": ["..."],
  "messages": [{ "role": "user", "content": [...] }]
}
```

**触发时机**: `chat.system.transform` 获取 system 后，写入 turn_start

### text

```json
{
  "type": "text",
  "timestamp": "2026-03-22T00:00:01.000Z",
  "content": "..."
}
```

**触发时机**: `text.complete` hook

### reasoning

```json
{
  "type": "reasoning",
  "timestamp": "2026-03-22T00:00:02.000Z",
  "content": "..."
}
```

**触发时机**: 从 messages 中的 assistant 消息提取 reasoning 内容

### tool_call

```json
{
  "type": "tool_call",
  "timestamp": "2026-03-22T00:00:03.000Z",
  "id": "call_xxx",
  "tool": "read_file",
  "args": { "path": "..." }
}
```

**触发时机**: `tool.execute.before` hook

### tool_result

```json
{
  "type": "tool_result",
  "timestamp": "2026-03-22T00:00:04.000Z",
  "tool": "read_file",
  "args": { "path": "..." },
  "output": "...",
  "title": "..."
}
```

**触发时机**: `tool.execute.after` hook

### turn_complete

```json
{
  "type": "turn_complete",
  "timestamp": "2026-03-22T00:00:05.000Z",
  "reason": "stop",
  "texts": ["..."],
  "fullText": "...",
  "reasoning": ["..."],
  "toolCalls": [{ "id": "...", "tool": "...", "args": {} }],
  "tools": [{ "tool": "...", "args": {}, "output": "...", "title": "..." }]
}
```

**触发时机**: `step-finish` 事件的 `reason` 为 `stop`、`length`、`content-filter` 或 `null`

## Turn 结束条件

```typescript
const isTurnEnd = reason === "stop" ||
                  reason === "length" ||
                  reason === "content-filter" ||
                  reason === null
```

| reason | 是否结束 Turn |
|--------|--------------|
| `stop` | ✅ 是 |
| `length` | ✅ 是 |
| `content-filter` | ✅ 是 |
| `tool-calls` | ❌ 否 |
| `unknown` | ❌ 否 |
| `null` | ✅ 是 |
| `undefined` | ❌ 否 |

## 自动消息处理

自动消息（如后台任务完成通知）包含 `<!-- OMO_INTERNAL_INITIATOR -->`，不创建新 turn，继续使用当前 turn。

## 数据流

```
user message → chat.messages.transform → 创建 state
    ↓
chat.system.transform → 获取 system → 写入 turn_start
    ↓
text.complete → 写入 text 事件
    ↓
tool.execute.before → 写入 tool_call 事件
    ↓
tool.execute.after → 写入 tool_result 事件
    ↓
step-finish (reason=stop) → 写入 turn_complete
```

## 文件格式

### 文件命名

```
{sessionID}_{shortUUID}.jsonl
```

### 示例内容

```jsonl
{"type": "turn_start", "timestamp": "...", "sessionID": "...", "shortUUID": "...", "turn": 1, "model": {...}, "agent": "...", "system": [...], "messages": [...]}
{"type": "text", "timestamp": "...", "content": "..."}
{"type": "reasoning", "timestamp": "...", "content": "thinking..."}
{"type": "tool_call", "timestamp": "...", "id": "...", "tool": "...", "args": {...}}
{"type": "tool_result", "timestamp": "...", "tool": "...", "args": {...}, "output": "...", "title": "..."}
{"type": "tool_call", "timestamp": "...", "id": "...", "tool": "...", "args": {...}}
{"type": "tool_result", "timestamp": "...", "tool": "...", "args": {...}, "output": "...", "title": "..."}
{"type": "text", "timestamp": "...", "content": "..."}
{"type": "turn_complete", "timestamp": "...", "reason": "stop", "texts": [...], "fullText": "...", "reasoning": [...], "toolCalls": [...], "tools": [...]}
```

## 目录结构

```
.opencode/
  logs/
    ses_{sessionID}_{shortUUID}.jsonl  ← 每个 turn 一个文件
  plugin/
    log-conversation.ts                  ← 插件主文件
```

## 测试验证

1. 发送 3 条用户消息
2. 验证生成 3 个独立文件
3. 验证每个文件包含：
   - 1 条 `turn_start` 事件
   - 多条 `text`、`reasoning`、`tool_call`、`tool_result` 事件
   - 1 条 `turn_complete` 事件
4. 验证事件按时间顺序追加
