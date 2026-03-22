# LLM Log Visualizer - Turn 累积视图设计

## 概述

将 LLM Log Visualizer 改造为"时间机器"视图：每个 Turn 展示的是从 Turn 1 到当前 Turn 的完整累积数据，各模块按时间倒序展示最新内容在前。

## 核心规则

1. **累积数据**：每个 Turn 视图包含从 Turn 1 到当前 Turn 的完整历史
2. **倒序展示**：各模块按时间倒序（最新在前）展示
3. **固定内容**：System Prompt 固定不变，不累积
4. **智能折叠**：默认展开最新内容，历史内容折叠

---

## 数据结构

### 现有结构

```typescript
interface Turn {
  turnStart: TurnStart
  events: AnyEvent[]
  turnComplete: TurnComplete | null
}

interface JsonlFile {
  filename: string
  turns: Turn[]
}
```

### 新增结构

```typescript
interface Message {
  role: string
  content: string | object
}

interface CachedView {
  currentTurn: number           // 当前 turn 编号
  systemPrompt: string[]        // 固定不变
  messages: Message[]           // 从 Turn 1 累积到当前（倒序）
  toolCalls: ToolCall[]          // 从 Turn 1 累积到当前（按 turn 倒序，turn 内正序）
  reasoning: string[]            // 当前 turn 的 reasoning
  turnComplete: TurnComplete | null
}

interface JsonlFile {
  filename: string
  filepath: string
  turns: Turn[]
  cachedViews: CachedView[]     // 每个 turn 一个累积视图
  modifiedAt: Date
}
```

---

## Parser 逻辑

### buildCachedViews 实现

```typescript
function buildCachedViews(turns: Turn[]): CachedView[] {
  return turns.map((turn, index) => {
    // 累积 messages（每个 turn 的 user message，按 turn 倒序）
    const messages: Message[] = []
    for (let i = index; i >= 0; i--) {
      const userMsgs = turns[i].turnStart.messages.filter(m => m.role === 'user')
      messages.push(...userMsgs)
    }

    // 累积 toolCalls（按 turn 倒序，turn 内按时间正序）
    const toolCalls: ToolCall[] = []
    for (let i = index; i >= 0; i--) {
      const tc = turns[i].turnComplete?.toolCalls || []
      toolCalls.push(...tc)
    }

    return {
      currentTurn: turn.turnStart.turn,
      systemPrompt: turn.turnStart.system,
      messages,
      toolCalls,
      reasoning: turn.turnComplete?.reasoning || [],
      turnComplete: turn.turnComplete
    }
  })
}
```

### 累积规则

| 模块 | 累积方式 | 排序 |
|------|----------|------|
| Chat History (User Messages) | 每个 turn 累积 | 倒序（最新在前） |
| Tool History | 每个 turn 累积 | 倒序（最新在前） |
| System Prompt | 不累积 | 固定 |
| Reasoning | 当前 turn | 不适用 |

---

## App.tsx 变更

### 渲染逻辑

```typescript
// 直接使用 cachedView，无需计算
const currentView = currentFile?.cachedViews[currentTurn - 1]

// Tool Card 展开/折叠
const isCurrentTurnTool = (index: number, currentTurn: number): boolean => {
  // 当前 turn 的 tool 默认展开，历史 turn 的 tool 默认折叠
}
```

### 切换 Turn 行为

- 切换到新 turn 时，滚动位置重置到顶部
- Tool calls 默认全部展开当前 turn 的，折叠历史的

---

## UI 效果

### Turn 3 视图示例

```
┌────────────────────────────────────────────────────────────┐
│  System Prompt (固定)                                      │
├────────────────────────────────────────────────────────────┤
│  Chat History (倒序)                                       │
│  ─────────────────────────────────────────────             │
│  [Turn 3] User: 今天的天气如何？                           │
│  [Turn 2] User: 北京在哪里？                               │
│  [Turn 1] User: 你好                                       │
├────────────────────────────────────────────────────────────┤
│  Tool History (倒序)                                       │
│  ─────────────────────────────────────────────             │
│  ▼ WebSearch: 天气                                         │
│    Args: { query: "今天天气" }                              │
│    Output: 晴天...                                        │
│  ▶ Read: config.json (Turn 2) - 折叠                      │
│  ▶ Bash: ls (Turn 1) - 折叠                                │
└────────────────────────────────────────────────────────────┘
```

### Tool Card 视觉区分

| 类型 | 边框 | 默认状态 |
|------|------|----------|
| 当前 Turn | 蓝色/强调色 | 展开 |
| 历史 Turn | 灰色 | 折叠 |

---

## 实现计划

1. 修改 `useJsonlParser.ts` - 添加 `buildCachedViews` 逻辑
2. 修改 `types/index.ts` - 添加 `CachedView` 类型
3. 修改 `App.tsx` - 使用 `cachedViews`，实现 Tool Card 折叠逻辑
4. 更新 `App.css` - 添加折叠状态的样式

---

## 变更文件清单

| 文件 | 变更类型 |
|------|----------|
| `src/types/index.ts` | 修改 - 添加 CachedView |
| `src/hooks/useJsonlParser.ts` | 修改 - 添加 buildCachedViews |
| `src/App.tsx` | 修改 - 使用 cachedViews |
| `src/App.css` | 修改 - 折叠样式 |
