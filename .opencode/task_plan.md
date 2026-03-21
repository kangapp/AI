# Task Plan: LLM Log Conversation Plugin

## Project Context
创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## References
- Design: `.opencode/doc/plan/2026-03-21-llm-log-conversation-design.md`
- Implementation: `.opencode/doc/plan/2026-03-21-llm-log-conversation-implementation.md`

## Task Queue

- [ ] Task 1: 创建目录结构
- [ ] Task 2: 创建 log-conversation.ts 基础框架
- [ ] Task 3: 实现 chat.messages.transform 收集输入
- [ ] Task 4: 实现 text.complete 收集文本输出
- [ ] Task 5: 实现 tool.execute.after 收集工具调用
- [ ] Task 6: 实现 chat.message 写入上一轮 jsonl
- [ ] Task 7: 处理 session 结束时写入最后数据
- [ ] Task 8: 验证实现
- [ ] Task 9: 添加 .gitignore

## Error Log

(记录执行过程中的错误)

## Notes

- 使用 opencode plugin hooks 系统，无需修改源码
- Turn 结束通过下一个 chat.message 隐式触发
- 输出格式为 JSONL，每条记录包含 type, turn, sessionID, timestamp
