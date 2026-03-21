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

## Turn 生命周期

```
chat.message (Turn N 开始)
  ↓
experimental.chat.messages.transform (记录 Turn N 输入)
  ↓
LLM.stream() ... 流式输出
  ↓
experimental.text.complete + tool.execute.after (收集输出)
  ↓
chat.message (Turn N+1 开始) → 写入 Turn N 的完整 jsonl
```

## 关键发现

1. `finish-step` 不是 plugin hook，是 processor.ts 内部事件
2. 使用 `chat.message` 作为隐式 Turn 结束标志
3. plugin 可通过 `file://` 或 npm 包加载
