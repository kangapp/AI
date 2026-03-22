# LLM Log Visualizer - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 React 前端应用，可视化 jsonl 日志文件，分 turn 展示 System Prompt / Chat History / Tool History

**Architecture:** React + TypeScript + Vite，单页应用，jsonl 文件解析后存储在内存中，通过 Timeline 导航切换 turn

**Tech Stack:** React 18, TypeScript, Vite, react-markdown, rehype-highlight, 纯 CSS

---

## Task 1: 项目初始化

**Files:**
- Create: `llm-log-visualizer/package.json`
- Create: `llm-log-visualizer/vite.config.ts`
- Create: `llm-log-visualizer/index.html`
- Create: `llm-log-visualizer/tsconfig.json`

**Step 1: 创建 package.json**

```json
{
  "name": "llm-log-visualizer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^9.0.1",
    "rehype-highlight": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**Step 2: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LLM Log Visualizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Commit**

```bash
git add llm-log-visualizer/
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Types 定义

**Files:**
- Create: `llm-log-visualizer/src/types/index.ts`

**Step 1: 创建 types/index.ts**

```typescript
export type EventType =
  | "turn_start"
  | "turn_complete"
  | "llm_params"
  | "text"
  | "reasoning"
  | "tool_call_result"
  | "step_start"
  | "agent_switch"
  | "retry"
  | "file_reference"
  | "subtask_start"
  | "permission_request"

export interface TurnStart {
  type: "turn_start"
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string | null
  model: { providerID: string; modelID: string }
  agent: string
  system: string[]
  messages: any[]
}

export interface TurnComplete {
  type: "turn_complete"
  turn: number
  reason: string
  texts: string[]
  fullText: string
  reasoning: string[]
  toolCalls: ToolCall[]
  tools: Tool[]
}

export interface ToolCall {
  id: string
  tool: string
  args: any
  output: string | null
  title: string | null
}

export interface Tool {
  tool: string
  args: any
  output: string
  title: string
}

export interface LlmParams {
  type: "llm_params"
  turn: number
  temperature?: number
  topP?: number
  topK?: number
  options?: any
}

export interface TextEvent {
  type: "text"
  turn: number
  content: string
}

export interface ReasoningEvent {
  type: "reasoning"
  turn: number
  content: string
}

export interface ToolCallResult {
  type: "tool_call_result"
  turn: number
  id: string
  tool: string
  args: any
  output: string
  title: string
}

export type AnyEvent =
  | TurnStart
  | TurnComplete
  | LlmParams
  | TextEvent
  | ReasoningEvent
  | ToolCallResult

export interface Turn {
  turnStart: TurnStart
  events: AnyEvent[]
  turnComplete: TurnComplete | null
}

export interface JsonlFile {
  filename: string
  filepath: string
  turns: Turn[]
  modifiedAt: Date
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/types/index.ts
git commit -m "feat: add TypeScript types for jsonl events"
```

---

## Task 3: JSONL Parser Hook

**Files:**
- Create: `llm-log-visualizer/src/hooks/useJsonlParser.ts`

**Step 1: 创建 useJsonlParser.ts**

```typescript
import { useCallback } from 'react'
import type { Turn, AnyEvent, JsonlFile } from '../types'

export function useJsonlParser() {
  const parseContent = useCallback((content: string): JsonlFile => {
    const lines = content.trim().split('\n')
    const events: AnyEvent[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        events.push(JSON.parse(line))
      } catch (e) {
        console.warn('Failed to parse line:', line)
      }
    }

    const turns = buildTurns(events)

    return {
      filename: '',
      filepath: '',
      turns,
      modifiedAt: new Date(),
    }
  }, [])

  const buildTurns = (events: AnyEvent[]): Turn[] => {
    const turns: Turn[] = []
    let currentTurn: Turn | null = null

    for (const event of events) {
      if (event.type === 'turn_start') {
        if (currentTurn) {
          turns.push(currentTurn)
        }
        currentTurn = {
          turnStart: event as any,
          events: [],
          turnComplete: null,
        }
      } else if (event.type === 'turn_complete') {
        if (currentTurn) {
          currentTurn.turnComplete = event as any
          turns.push(currentTurn)
          currentTurn = null
        }
      } else if (currentTurn) {
        currentTurn.events.push(event)
      }
    }

    if (currentTurn) {
      turns.push(currentTurn)
    }

    return turns
  }

  return { parseContent }
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/hooks/useJsonlParser.ts
git commit -m "feat: add useJsonlParser hook"
```

