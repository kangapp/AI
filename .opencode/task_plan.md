# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: 🔧 修复 Turn 递增问题，待测试验证

## References

- Timeline Log V2 Design: `.opencode/doc/plan/2026-03-22-timeline-log-v2-design.md`
- Implementation Plan: `.opencode/doc/plan/2026-03-22-turn-index-fix-implementation.md`

## 设计澄清 (2026-03-22)

### Turn 索引规则（已确认）

- **同一个 session 的多个 turn 在同一个文件**
- **Turn 递增时机**: `step-finish reason=tool-calls` 后，新的 `turn_start` 时 `turn += 1`
- **Turn 结束时机**: `step-finish reason=stop/length/content-filter/null` 时写入 `turn_complete`

### 流程示例

```
user msg 1
  → turn_start turn=1
  → step-finish reason=tool-calls → turn += 1 (不写 turn_complete)
  → turn_start turn=2
  → step-finish reason=stop → 写入 turn_complete turn=2
```

## Timeline Log V2 事件类型（13 种）

| 事件 | 说明 | 触发时机 |
|------|------|----------|
| `turn_start` | turn 开始 | chat.system.transform |
| `llm_params` | LLM 调用参数 | chat.params |
| `permission_request` | 权限请求 | permission.ask |
| `step_start` | 思维步骤开始 | step-start part |
| `text` | 文本输出 | text.complete |
| `reasoning` | 思考过程 | messages.transform (assistant) |
| `tool_call_result` | 工具调用+结果（配对） | tool.execute.after |
| `agent_switch` | Agent 切换 | agent part |
| `retry` | 重试事件 | retry part |
| `file_reference` | 引用文件 | file part |
| `subtask_start` | 子任务开始 | subtask part |
| `turn_complete` | turn 完成 | step-finish |

## 当前架构

```
hooks:
  - chat.messages.transform: user 消息时创建新 turn
  - chat.system.transform: 获取 system prompt，写入 turn_start
  - chat.params: 写入 llm_params
  - permission.ask: 写入 permission_request
  - tool.execute.before: 暂存 tool_call
  - tool.execute.after: 配对写入 tool_call_result
  - text.complete: 写入 text
  - event (message.part.updated): step-start, agent, retry, file, subtask, step-finish
  - event (session.deleted): 写入最后的 turn_complete
```

## 待修复问题

| 问题 | 状态 | 说明 |
|------|------|------|
| Turn 递增 | 🔧 已修复 | step-finish reason=tool-calls 时 turn += 1 |
| 重复 turn_complete | 🔧 已修复 | 添加 responseWritten 标志 |
| tool_call_result 合并 | 🔧 已修复 | tool.execute.before 暂存，after 配对写入 |

## 测试验证

待用户运行测试验证：
```bash
cat logs/*.jsonl | jq 'select(.type == "turn_start") | {turn}'
```

预期：turn 应递增为 1, 2, 3, 4, ...
