# Task Plan: LLM Log Conversation Plugin

## Project Context

创建 opencode plugin，用于捕获每个 Turn 的 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

## Status: ✅ LLM Log Plugin 完成 | ✅ LLM Log Visualizer 完成

---

## 项目结构

### 1. LLM Log Conversation Plugin
- 路径: `.opencode/plugin/log-conversation.ts`
- 状态: ✅ 功能完成
- 所有 12 种事件类型都包含 `turn` 字段

### 2. LLM Log Visualizer
- 路径: `project/llm-log-visualizer/`
- 状态: ✅ UI Redesign + Tool Filter + Tool Output 修复
- Dev Server: http://localhost:5175/

---

## LLM Log Visualizer 功能清单

### 核心功能 ✅
| # | 功能 | 状态 |
|---|------|------|
| 1 | 拖拽上传 jsonl 文件 | ✅ |
| 2 | 文件列表侧边栏 | ✅ |
| 3 | 按 turn 索引显示内容 | ✅ |
| 4 | System Prompt 显示 + 折叠 | ✅ |
| 5 | Chat History 显示 | ✅ |
| 6 | Tool Calls 显示 | ✅ |
| 7 | Tool 类型筛选 | ✅ |
| 8 | Tool Output 渲染 | ✅ |
| 9 | 键盘 ← → 切换 turn | ✅ |
| 10 | 状态栏显示统计信息 | ✅ |
| 11 | 可拖拽调整分隔布局 | ✅ |

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

### Turn Isolation Feature (未开始)

**目标:** 每个 user turn 写入独立文件 `{sessionID}_{shortUUID}.jsonl`

| # | Task | Status |
|---|------|--------|
| 1 | 修改 getLogPath 函数 | ⏳ |
| 2 | 添加 shortUUID 生成逻辑 | ⏳ |
| 3 | 更新所有使用 sessionID 的地方 | ⏳ |
| 4 | 测试验证 | ⏳ |

---

## Git Commits

### LLM Log Visualizer (最新批次)
```
aea719d docs: update planning files with cumulative view and content formatting
2dab01f feat: add proper Markdown rendering with react-markdown
089df94 feat: integrate ContentBlock in App.tsx
bec9539 feat: add content block CSS styles
abea69a feat: add ContentBlock component
```

### LLM Log Plugin (历史)
```
48d4353 fix: increment turn on step-finish reason=tool-calls
7ccec40 fix: prevent duplicate turn_complete with responseWritten flag
66daf88 revert: restore Turn Isolation - each user message creates new file
d660bf2 fix: add turn and shortUUID to all turn_complete events
1226df9 feat: merge tool_call and tool_result into tool_call_result
```