---

## Task 4: Tokenizer Utility

**Files:**
- Create: `llm-log-visualizer/src/utils/tokenizer.ts`

**Step 1: 创建 tokenizer.ts**

```typescript
// Simple tokenizer for token estimation
// Uses a basic approximation: 1 token ≈ 4 characters for English
// For Chinese: 1 token ≈ 1-2 characters

export function estimateTokens(text: string): number {
  // Remove markdown formatting for better estimation
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/`[^`]*`/g, ' code ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~`]/g, '')

  let tokenCount = 0
  for (const char of cleaned) {
    if (char.charCodeAt(0) > 127) {
      tokenCount += 1.5 // Chinese character
    } else if (char === ' ' || char === '\n') {
      tokenCount += 0
    } else {
      tokenCount += 0.25 // English character
    }
  }

  return Math.ceil(tokenCount)
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(1)}k`
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/utils/tokenizer.ts
git commit -m "feat: add tokenizer utility for token estimation"
```

---

## Task 5: 基本布局 CSS

**Files:**
- Create: `llm-log-visualizer/src/App.css`

**Step 1: 创建 App.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --border-color: #e0e0e0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent-color: #0066cc;
  --timeline-width: 120px;
  --system-width: 30%;
  --history-width: 70%;
  --statusbar-height: 32px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-primary);
  height: 100vh;
  overflow: hidden;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  height: 48px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-weight: 600;
  font-size: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.turn-indicator {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Main Layout */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Timeline Column */
.timeline-column {
  width: var(--timeline-width);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.file-list {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.file-item {
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item:hover {
  background: var(--bg-primary);
}

.file-item.active {
  background: var(--accent-color);
  color: white;
}

.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 4px;
}

.timeline-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.timeline-item.active {
  background: var(--accent-color);
  color: white;
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-color);
}

.timeline-item.active .timeline-dot {
  background: white;
}

/* Content Columns */
.content-columns {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.system-column {
  width: var(--system-width);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.history-column {
  width: var(--history-width);
  display: flex;
  flex-direction: column;
}

.column-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* System Prompt */
.system-content {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}

/* Chat History */
.chat-content {
  font-size: 14px;
  line-height: 1.6;
}

.chat-message {
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 8px;
}

.chat-message.user {
  background: #e8f4ff;
}

.chat-message.assistant {
  background: #f0f0f0;
}

.chat-role {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

/* Tool History */
.tool-content {
  padding: 0;
}

.tool-card {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.tool-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  cursor: pointer;
}

.tool-card-header:hover {
  background: #e8e8e8;
}

.tool-name {
  font-family: monospace;
  font-weight: 600;
  font-size: 13px;
}

.tool-status {
  font-size: 12px;
  color: var(--text-secondary);
}

.tool-card-body {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  display: none;
}

.tool-card.expanded .tool-card-body {
  display: block;
}

.tool-args, .tool-output {
  margin-bottom: 12px;
}

.tool-args-title, .tool-output-title {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.tool-args pre, .tool-output pre {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 16px;
  height: var(--statusbar-height);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-secondary);
}

.status-item {
  display: flex;
  gap: 6px;
}

.status-label {
  font-weight: 600;
}

/* Drop Zone */
.drop-zone {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 102, 204, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.drop-zone-text {
  font-size: 24px;
  font-weight: 600;
  color: var(--accent-color);
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/App.css
git commit -m "feat: add main CSS layout styles"
```

---

## Task 6: Timeline 组件

**Files:**
- Create: `llm-log-visualizer/src/components/Timeline.tsx`

**Step 1: 创建 Timeline.tsx**

```typescript
import type { Turn } from '../types'

interface TimelineProps {
  turns: Turn[]
  currentTurn: number
  onSelectTurn: (turn: number) => void
}

export function Timeline({ turns, currentTurn, onSelectTurn }: TimelineProps) {
  return (
    <div className="timeline">
      {turns.map((turn) => (
        <div
          key={turn.turnStart.turn}
          className={`timeline-item ${turn.turnStart.turn === currentTurn ? 'active' : ''}`}
          onClick={() => onSelectTurn(turn.turnStart.turn)}
        >
          <div className="timeline-dot" />
          <span>Turn {turn.turnStart.turn}</span>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/components/Timeline.tsx
git commit -m "feat: add Timeline component"
```

---

## Task 7: SystemPrompt 组件

**Files:**
- Create: `llm-log-visualizer/src/components/SystemPrompt.tsx`

**Step 1: 创建 SystemPrompt.tsx**

```typescript
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface SystemPromptProps {
  turn: Turn
}

export function SystemPrompt({ turn }: SystemPromptProps) {
  const systemText = turn.turnStart.system.join('\n')
  const tokens = estimateTokens(systemText)

  return (
    <div className="system-column">
      <div className="column-header">
        System Prompt ({formatTokens(tokens)} tokens)
      </div>
      <div className="column-content">
        <div className="system-content">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {systemText}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/components/SystemPrompt.tsx
git commit -m "feat: add SystemPrompt component with Markdown"
```

---

## Task 8: ChatHistory 组件

**Files:**
- Create: `llm-log-visualizer/src/components/ChatHistory.tsx`

**Step 1: 创建 ChatHistory.tsx**

```typescript
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface ChatHistoryProps {
  turn: Turn
}

export function ChatHistory({ turn }: ChatHistoryProps) {
  const messages = turn.turnStart.messages || []
  const fullText = turn.turnComplete?.fullText || turn.events
    .filter(e => e.type === 'text')
    .map(e => (e as any).content)
    .join('')

  const tokens = estimateTokens(fullText)

  return (
    <div className="chat-column">
      <div className="column-header">
        Chat History ({formatTokens(tokens)} tokens)
      </div>
      <div className="column-content">
        <div className="chat-content">
          {messages.map((msg: any, idx: number) => {
            const role = msg.role || 'assistant'
            const content = typeof msg.content === 'string'
              ? msg.content
              : msg.content?.map((c: any) => c.text || '').join('') || ''

            return (
              <div key={idx} className={`chat-message ${role}`}>
                <div className="chat-role">{role}</div>
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {content}
                </ReactMarkdown>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/components/ChatHistory.tsx
git commit -m "feat: add ChatHistory component with Markdown"
```

---

## Task 9: ToolCard 组件

**Files:**
- Create: `llm-log-visualizer/src/components/ToolCard.tsx`

**Step 1: 创建 ToolCard.tsx**

```typescript
import { useState } from 'react'
import type { ToolCallResult } from '../types'

interface ToolCardProps {
  tool: ToolCallResult
}

export function ToolCard({ tool }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`tool-card ${expanded ? 'expanded' : ''}`}>
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-name">{tool.tool}</span>
        <span className="tool-status">{expanded ? '▼' : '▶'}</span>
      </div>
      <div className="tool-card-body">
        <div className="tool-args">
          <div className="tool-args-title">Arguments:</div>
          <pre>{JSON.stringify(tool.args, null, 2)}</pre>
        </div>
        <div className="tool-output">
          <div className="tool-output-title">Output:</div>
          <pre>{tool.output || '(empty)'}</pre>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/components/ToolCard.tsx
git commit -m "feat: add ToolCard component with expand/collapse"
```

---

## Task 10: ToolHistory 组件

**Files:**
- Create: `llm-log-visualizer/src/components/ToolHistory.tsx`

**Step 1: 创建 ToolHistory.tsx**

```typescript
import type { Turn } from '../types'
import { ToolCard } from './ToolCard'

interface ToolHistoryProps {
  turn: Turn
}

export function ToolHistory({ turn }: ToolHistoryProps) {
  const toolResults = turn.events.filter(
    (e): e is any => e.type === 'tool_call_result'
  )

  return (
    <div className="tool-column">
      <div className="column-header">
        Tool History ({toolResults.length} calls)
      </div>
      <div className="column-content">
        <div className="tool-content">
          {toolResults.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No tool calls in this turn
            </div>
          ) : (
            toolResults.map((tool, idx) => (
              <ToolCard key={tool.id || idx} tool={tool} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/components/ToolHistory.tsx
git commit -m "feat: add ToolHistory component"
```

---

## Task 11: StatusBar 组件

**Files:**
- Create: `llm-log-visualizer/src/components/StatusBar.tsx`

**Step 1: 创建 StatusBar.tsx**

```typescript
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface StatusBarProps {
  turn: Turn
  currentTurn: number
  totalTurns: number
}

export function StatusBar({ turn, currentTurn, totalTurns }: StatusBarProps) {
  const systemTokens = estimateTokens(turn.turnStart.system.join('\n'))

  const chatText = turn.turnComplete?.fullText ||
    turn.events.filter(e => e.type === 'text').map(e => (e as any).content).join('')
  const chatTokens = estimateTokens(chatText)

  const toolCount = turn.events.filter(e => e.type === 'tool_call_result').length

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Sysprompt:</span>
        <span>{formatTokens(systemTokens)}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Chat:</span>
        <span>{formatTokens(chatTokens)}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Tools:</span>
        <span>{toolCount}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Turn:</span>
        <span>{currentTurn} / {totalTurns}</span>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add llm-log-visualizer/src/components/StatusBar.tsx
git commit -m "feat: add StatusBar component"
```

---

## Task 12: App 主组件

**Files:**
- Create: `llm-log-visualizer/src/App.tsx`
- Create: `llm-log-visualizer/src/main.tsx`

**Step 1: 创建 main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 2: 创建 App.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Timeline } from './components/Timeline'
import { SystemPrompt } from './components/SystemPrompt'
import { ChatHistory } from './components/ChatHistory'
import { ToolHistory } from './components/ToolHistory'
import { StatusBar } from './components/StatusBar'
import { useJsonlParser } from './hooks/useJsonlParser'
import type { Turn, JsonlFile } from './types'

const LOGS_DIR = '.opencode/logs'

export default function App() {
  const [files, setFiles] = useState<JsonlFile[]>([])
  const [currentFile, setCurrentFile] = useState<JsonlFile | null>(null)
  const [currentTurn, setCurrentTurn] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const { parseContent } = useJsonlParser()

  // Load files from default directory
  useEffect(() => {
    loadDefaultLogs()
  }, [])

  const loadDefaultLogs = async () => {
    try {
      const response = await fetch(`file://${process.cwd()}/${LOGS_DIR}`)
      // For browser, we'll use a different approach
    } catch (e) {
      // Fallback: user will drag files
    }
  }

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.jsonl')) {
      loadFile(file)
    }
  }, [parseContent])

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const parsed = parseContent(content)
      parsed.filename = file.name
      parsed.filepath = file.name
      setCurrentFile(parsed)
      setCurrentTurn(1)
    }
    reader.readAsText(file)
  }

  const currentTurnData = currentFile?.turns.find(
    t => t.turnStart.turn === currentTurn
  )

  const handlePrevTurn = () => {
    if (currentTurn > 1) setCurrentTurn(currentTurn - 1)
  }

  const handleNextTurn = () => {
    if (currentFile && currentTurn < currentFile.turns.length) {
      setCurrentTurn(currentTurn + 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevTurn()
      if (e.key === 'ArrowRight') handleNextTurn()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTurn, currentFile])

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="header-title">
            {currentFile ? currentFile.filename : 'LLM Log Visualizer'}
          </span>
        </div>
        <div className="header-right">
          <button
            className="nav-btn"
            onClick={handlePrevTurn}
            disabled={!currentFile || currentTurn <= 1}
          >
            ←
          </button>
          <span className="turn-indicator">
            {currentFile ? `Turn ${currentTurn} / ${currentFile.turns.length}` : '-'}
          </span>
          <button
            className="nav-btn"
            onClick={handleNextTurn}
            disabled={!currentFile || currentTurn >= (currentFile?.turns.length || 1)}
          >
            →
          </button>
        </div>
      </header>

      <div
        className="app-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="main-content">
          <div className="timeline-column">
            {currentFile && (
              <>
                <Timeline
                  turns={currentFile.turns}
                  currentTurn={currentTurn}
                  onSelectTurn={setCurrentTurn}
                />
              </>
            )}
          </div>

          {currentTurnData ? (
            <div className="content-columns">
              <SystemPrompt turn={currentTurnData} />
              <div className="history-column">
                <ChatHistory turn={currentTurnData} />
                <ToolHistory turn={currentTurnData} />
              </div>
            </div>
          ) : (
            <div className="content-columns" style={{ alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                <div>Drag & drop a .jsonl file here</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  or use keyboard ← → to navigate
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {currentTurnData && currentFile && (
        <StatusBar
          turn={currentTurnData}
          currentTurn={currentTurn}
          totalTurns={currentFile.turns.length}
        />
      )}

      {isDragging && (
        <div className="drop-zone">
          <div className="drop-zone-text">Drop .jsonl file here</div>
        </div>
      )}
    </>
  )
}
```

**Step 3: Commit**

```bash
git add llm-log-visualizer/src/App.tsx llm-log-visualizer/src/main.tsx
git commit -m "feat: add main App component with full layout"
```

---

## Task 13: 测试验证

**Step 1: 安装依赖并启动**

```bash
cd llm-log-visualizer
npm install
npm run dev
```

**Step 2: 手动测试**

1. 打开浏览器访问 localhost:5173
2. 拖拽一个 jsonl 文件到页面
3. 验证 Timeline 显示正确的 turns
4. 验证 System Prompt 正确渲染 Markdown
5. 验证 Chat History 正确渲染
6. 验证 Tool History 可以展开/折叠
7. 验证 Status Bar 显示 token 统计
8. 验证键盘 ← → 可以切换 turn

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `llm-log-visualizer/package.json` | 新增 |
| `llm-log-visualizer/vite.config.ts` | 新增 |
| `llm-log-visualizer/index.html` | 新增 |
| `llm-log-visualizer/tsconfig.json` | 新增 |
| `llm-log-visualizer/src/types/index.ts` | 新增 |
| `llm-log-visualizer/src/hooks/useJsonlParser.ts` | 新增 |
| `llm-log-visualizer/src/utils/tokenizer.ts` | 新增 |
| `llm-log-visualizer/src/App.css` | 新增 |
| `llm-log-visualizer/src/components/Timeline.tsx` | 新增 |
| `llm-log-visualizer/src/components/SystemPrompt.tsx` | 新增 |
| `llm-log-visualizer/src/components/ChatHistory.tsx` | 新增 |
| `llm-log-visualizer/src/components/ToolHistory.tsx` | 新增 |
| `llm-log-visualizer/src/components/ToolCard.tsx` | 新增 |
| `llm-log-visualizer/src/components/StatusBar.tsx` | 新增 |
| `llm-log-visualizer/src/App.tsx` | 新增 |
| `llm-log-visualizer/src/main.tsx` | 新增 |

---

**Plan complete and saved to `docs/plans/2026-03-22-llm-log-visualizer-implementation.md`**

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
