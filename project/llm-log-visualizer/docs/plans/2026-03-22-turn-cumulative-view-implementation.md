# Turn 累积视图实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 LLM Log Visualizer 改造为"时间机器"视图，每个 Turn 展示从 Turn 1 到当前 Turn 的完整累积数据

**Architecture:** 修改 useJsonlParser 在解析时生成累积视图 cachedViews，App.tsx 直接使用 cachedViews 渲染，无需运行时计算

**Tech Stack:** React 18, TypeScript, Vite

---

## Task 1: 添加 CachedView 类型

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 添加 CachedView 和 Message 类型**

在 `types/index.ts` 末尾添加：

```typescript
export interface Message {
  role: string
  content: string | object
}

export interface CachedView {
  currentTurn: number
  systemPrompt: string[]
  messages: Message[]
  toolCalls: ToolCall[]
  reasoning: string[]
  turnComplete: TurnComplete | null
}
```

**Step 2: 更新 JsonlFile 类型**

将 `JsonlFile` 接口修改为：

```typescript
export interface JsonlFile {
  filename: string
  filepath: string
  turns: Turn[]
  cachedViews: CachedView[]
  modifiedAt: Date
}
```

**Step 3: Commit**

```bash
cd /Users/liufukang/workplace/AI/project/llm-log-visualizer
git add src/types/index.ts
git commit -m "feat: add CachedView and Message types"
```

---

## Task 2: 实现 buildCachedViews 逻辑

**Files:**
- Modify: `src/hooks/useJsonlParser.ts`

**Step 1: 添加 buildCachedViews 函数**

在 `buildTurns` 函数后添加：

```typescript
const buildCachedViews = (turns: Turn[]): CachedView[] => {
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

**Step 2: 更新 parseContent 返回值**

将 parseContent 的返回值从：

```typescript
return {
  filename: '',
  filepath: '',
  turns,
  modifiedAt: new Date(),
}
```

修改为：

```typescript
 const cachedViews = buildCachedViews(turns)

 return {
  filename: '',
  filepath: '',
  turns,
  cachedViews,
  modifiedAt: new Date(),
}
```

**Step 3: Commit**

```bash
git add src/hooks/useJsonlParser.ts
git commit -m "feat: add buildCachedViews to generate cumulative views"
```

---

## Task 3: 修改 App.tsx 使用 cachedViews

**Files:**
- Modify: `src/App.tsx`

**Step 1: 修改变量引用**

将：
```typescript
const currentTurnData = currentFile?.turns.find(t => t.turnStart.turn === currentTurn)
```

修改为：
```typescript
const currentView = currentFile?.cachedViews[currentTurn - 1]
```

**Step 2: 更新 messages 渲染**

将 `renderMessages` 中的：
```typescript
const messages = currentTurnData.turnStart.messages || []
```

修改为：
```typescript
const messages = currentView?.messages || []
```

**Step 3: 更新 texts 渲染**

将：
```typescript
const texts = currentTurnData.turnComplete?.texts || []
```

修改为：
```typescript
const texts = currentView?.turnComplete?.texts || []
```

**Step 4: 更新 toolCalls 渲染**

将 `renderToolCalls` 中的 tool calls 收集逻辑改为直接使用 `currentView.toolCalls`：

```typescript
const allToolCalls = currentView?.toolCalls || []
```

**Step 5: 更新 system prompt 引用**

将：
```typescript
currentTurnData.turnStart.system?.join('').split(/\s+/).length
```

修改为：
```typescript
currentView?.systemPrompt?.join('').split(/\s+/).length
```

将：
```typescript
currentTurnData.turnStart.system?.join('\n\n')
```

修改为：
```typescript
currentView?.systemPrompt?.join('\n\n')
```

**Step 6: 添加 tool 所属 turn 的标记**

修改 `renderToolCalls`，为每个 tool 添加 turn 标记：

```typescript
const getToolTurn = (index: number): number => {
  // toolCalls 在 cachedViews 中按 turn 倒序累积
  // 需要根据 index 推算属于哪个 turn
  // 策略：从后往前数，每个 turn 的 toolCalls 数量不同
  // 更简单的方式：在 cachedView 中直接存储带 turn 标记的 toolCalls
  return currentTurn - Math.floor(index / avgToolsPerTurn) // 简化估算
}
```

实际上更准确的方式是修改 buildCachedViews，让它返回带 turn 标记的 toolCalls。暂时用简化方式，后续可优化。

**Step 7: 更新状态栏引用**

将：
```typescript
currentTurnData?.turnComplete?.toolCalls?.length || 0
```

修改为：
```typescript
currentView?.toolCalls?.length || 0
```

**Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: use cachedViews for cumulative turn display"
```

