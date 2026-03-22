# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ Timeline Log 实现完成，待测试验证

## References

- Timeline Log Design: `.opencode/doc/plan/2026-03-22-timeline-log-design.md`
- Timeline Log Implementation: `.opencode/doc/plan/2026-03-22-timeline-log-implementation.md`

## 事件类型

| 事件 | 说明 | 触发时机 |
|------|------|----------|
| `turn_start` | turn 开始 | chat.system.transform |
| `text` | 文本输出 | text.complete |
| `reasoning` | 思考过程 | chat.messages.transform (assistant) |
| `tool_call` | 工具调用 | tool.execute.before |
| `tool_result` | 工具结果 | tool.execute.after |
| `turn_complete` | turn 完成 | step-finish (reason=stop/length/content-filter) |

## 当前架构

```
hooks:
  - chat.messages.transform: user 消息时创建新 turn，提取 reasoning
  - chat.system.transform: 获取 system prompt，写入 turn_start
  - text.complete: 累积文本，写入 text 事件
  - tool.execute.before: 写入 tool_call 事件
  - tool.execute.after: 写入 tool_result 事件
  - event (step-finish): 写入 turn_complete 事件
  - event (session.deleted): 写入最后的 turn_complete
```

## 输出文件格式

- 文件名: `{sessionID}_{shortUUID}.jsonl`
- 每个文件包含一个独立的对话流程
- 格式: 时间线事件序列 (turn_start → text/reasoning/tool_call/tool_result → turn_complete)
