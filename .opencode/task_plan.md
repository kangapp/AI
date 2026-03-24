# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ LLM Log Plugin 完成 | ✅ LLM Log Visualizer 完成（Event Stream + 独立滚动布局）

---

## 项目结构

### 1. LLM Log Conversation Plugin
- 路径: `.opencode/plugin/log-conversation.ts`
- 状态: ✅ 功能完成
- 所有 12 种事件类型都包含 `turn` 字段

### 2. LLM Log Visualizer
- 路径: `project/llm-log-visualizer/`
- 状态: ✅ Event Stream + 独立滚动布局
- Dev Server: http://localhost:5176/

---

## LLM Log Visualizer 功能清单

### 核心功能 ✅
| # | 功能 | 状态 |
|---|------|------|
| 1 | 拖拽上传 jsonl 文件 | ✅ |
| 2 | 文件列表侧边栏 | ✅ |
| 3 | 按 turn 索引显示内容 | ✅ |
| 4 | System Prompt 显示 + 折叠 | ✅ |
| 5 | Chat History 显示（chronological 顺序） | ✅ |
| 6 | Tool Calls 显示 | ✅ |
| 7 | Tool 类型筛选 | ✅ |
| 8 | Tool Output 渲染 | ✅ |
| 9 | 键盘 ← → 切换 turn | ✅ |
| 10 | 状态栏显示统计信息 | ✅ |
| 11 | Chat History 与 Tool Calls 独立滚动 | ✅ |
| 12 | 可拖拽调整上下区域高度 | ✅ |

### UI/UX ✅
| # | 功能 | 状态 |
|---|------|------|
| 1 | Editorial/Refined 深色主题 | ✅ |
| 2 | Fraunces + DM Sans 字体 | ✅ |
| 3 | Amber 强调色 | ✅ |
| 4 | 噪点纹理背景 | ✅ |
| 5 | 脉冲动画 Empty State | ✅ |
| 6 | Tool Card glow 效果 | ✅ |
| 7 | 展开/折叠动画 | ✅ |

### Markdown 渲染 ✅
| # | 功能 | 状态 |
|---|------|------|
| 1 | remark-gfm 支持 GFM 表格 | ✅ |
| 2 | 标题/列表/代码块 | ✅ |
| 3 | contentType 优先检测 markdown | ✅ |
| 4 | XML/JSON 格式识别为 text | ✅ |
| 5 | System Prompt ReactMarkdown | ✅ |
| 6 | Chat History ReactMarkdown | ✅ |
| 7 | Tool Output ReactMarkdown | ✅ |

---

## LLM Log Plugin 已修复问题

| 问题 | 状态 | 说明 |
|------|------|------|
| Turn 递增 | ✅ 已修复 | step-finish reason=tool-calls 时 turn += 1 |
| 重复 turn_complete | ✅ 已修复 | responseWritten 标志防止重复 |
| tool_call_result 合并 | ✅ 已修复 | tool.execute.before 暂存，after 配对写入 |
| 所有事件缺少 turn | ✅ 已修复 | 所有 12 种事件类型都添加了 turn 字段 |

---

## 待完成

### Turn Isolation Feature (已搁置)

**目标:** 每个 user turn 写入独立文件 `{sessionID}_{shortUUID}.jsonl`

此功能已搁置，当前实现为每 session 一个文件。

---

如有新需求，请告诉我！

---

## Git Commits

### LLM Log Visualizer (最新批次)
```
fddbee3 feat: parse file content from <content> tags and support mermaid diagrams
34af8b5 fix: improve tool calls scrolling and system prompt display
80edeb0 fix: reverse chat resize direction
553993e feat(styles): add CSS for independent scrolling panes
18de81e feat(layout): add independent chat and tool panes with resize handle
0f61de6 feat(parser): collect chat items in chronological order
c388e5b feat(types): add unified ChatItem type for chronological display
ceaf70b fix: collect reasoning events from events array not turnComplete
4c7246c feat(styles): add CSS for event stream display
7e4ee2a feat(app): add render functions for all event types
0810a54 feat(app): import new event types
e1c26c4 feat(parser): collect all event types in buildCachedViews
```

### LLM Log Plugin (历史)
```
48d4353 fix: increment turn on step-finish reason=tool-calls
7ccec40 fix: prevent duplicate turn_complete with responseWritten flag
66daf88 revert: restore Turn Isolation - each user message creates new file
d660bf2 fix: add turn and shortUUID to all turn_complete events
1226df9 feat: merge tool_call and tool_result into tool_call_result
```
