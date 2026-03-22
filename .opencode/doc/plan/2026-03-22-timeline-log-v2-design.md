# Timeline Log V2 Design

## 目标

完整性优先：尽可能捕获所有与 LLM 交互的信息。

## 事件类型（13 种）

| 事件 | 触发时机 | 说明 |
|------|----------|------|
| `turn_start` | `chat.system.transform` | Turn 开始 |
| `llm_params` | `chat.params` | LLM 调用参数（temperature, topP, topK, options） |
| `permission_request` | `permission.ask` | 权限请求（危险命令确认等）|
| `step_start` | `step-start` part | 思维步骤开始 |
| `text` | `text.complete` | 文本输出 |
| `reasoning` | `messages.transform` (assistant) | 思考过程 |
| `tool_call` | `tool.execute.before` | 工具调用 |
| `tool_result` | `tool.execute.after` | 工具结果 |
| `agent_switch` | `agent` part | Agent 切换 |
| `retry` | `retry` part | 重试事件（attempt, error） |
| `file_reference` | `file` part | LLM 参考的文件/图片 |
| `subtask_start` | `subtask` part | 子任务开始（独立文件） |
| `turn_complete` | `step-finish` (reason=stop/length/content-filter/null) | Turn 完成 |

## 数据结构

### turn_start

```json
{
  "type": "turn_start",
  "timestamp": "2026-03-22T00:00:00.000Z",
  "sessionID": "ses_xxx",
  "shortUUID": "abc123def456",
  "parentShortUUID": null,
  "turn": 1,
  "model": { "providerID": "...", "modelID": "..." },
  "agent": "...",
  "system": ["..."],
  "messages": [{ "role": "user", "content": [...] }]
}
```

### llm_params

```json
{
  "type": "llm_params",
  "timestamp": "2026-03-22T00:00:00.000Z",
  "temperature": 0.7,
  "topP": 0.9,
  "topK": 40,
  "options": {}
}
```

### permission_request

```json
{
  "type": "permission_request",
  "timestamp": "2026-03-22T00:00:00.000Z",
  "permissionType": "...",
  "pattern": "...",
  "title": "...",
  "status": "ask"
}
```

### step_start

```json
{
  "type": "step_start",
  "timestamp": "2026-03-22T00:00:01.000Z",
  "stepId": "step_xxx"
}
```

### text

```json
{
  "type": "text",
  "timestamp": "2026-03-22T00:00:01.000Z",
  "content": "..."
}
```

### reasoning

```json
{
  "type": "reasoning",
  "timestamp": "2026-03-22T00:00:02.000Z",
  "content": "thinking..."
}
```

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

### agent_switch

```json
{
  "type": "agent_switch",
  "timestamp": "2026-03-22T00:00:05.000Z",
  "agent": "...",
  "source": { "value": "...", "start": 0, "end": 100 }
}
```

### retry

```json
{
  "type": "retry",
  "timestamp": "2026-03-22T00:00:06.000Z",
  "attempt": 1,
  "error": "..."
}
```

### file_reference

```json
{
  "type": "file_reference",
  "timestamp": "2026-03-22T00:00:07.000Z",
  "mime": "image/png",
  "filename": "screenshot.png",
  "url": "..."
}
```

### subtask_start

```json
{
  "type": "subtask_start",
  "timestamp": "2026-03-22T00:00:08.000Z",
  "sessionID": "ses_sub_xxx",
  "shortUUID": "sub_abc123",
  "parentShortUUID": "abc123def456",
  "prompt": "...",
  "description": "...",
  "agent": "...",
  "model": { "providerID": "...", "modelID": "..." },
  "command": "..."
}
```

### turn_complete

```json
{
  "type": "turn_complete",
  "timestamp": "2026-03-22T00:00:10.000Z",
  "reason": "stop",
  "texts": ["..."],
  "fullText": "...",
  "reasoning": ["..."],
  "toolCalls": [{ "id": "...", "tool": "...", "args": {} }],
  "tools": [{ "tool": "...", "args": {}, "output": "...", "title": "..." }]
}
```

## 子任务独立文件机制

### 规则

1. 子任务有自己独立的 `sessionID` + `shortUUID`
2. 子任务生成独立的 jsonl 文件
3. 通过 `parentShortUUID` 字段关联父任务
4. 子任务完全独立追踪，不嵌套

### 文件命名

```
父任务: ses_{sessionID}_{shortUUID}.jsonl
子任务: ses_{subSessionID}_{shortUUID}.jsonl
```

### 示例

```
父任务文件: ses_0c1e5a8f2d_AbCdEfGhIjKl.jsonl
子任务文件: ses_1a2b3c4d5e_fGhIjKlMnOp.jsonl
```

子任务文件的 `turn_start` 事件中包含 `parentShortUUID: "AbCdEfGhIjKl"`。

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

自动消息（如后台任务完成通知）包含 `<!-- OMO_INTERNAL_INITIATOR -->`,不创建新 turn，继续使用当前 turn。

## Hook 使用

| Hook | 事件 |
|------|------|
| `chat.messages.transform` | 识别 user 消息，创建 turn；提取 reasoning |
| `chat.system.transform` | 获取 system prompt，写入 turn_start |
| `chat.params` | 写入 llm_params |
| `permission.ask` | 写入 permission_request |
| `tool.execute.before` | 写入 tool_call |
| `tool.execute.after` | 写入 tool_result |
| `experimental.text.complete` | 写入 text |
| `event (message.part.updated)` | step-start, agent, retry, file, subtask part |

## Part 类型处理

| Part 类型 | 事件 | 说明 |
|-----------|------|------|
| `step-start` | `step_start` | 思维步骤开始 |
| `agent` | `agent_switch` | Agent 切换 |
| `retry` | `retry` | 重试事件 |
| `file` | `file_reference` | 引用文件 |
| `subtask` | `subtask_start` | 子任务（独立文件） |

## 文件格式

```jsonl
{"type": "turn_start", "timestamp": "...", "sessionID": "...", "shortUUID": "...", "parentShortUUID": null, "turn": 1, "model": {...}, "agent": "...", "system": [...], "messages": [...]}
{"type": "llm_params", "timestamp": "...", "temperature": 0.7, "topP": 0.9, "topK": 40, "options": {}}
{"type": "step_start", "timestamp": "...", "stepId": "..."}
{"type": "text", "timestamp": "...", "content": "..."}
{"type": "reasoning", "timestamp": "...", "content": "thinking..."}
{"type": "tool_call", "timestamp": "...", "id": "...", "tool": "...", "args": {...}}
{"type": "tool_result", "timestamp": "...", "tool": "...", "args": {...}, "output": "...", "title": "..."}
{"type": "agent_switch", "timestamp": "...", "agent": "...", "source": {...}}
{"type": "retry", "timestamp": "...", "attempt": 1, "error": "..."}
{"type": "file_reference", "timestamp": "...", "mime": "...", "filename": "...", "url": "..."}
{"type": "turn_complete", "timestamp": "...", "reason": "stop", "texts": [...], "fullText": "...", "reasoning": [...], "toolCalls": [...], "tools": [...]}
```

## 目录结构

```
.opencode/
  logs/
    ses_{sessionID}_{shortUUID}.jsonl  ← 每个 turn 一个文件
    ses_{subSessionID}_{shortUUID}.jsonl  ← 子任务独立文件
  plugin/
    log-conversation.ts                  ← 插件主文件
```
