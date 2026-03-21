# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ ALL TASKS COMPLETED

## References

- Design: `.opencode/doc/plan/2026-03-21-llm-log-conversation-design.md`
- Implementation: `.opencode/doc/plan/2026-03-21-llm-log-conversation-v2-implementation.md`

## Task Queue

### V1 Implementation (Completed)

- [x] Task 1: 创建目录结构
- [x] Task 2: 创建 log-conversation.ts 基础框架
- [x] Task 3: 实现 chat.messages.transform 收集输入
- [x] Task 4: 实现 text.complete 收集文本输出
- [x] Task 5: 实现 tool.execute.after 收集工具调用
- [x] Task 6: 实现 event hook 检测 step-finish 并写入 jsonl
- [x] Task 7: 处理 session 结束时写入最后数据
- [x] Task 9: 添加 .gitignore

### V2 Improvement (Completed)

- [x] Task 1: 更新 TurnState 数据结构（添加 reasoning, toolCalls）
- [x] Task 2: 添加 chat.system.transform hook 捕获 system prompt
- [x] Task 3: 改进 chat.messages.transform 提取 toolCalls 和 reasoning
- [x] Task 4: 更新 event hook 写入完整 response
- [x] Task 5: 验证完整数据

## Error Log

(无错误)

## Notes

- V2 实现：捕获完整的 system prompt、tool calls、reasoning
- Turn 结束通过监听 `message.part.updated` 事件，当 `part.type === "step-finish"` 时立即触发
- 输出格式为 JSONL，每条记录包含 type, turn, sessionID, timestamp
