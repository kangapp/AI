# LLM Log Visualizer 事件流展示设计

**日期:** 2026-03-23
**状态:** 已确认

---

## 目标

在保持现有 UI 结构不变的前提下，增强 Chat History 区域，支持展示更多事件类型（reasoning、agent_switch、retry、file_reference、subtask_start、permission_request），形成完整的事件流视图。

---

## 现状分析

### Tool Call 完整性
- 日志中出现的工具类型：`glob`, `read`, `skill`
- **结论：** 正常。反映了实际任务类型，未触发 Bash/Write/Edit 等工具。

### 未展示的事件类型（8种）
| 事件类型 | 当前状态 | 目标状态 |
|---------|---------|---------|
| `llm_params` | 未展示 | 保持隐藏（技术参数，用户价值低） |
| `step_start` | 未展示 | 保持隐藏（调试用） |
| `reasoning` | 部分展示 | **新增展示** |
| `agent_switch` | 未展示 | **新增展示** |
| `retry` | 未展示 | **新增展示** |
| `file_reference` | 未展示 | **新增展示** |
| `subtask_start` | 未展示 | **新增展示** |
| `permission_request` | 未展示 | **新增展示** |

---

## 架构

**保持现有三栏结构不变：**
```
┌──────────┬─────────────────────┬─────────────────────────┐
│  Files   │   System Prompt     │   Conversation           │
│          │                    │   (含事件流)            │
│          │                    ├─────────────────────────┤
│          │                    │   Tool Calls            │
└──────────┴─────────────────────┴─────────────────────────┘
```

---

## Chat History 事件展示

### 事件类型与样式

| 事件类型 | 展示样式 | 图标 | 位置 |
|---------|---------|-----|------|
| `reasoning` | 默认展开，灰度背景，虚线边框，左侧灰色竖线 | 🔄 | Assistant 文本前 |
| `agent_switch` | 系统消息，深色背景 | 🔀 | 事件发生位置 |
| `retry` | 警告消息，橙色边框 | ⚠️ | 事件发生位置 |
| `file_reference` | 附件引用卡片 | 📎 | 事件发生位置 |
| `subtask_start` | 系统消息 | 📋 | 事件发生位置 |
| `permission_request` | 权限提示 | 🔒 | 事件发生位置 |

### 消息顺序（按时间）

1. User 消息（最早）
2. Reasoning（AI 思考，展开显示）
3. Assistant 文本（回复）
4. Tool Calls（执行工具）
5. 系统事件（agent_switch/retry/subtask/permission）

---

## reasoning 展示细节

```
┌─────────────────────────────────────────────┐
│ 🔄 Thinking                                 │
├─────────────────────────────────────────────┤
│ │ The user wants me to find all TypeScript │
│ │ files...                                 │
└─────────────────────────────────────────────┘
```

**样式规格：**
- 容器：`border: 1px dashed var(--border-muted)`，`background: rgba(255,255,255,0.03)`
- 左侧竖线：`border-left: 2px solid var(--text-muted)`
- 图标：🔄 位于标题区
- 文字颜色：`var(--text-secondary)` 或 `var(--text-muted)`
- 字体：等宽字体，与代码一致

---

## 实现要点

### 1. 数据层
- `useJsonlParser.ts` 的 `buildCachedViews` 需要收集并传递所有事件类型
- 当前只传递 `toolCalls`，需要扩展支持 `reasoning[]`, `agentSwitches[]`, `retries[]` 等

### 2. 组件层
- `App.tsx` 的 `renderMessages()` 扩展为 `renderEvents()`
- 新增事件类型渲染函数：`renderReasoning()`, `renderAgentSwitch()`, `renderRetry()`, `renderFileReference()`, `renderSubtask()`, `renderPermission()`

### 3. 样式层
- `App.css` 新增事件类型样式类
- 统一与现有 `chat-message` 的布局和间距

---

## 优先级

1. **P0:** reasoning 展示（核心价值）
2. **P1:** agent_switch, subtask_start 展示
3. **P2:** retry, file_reference, permission_request 展示
