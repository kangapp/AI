# LLM Log Visualizer Event Stream Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add event stream display (reasoning, agent_switch, retry, file_reference, subtask_start, permission_request) to Chat History area without changing UI structure.

**Architecture:** Extend CachedView to include all events, render them in chronological order within Chat History alongside existing User/Assistant messages.

**Tech Stack:** React 18, TypeScript, CSS (no new dependencies)

---

## Task 1: Update Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new event interfaces**

```typescript
// Add after existing interfaces

export interface AgentSwitchEvent {
  type: "agent_switch"
  turn: number
  agent: string
  source: string
}

export interface RetryEvent {
  type: "retry"
  turn: number
  attempt: number
  error: string
}

export interface FileReferenceEvent {
  type: "file_reference"
  turn: number
  mime: string
  filename: string
  url: string
}

export interface SubtaskStartEvent {
  type: "subtask_start"
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string
  prompt: string
  description: string
  agent: string
  model: { providerID: string; modelID: string }
  command: string
}

export interface PermissionRequestEvent {
  type: "permission_request"
  turn: number
  permissionType: string
  pattern: string
  title: string
  status: string
}
```

**Step 2: Update AnyEvent union type**

```typescript
export type AnyEvent =
  | TurnStart
  | TurnComplete
  | LlmParams
  | TextEvent
  | ReasoningEvent
  | ToolCallResult
  | AgentSwitchEvent    // ADD
  | RetryEvent          // ADD
  | FileReferenceEvent  // ADD
  | SubtaskStartEvent   // ADD
  | PermissionRequestEvent  // ADD
```

**Step 3: Update CachedView to include all events**

```typescript
export interface CachedView {
  currentTurn: number
  systemPrompt: string[]
  messages: Message[]
  toolCalls: ToolCall[]
  toolTurnCounts: number[]
  reasoning: string[]
  turnComplete: TurnComplete | null
  // Add these:
  agentSwitches: AgentSwitchEvent[]
  retries: RetryEvent[]
  fileReferences: FileReferenceEvent[]
  subtaskStarts: SubtaskStartEvent[]
  permissionRequests: PermissionRequestEvent[]
}
```

---

## Task 2: Update useJsonlParser

**Files:**
- Modify: `src/hooks/useJsonlParser.ts`

**Step 1: Update buildCachedViews to collect all events**

Modify the `buildCachedViews` function to collect all event types into their respective arrays:

```typescript
const buildCachedViews = (turns: Turn[]): CachedView[] => {
  return turns.map((turn, index) => {
    // ... existing messages and toolCalls collection ...

    // NEW: Collect all event types
    const agentSwitches: AgentSwitchEvent[] = []
    const retries: RetryEvent[] = []
    const fileReferences: FileReferenceEvent[] = []
    const subtaskStarts: SubtaskStartEvent[] = []
    const permissionRequests: PermissionRequestEvent[] = []

    // Collect from events array
    for (let i = index; i >= 0; i--) {
      for (const event of turns[i].events) {
        switch (event.type) {
          case 'agent_switch':
            agentSwitches.push(event as AgentSwitchEvent)
            break
          case 'retry':
            retries.push(event as RetryEvent)
            break
          case 'file_reference':
            fileReferences.push(event as FileReferenceEvent)
            break
          case 'subtask_start':
            subtaskStarts.push(event as SubtaskStartEvent)
            break
          case 'permission_request':
            permissionRequests.push(event as PermissionRequestEvent)
            break
        }
      }
    }

    return {
      // ... existing properties ...
      agentSwitches,
      retries,
      fileReferences,
      subtaskStarts,
      permissionRequests,
    }
  })
}
```

---

## Task 3: Update App.tsx - Add Event Types to CachedView

**Files:**
- Modify: `src/App.tsx:1-10` (imports)

**Step 1: Import new event types**

Add to the existing import from '../types':
```typescript
import type {
  JsonlFile,
  CachedView,
  Message,
  ToolCall,
  ReasoningEvent,
  AgentSwitchEvent,
  RetryEvent,
  FileReferenceEvent,
  SubtaskStartEvent,
  PermissionRequestEvent,
} from './types'
```

---

## Task 4: Update App.tsx - Render New Event Types

**Files:**
- Modify: `src/App.tsx` - Add render functions and update renderMessages

**Step 1: Add render function for Reasoning**

Add after `renderContent` function (around line 369):

```typescript
// Render reasoning event
const renderReasoning = (reasoning: ReasoningEvent, index: number) => (
  <div key={`reasoning-${index}`} className="chat-message reasoning">
    <div className="chat-role">🔄 Thinking</div>
    <div className="reasoning-content">
      {reasoning.content}
    </div>
  </div>
)
```

**Step 2: Add render functions for system events**

Add after renderReasoning:

