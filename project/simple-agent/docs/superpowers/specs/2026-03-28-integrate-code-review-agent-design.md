# Integration: Code Review Agent into Web UI

## Status

Approved

## Overview

Integrate code-review-agent into the simple-agent web UI, allowing users to switch between "Simple Agent" and "Code Review Agent" modes within the same interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web UI (Port 3000)                    │
│  ┌──────────┬─────────────────────┬─────────────────────┐  │
│  │ TaskList │    ChatPanel        │   ConsolePanel     │  │
│  │          │ [Simple] [Review]   │                     │  │
│  │          │ + 输入框 + 切换      │                     │  │
│  └──────────┴─────────────────────┴─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server (Port 3001 + WS 3002)            │
│  POST /api/agent/run { sessionId, prompt, mode, agentType }│
└─────────────────────────────────────────────────────────────┘
```

## Backend Changes

### 1. `src/server/types.ts`

```typescript
interface AgentRunRequest {
  sessionId?: string;
  prompt: string;
  mode?: 'step' | 'loop';
  model?: string;
  provider?: 'openai' | 'anthropic';
  agentType?: 'simple' | 'code-review';  // NEW
}
```

### 2. `src/server/routes/agent.ts`

- Add `agentType` parameter handling
- When `agentType === 'code-review'`:
  - Read system prompt from `../../code-review-agent/prompts/system.md`
  - Prepend system message to messages array
- When `agentType === 'simple'` (default):
  - No system message prepended

## Frontend Changes

### 1. `web/src/store/index.ts`

Add to AgentStore interface:
```typescript
agentType: 'simple' | 'code-review';
setAgentType: (type: 'simple' | 'code-review') => void;
```

### 2. `web/src/components/ChatPanel.tsx`

- Add toggle buttons in header: "Simple" | "Review"
- Active button highlighted with distinct style
- Pass `agentType` when calling `runAgent`

### 3. `web/src/hooks/useAgent.ts`

- `runAgent` function accepts `agentType` parameter
- Include `agentType` in POST request body

## Behavior

| Agent Type   | System Prompt                          | Use Case        |
|--------------|----------------------------------------|-----------------|
| `simple`     | None                                   | General chat    |
| `code-review` | Load from `code-review-agent/prompts/system.md` | Code review |

Code review output (report content) is displayed directly in the message list as an assistant message.

## Files to Modify

### Backend
- `src/server/types.ts`
- `src/server/routes/agent.ts`

### Frontend
- `web/src/store/index.ts`
- `web/src/components/ChatPanel.tsx`
- `web/src/hooks/useAgent.ts`
