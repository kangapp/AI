# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ Timeline Log 实现完成，待测试验证

## References

- Timeline Log V2 Design: `.opencode/doc/plan/2026-03-22-timeline-log-v2-design.md`

## Timeline Log V2 改进

### 新增事件类型（7 种）

| 事件 | 说明 | 优先级 |
|------|------|--------|
| `llm_params` | LLM 调用参数 | 高 |
| `permission_request` | 权限请求 | 高 |
| `step_start` | 思维步骤开始 | 高 |
| `agent_switch` | Agent 切换 | 高 |
| `retry` | 重试事件 | 高 |
| `file_reference` | 引用文件 | 高 |
| `subtask_start` | 子任务开始 | 高 |

### 子任务独立文件机制

- 子任务有自己独立的 `sessionID` + `shortUUID`
- 通过 `parentShortUUID` 关联父任务
- 完全独立追踪，不嵌套

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