```typescript
// Render agent switch event
const renderAgentSwitch = (event: AgentSwitchEvent, index: number) => (
  <div key={`agent-switch-${index}`} className="chat-message system">
    <div className="chat-role">🔀 Agent Switch</div>
    <div className="system-event-content">
      Switched to: <strong>{event.agent}</strong>
    </div>
  </div>
)

// Render retry event
const renderRetry = (event: RetryEvent, index: number) => (
  <div key={`retry-${index}`} className="chat-message warning">
    <div className="chat-role">⚠️ Retry</div>
    <div className="retry-content">
      Attempt {event.attempt}: {event.error}
    </div>
  </div>
)

// Render file reference event
const renderFileReference = (event: FileReferenceEvent, index: number) => (
  <div key={`file-ref-${index}`} className="chat-message attachment">
    <div className="chat-role">📎 File Reference</div>
    <div className="file-ref-content">
      <span className="file-ref-name">{event.filename}</span>
      <span className="file-ref-mime">{event.mime}</span>
    </div>
  </div>
)

// Render subtask start event
const renderSubtaskStart = (event: SubtaskStartEvent, index: number) => (
  <div key={`subtask-${index}`} className="chat-message system">
    <div className="chat-role">📋 Subtask Started</div>
    <div className="subtask-content">
      {event.description || event.prompt.substring(0, 100)}
    </div>
  </div>
)

// Render permission request event
const renderPermissionRequest = (event: PermissionRequestEvent, index: number) => (
  <div key={`permission-${index}`} className="chat-message permission">
    <div className="chat-role">🔒 Permission</div>
    <div className="permission-content">
      {event.title || event.permissionType}: {event.status}
    </div>
  </div>
)
```

**Step 3: Update renderMessages to include all events**

Replace the current `renderMessages` function with a new `renderEvents` function that renders all events in chronological order.

The new order should be:
1. User messages (existing)
2. Reasoning events (before assistant text)
3. Assistant texts (existing)
4. System events (agent_switch, retry, file_reference, subtask_start, permission_request)

Note: This is a complex change - see implementation details in the code comments.

---

## Task 5: Add CSS Styles for New Event Types

**Files:**
- Modify: `src/App.css`

**Step 1: Add reasoning styles**

Add after `.chat-message.assistant` (around line 529):

```css
.chat-message.reasoning {
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed var(--border-default);
  border-left: 3px solid var(--text-muted);
}

.chat-message.reasoning .chat-role {
  color: var(--text-muted);
  font-size: 10px;
}

.reasoning-content {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
```

**Step 2: Add system event styles**

```css
.chat-message.system {
  background: var(--color-system-bg);
  border-color: var(--color-system-border);
  border-left: 3px solid var(--color-system);
}

.chat-message.system .chat-role {
  color: var(--color-system);
}

.system-event-content {
  font-size: 12px;
  color: var(--text-secondary);
}
```

**Step 3: Add warning/retry styles**

```css
.chat-message.warning {
  background: rgba(255, 152, 0, 0.08);
  border-color: rgba(255, 152, 0, 0.25);
  border-left: 3px solid #ff9800;
}

.chat-message.warning .chat-role {
  color: #ff9800;
}

.retry-content {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}
```

**Step 4: Add attachment styles**

```css
.chat-message.attachment {
  background: rgba(33, 150, 243, 0.08);
  border-color: rgba(33, 150, 243, 0.25);
  border-left: 3px solid #2196f3;
}

.chat-message.attachment .chat-role {
  color: #2196f3;
}

.file-ref-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.file-ref-name {
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.file-ref-mime {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
}
```

**Step 5: Add permission styles**

```css
.chat-message.permission {
  background: rgba(156, 39, 176, 0.08);
  border-color: rgba(156, 39, 176, 0.25);
  border-left: 3px solid #9c27b0;
}

.chat-message.permission .chat-role {
  color: #9c27b0;
}

.permission-content {
  font-size: 12px;
  color: var(--text-secondary);
}
```

**Step 6: Add subtask styles**

```css
.subtask-content {
  font-size: 12px;
  color: var(--text-secondary);
}
```

---

## Task 6: Update Chat History Container

**Files:**
- Modify: `src/App.css`

**Step 1: Update .chat-content to accommodate all event types**

The `.chat-content` flex container should remain the same but ensure it handles variable height content properly.

---

## Task 7: Verify and Test

**Step 1: Start dev server**

```bash
cd project/llm-log-visualizer && npm run dev
```

**Step 2: Load a sample jsonl file and verify:**
- Reasoning content displays with 🔄 icon and dashed border
- Agent switches display with 🔀 icon
- Retry events display with ⚠️ icon
- File references display with 📎 icon
- Subtask starts display with 📋 icon
- Permission requests display with 🔒 icon

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add event stream display to Chat History

- Add reasoning display with thinking icon
- Add agent_switch, retry, file_reference events
- Add subtask_start, permission_request events
- Style system events consistently"
```
