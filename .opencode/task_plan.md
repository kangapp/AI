# Task Plan: LLM Log Conversation Plugin

## Project Context
创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## References
- Design: `.opencode/doc/plan/2026-03-21-llm-log-conversation-design.md`
- Implementation: `.opencode/doc/plan/2026-03-21-llm-log-conversation-implementation.md`

## Task Queue

- [ ] Task 1: 更新 TurnState 数据结构
- [ ] Task 2: 添加 chat.system.transform hook
- [ ] Task 3: 改进 chat.messages.transform 提取 tool 和 reasoning
- [ ] Task 4: 更新 event hook 写入完整 response
- [ ] Task 5: 验证完整数据

## References
- Design: `.opencode/doc/plan/2026-03-21-llm-log-conversation-design.md`
- Implementation: `.opencode/doc/plan/2026-03-21-llm-log-conversation-v2-implementation.md`

## Error Log

(记录执行过程中的错误)

## Notes

- 改进 v2 实现：捕获完整的 system prompt、tool calls、reasoning
- Turn 结束通过监听 `message.part.updated` 事件，当 `part.type === "step-finish"` 时立即触发
- 输出格式为 JSONL，每条记录包含 type, turn, sessionID, timestamp