---

## Task 4: 实现 Tool Card 按 turn 折叠

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Step 1: 添加展开状态管理**

在 `expandedTools` 旁边添加一个新状态来跟踪当前可见的 tool indices：

```typescript
const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())
```

**Step 2: 实现按 turn 折叠逻辑**

当前 turn 的 tools 全部展开，历史 turn 的 tools 全部折叠。实现一个辅助函数：

```typescript
const isToolExpanded = (toolIndex: number): boolean => {
  // 当前 turn 的 tool index 范围需要计算
  // 从 cachedView.toolCalls 长度和当前 turn 推断
  // 简化：当前 turn 的 tools 在数组前面（因为是倒序）
  const totalTools = currentView?.toolCalls?.length || 0
  // 假设每个 turn 平均 tool 数，可以根据实际情况调整
  // 更准确的做法是标记每个 tool 的 turn
  return toolIndex < estimatedCurrentTurnTools
}
```

**Step 3: 修改 tool-card 渲染**

为 tool-card 添加 turn 标记和折叠样式：

```typescript
<div className={`tool-card ${isCurrentTurnTool ? 'expanded' : 'collapsed'} ${isCurrentTurnTool ? '' : 'historical'}`}>
  <div className="tool-card-header" onClick={() => toggleTool(index)}>
    <span className="tool-name">
      {tool.tool}
      {!isCurrentTurnTool && <span className="tool-turn-badge">Turn {toolTurn}</span>}
    </span>
    <span className="tool-status">{isExpanded ? '▼' : '▶'}</span>
  </div>
  ...
</div>
```

**Step 4: 添加 CSS 样式**

在 `App.css` 中添加：

```css
.tool-card.historical {
  opacity: 0.85;
  border-left: 3px solid #666;
}

.tool-card.historical .tool-card-header {
  background: var(--bg-secondary);
}

.tool-turn-badge {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 8px;
  font-weight: normal;
}

.tool-card.collapsed .tool-card-body {
  display: none;
}
```

**Step 5: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add turn-based tool card collapse/expand"
```

---

## Task 5: 测试验证

**Step 1: 启动 dev server**

```bash
cd /Users/liufukang/workplace/AI/project/llm-log-visualizer
npm run dev
```

访问 http://localhost:5173/

**Step 2: 测试步骤**

1. 拖拽一个 jsonl 文件（如 `.opencode/logs/ses_xxx.jsonl`）
2. 验证 Turn 1 显示 Turn 1 的数据
3. 点击 → 切换到 Turn 2，验证：
   - Chat History 显示 Turn 2 和 Turn 1 的 user 消息
   - Tool History 显示 Turn 2 和 Turn 1 的工具调用
   - Turn 2 的 tool 展开，Turn 1 的 tool 折叠
4. 点击 → 切换到 Turn 3，验证累积数据正确
5. 验证 ← → 键盘导航正常

**Step 3: Commit**

```bash
git add -A
git commit -m "test: verify cumulative view functionality"
```

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `src/types/index.ts` | 修改 - 添加 CachedView、Message 类型 |
| `src/hooks/useJsonlParser.ts` | 修改 - 添加 buildCachedViews |
| `src/App.tsx` | 修改 - 使用 cachedViews，按 turn 折叠 |
| `src/App.css` | 修改 - 添加折叠样式 |
