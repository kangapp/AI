# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ LLM Log Plugin 功能完成 | ✅ LLM Log Visualizer 开发完成

## Sessions

### Catchup (2026-03-22)

**未同步上下文 (Session 92657238):**
- Turn 递增问题修复已提交 (commits `48d4353`, `7ccec40`)
- 最近的 .learning/ 变更未追踪
- 新增 Turn Isolation 设计文档待实施

---

## 项目结构

### 1. LLM Log Conversation Plugin
- 路径: `.opencode/plugin/log-conversation.ts`
- 状态: ✅ 功能完成
- 所有 12 种事件类型都包含 `turn` 字段

### 2. LLM Log Visualizer (新建)
- 路径: `project/llm-log-visualizer/`
- 状态: ✅ 开发完成，Dev Server 运行中
- 功能: 可视化 jsonl 日志文件，分 turn 展示

---

## LLM Log Plugin 状态

### 已修复问题

| 问题 | 状态 | 说明 |
|------|------|------|
| Turn 递增 | ✅ 已修复 | step-finish reason=tool-calls 时 turn += 1 |
| 重复 turn_complete | ✅ 已修复 | responseWritten 标志防止重复 |
| tool_call_result 合并 | ✅ 已修复 | tool.execute.before 暂存，after 配对写入 |
| 所有事件缺少 turn | ✅ 已修复 | 所有 12 种事件类型都添加了 turn 字段 |

### Turn 索引规则（已确认）

- **同一个 session 的多个 turn 在同一个文件**
- **Turn 递增时机**: `step-finish reason=tool-calls` 后，新的 `turn_start` 时 `turn += 1`
- **Turn 结束时机**: `step-finish reason=stop/length/content-filter/null` 时写入 `turn_complete`

---

## LLM Log Visualizer

### 项目位置
`project/llm-log-visualizer/`

### 技术栈
- React 18 + TypeScript
- Vite
- react-markdown + rehype-highlight
- 纯 CSS

### 核心功能
- ✅ 默认读取 `.opencode/logs/` 目录（通过 Vite API）
- ✅ 拖拽上传 jsonl 文件
- ✅ Timeline 导航切换 turn
- ✅ System Prompt Markdown 渲染
- ✅ Chat History Markdown 渲染
- ✅ Tool History 可展开卡片
- ✅ Status Bar Token 统计
- ✅ 键盘 ← → 切换 turn

### Git Commits (13 个)
```
4a4d280 fix: remove unused code and browser-compatible fetch
43c023a feat: add main App component with full layout
96e4125 feat: add StatusBar component
fbb15a8 feat: add ToolHistory component
3ef7bce feat: add ToolCard component with expand/collapse
1b757d5 feat: add ChatHistory component with Markdown
d48008e feat: add SystemPrompt component with Markdown
c77f683 feat: add Timeline component
f78fb8b feat: add main CSS layout styles
7951e55 feat: add tokenizer utility for token estimation
d77ce44 feat: add useJsonlParser hook
2fc76e4 feat: add TypeScript types for jsonl events
f5b88f1 feat: scaffold Vite + React + TypeScript project
```

### Dev Server
- 状态: ✅ 运行中
- URL: http://localhost:5173/
- API: `/api/logs` - 获取日志文件列表
- API: `/api/logs/:filename` - 获取日志文件内容

---

## 待完成

### Turn Isolation Feature

**目标:** 每个 user turn 写入独立文件 `{sessionID}_{shortUUID}.jsonl`

**参考文档:**
- Design: `.opencode/doc/plan/2026-03-21-turn-isolation-design.md`
- Implementation: `.opencode/doc/plan/2026-03-21-turn-isolation-implementation.md`

| # | Task | Status |
|---|------|--------|
| 1 | 修改 getLogPath 函数 | ⏳ |
| 2 | 添加 shortUUID 生成逻辑 | ⏳ |
| 3 | 更新所有使用 sessionID 的地方 | ⏳ |
| 4 | 测试验证 | ⏳ |
