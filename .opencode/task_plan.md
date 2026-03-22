# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ LLM Log Plugin 功能完成 | ✅ LLM Log Visualizer 重新设计完成

---

## 项目结构

### 1. LLM Log Conversation Plugin
- 路径: `.opencode/plugin/log-conversation.ts`
- 状态: ✅ 功能完成
- 所有 12 种事件类型都包含 `turn` 字段

### 2. LLM Log Visualizer (重新设计)
- 路径: `project/llm-log-visualizer/`
- 状态: ✅ UI 重新设计完成
- Dev Server: http://localhost:5173/

---

## LLM Log Plugin 状态

### 已修复问题

| 问题 | 状态 | 说明 |
|------|------|------|
| Turn 递增 | ✅ 已修复 | step-finish reason=tool-calls 时 turn += 1 |
| 重复 turn_complete | ✅ 已修复 | responseWritten 标志防止重复 |
| tool_call_result 合并 | ✅ 已修复 | tool.execute.before 暂存，after 配对写入 |
| 所有事件缺少 turn | ✅ 已修复 | 所有 12 种事件类型都添加了 turn 字段 |

---

## LLM Log Visualizer (2026-03-22 重新设计)

### 技术栈
- React 18 + TypeScript
- Vite
- 纯 CSS（深色主题）

### UI 特性
- 深色 GitHub 风格主题
- 文件列表侧边栏（支持多文件）
- 可拖拽调整的分隔布局
- 独立的滚动区域
- IBM Plex Sans + JetBrains Mono 字体

### 核心功能
- ✅ 拖拽上传 jsonl 文件
- ✅ 文件列表侧边栏
- ✅ 按 turn 索引显示内容
- ✅ System Prompt 显示
- ✅ Chat History 显示
- ✅ Tool Calls 显示（从 events 和 turnComplete 读取）
- ✅ 可展开的 Tool Card
- ✅ 键盘 ← → 切换 turn
- ✅ 状态栏显示统计信息

### Bug Fixes (本次重新设计)
| 问题 | 解决方案 |
|------|----------|
| Vite 中间件路由匹配问题 | 调整中间件顺序 |
| 拖拽闪烁 | 添加 pointer-events: none + 延迟 |
| Tool calls 不显示 | 从 events 数组读取 tool_call_result |
| 消息内容对象报错 | 添加 renderContent() 处理对象格式 |

---

## Git Commits

### LLM Log Visualizer (最新)
```
927bf09 feat: redesign LLM Log Visualizer with dark theme and improved UX
```

### LLM Log Plugin (历史)
```
48d4353 fix: increment turn on step-finish reason=tool-calls
7ccec40 fix: prevent duplicate turn_complete with responseWritten flag
66daf88 revert: restore Turn Isolation - each user message creates new file
d660bf2 fix: add turn and shortUUID to all turn_complete events
1226df9 feat: merge tool_call and tool_result into tool_call_result
```

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
