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
| `tool.execute.before/after` | 工具 | 工具执行前后 |
| `experimental.chat.messages.transform` | 消息 | 消息历史转换 |
| `experimental.chat.system.transform` | 消息 | System prompt 转换 |
| `experimental.text.complete` | 输出 | 文本块完成 |
| `event` | 特殊 | Bus 事件 |

## Turn 生命周期 (关键发现)

### 完整数据流

```
1. 组装 msgs (消息历史)
   ↓
2. experimental.chat.messages.transform (获取 msgs，但 system 未构建)
   ↓
3. 构建 system prompt (SystemPrompt.environment, skills, instructions)
   ↓
4. experimental.chat.system.transform (可获取 system prompt)
   ↓
5. processor.process() → LLM 调用
   ↓
6. 流式输出: text-complete, tool-result, reasoning
   ↓
7. step-finish part 保存 → Bus.publish("message.part.updated", { part })
   ↓
8. event hook 收到 "message.part.updated" 事件
```

### 关键发现

1. **Turn 结束检测**: `step-finish` part 保存时触发 `message.part.updated` 事件
2. **System prompt 时机**: `chat.messages.transform` 时 system 未构建，需要用 `chat.system.transform` 获取
3. **消息 parts**: `msgs` 中的 assistant 消息包含完整的 `ToolPart` 和 `ReasoningPart`
4. **Event hook**: 监听 `message.part.updated` 事件可获取 `step-finish` part 的 `reason` 和 `usage` 信息

## Part 类型

| Part Type | 说明 |
|-----------|------|
| `text` | 文本输出 |
| `reasoning` | 思考过程 (Ultra Think) |
| `tool` | 工具调用 |
| `step-finish` | Turn 结束标志 |
| `step-start` | Turn 开始标志 |

## JSONL 输出格式

### Request
```json
{
  "type": "request",
  "turn": 1,
  "sessionID": "ses_xxx",
  "model": { "providerID": "...", "modelID": "..." },
  "agent": "...",
  "system": ["..."],
  "messages": [{ "role": "user/assistant", "content": [...] }]
}
```

### Response
```json
{
  "type": "response",
  "turn": 1,
  "sessionID": "ses_xxx",
  "texts": ["..."],
  "fullText": "...",
  "reasoning": ["..."],
  "toolCalls": [{ "id": "...", "tool": "...", "args": {} }],
  "tools": [{ "tool": "...", "output": "..." }],
  "finishReason": "stop",
  "usage": { "tokens": {...}, "cost": 0 }
}
```
