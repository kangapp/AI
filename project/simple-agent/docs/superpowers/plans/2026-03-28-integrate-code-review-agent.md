# Code Review Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add agent type toggle (Simple/Code Review) to Web UI, backend routes agent based on type and loads system prompt for code-review mode.

**Architecture:** Backend extends `/api/agent/run` to accept `agentType` parameter. When `code-review`, loads system prompt from `../../code-review-agent/prompts/system.md`. Frontend adds toggle buttons in ChatPanel header and passes `agentType` on each request.

**Tech Stack:** Express.js, React/Zustand, TypeScript

---

## Task 1: Update Backend Types

**Files:**
- Modify: `src/server/types.ts`

- [ ] **Step 1: Add agentType to AgentRunRequest**

```typescript
export interface AgentRunRequest {
  sessionId?: string;
  prompt: string;
  mode: 'loop' | 'step';
  model?: string;
  provider?: 'openai' | 'anthropic';
  agentType?: 'simple' | 'code-review';  // NEW
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/types.ts
git commit -m "feat: add agentType field to AgentRunRequest"
```

---

## Task 2: Update Backend Route - Load System Prompt

**Files:**
- Modify: `src/server/routes/agent.ts`
- Requires: `src/server/types.ts` updated

- [ ] **Step 1: Read the current agent.ts to understand exact code structure**

```typescript
// src/server/routes/agent.ts - current structure:
// - Imports: Router, Agent, tools, WSManager, AgentRunRequest
// - createAgentRouter(wsManager) returns router
// - router.post('/run', ...) handles POST /api/agent/run
```

- [ ] **Step 2: Add imports for fs/promises and path**

Add at top of file:
```typescript
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
```

- [ ] **Step 3: Add system prompt loading logic in POST handler**

After line `const { sessionId, prompt, mode, model, provider } = req.body as AgentRunRequest;`, add:

```typescript
const agentType = (req.body as AgentRunRequest).agentType || 'simple';

// Build messages array
const messages: { role: 'system' | 'user'; content: string }[] = [];

if (agentType === 'code-review') {
  // Load system prompt from code-review-agent
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const systemPromptPath = join(__dirname, '..', '..', '..', 'code-review-agent', 'prompts', 'system.md');
  try {
    const systemPrompt = await readFile(systemPromptPath, 'utf-8');
    messages.push({ role: 'system', content: systemPrompt });
  } catch (e) {
    // If system prompt file is missing, fail fast - code-review mode requires it
    console.error('[Error] Failed to load code-review system prompt:', e);
    res.status(500).json({ error: 'Code review system prompt not found' });
    return;
  }
}

messages.push({ role: 'user', content: prompt });
```

- [ ] **Step 4: Update the agent.run() call to use messages array**

Change:
```typescript
const messages = [{ role: 'user' as const, content: prompt }];
```
To:
```typescript
// messages array already built above
```

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/agent.ts
git commit -m "feat: load code-review system prompt when agentType is code-review"
```

---

## Task 3: Update Frontend Store

**Files:**
- Modify: `web/src/store/index.ts`

- [ ] **Step 1: Add agentType to AgentStore interface**

Add to AgentStore interface:
```typescript
// Agent type
agentType: 'simple' | 'code-review';
setAgentType: (type: 'simple' | 'code-review') => void;
```

Add to store implementation:
```typescript
agentType: 'simple',
setAgentType: (type) => set({ agentType: type }),
```

- [ ] **Step 2: Commit**

```bash
git add web/src/store/index.ts
git commit -m "feat: add agentType state to store"
```

---

## Task 4: Update useAgent Hook

**Files:**
- Modify: `web/src/hooks/useAgent.ts`

- [ ] **Step 1: Update runAgent signature to accept agentType**

Change:
```typescript
const runAgent = useCallback(
  async (prompt: string, mode: 'loop' | 'step' = 'loop') => {
```

To:
```typescript
const runAgent = useCallback(
  async (prompt: string, mode: 'loop' | 'step' = 'loop', agentType: 'simple' | 'code-review' = 'simple') => {
```

- [ ] **Step 2: Update useStore destructuring**

```typescript
const { currentSessionId, addMessage, clearMessages, clearLogs, setIsRunning } = useStore();
```

No changes needed - we use the `agentType` parameter passed to the function.

- [ ] **Step 3: Use agentType parameter**

In the fetch body, change:
```typescript
body: JSON.stringify({
  sessionId: currentSessionId,
  prompt,
  mode,
}),
```

To:
```typescript
body: JSON.stringify({
  sessionId: currentSessionId,
  prompt,
  mode,
  agentType: agentType !== 'simple' ? agentType : undefined, // Only send if not 'simple'
}),
```

- [ ] **Step 4: Update dependency array**

Change:
```typescript
[currentSessionId, addMessage, clearMessages, clearLogs, setIsRunning]
```

To:
```typescript
[currentSessionId, agentType, addMessage, clearMessages, clearLogs, setIsRunning]
```

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useAgent.ts
git commit -m "feat: pass agentType to API in useAgent hook"
```

---

## Task 5: Update ChatPanel with Toggle Buttons

**Files:**
- Modify: `web/src/components/ChatPanel.tsx`

- [ ] **Step 1: Read current ChatPanel to understand structure**

Current structure:
- Header with `<h1>Simple Agent</h1>` and session info
- Messages list
- Input form at bottom

- [ ] **Step 2: Import useStore and add agentType state**

Change:
```typescript
const { messages, isRunning, currentSessionId } = useStore();
```

To:
```typescript
const { messages, isRunning, currentSessionId, agentType, setAgentType } = useStore();
```

- [ ] **Step 3: Replace header content**

Change:
```typescript
<div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
  <h1 className="text-lg font-semibold text-white">Simple Agent</h1>
  <p className="text-sm text-primary-100">
    {currentSessionId ? `会话: ${currentSessionId}` : '新会话'}
  </p>
</div>
```

To:
```typescript
<div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-lg font-semibold text-white">Simple Agent</h1>
      <p className="text-sm text-primary-100">
        {currentSessionId ? `会话: ${currentSessionId}` : '新会话'}
      </p>
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => setAgentType('simple')}
        className={`px-3 py-1 text-sm rounded ${
          agentType === 'simple'
            ? 'bg-white text-primary-600'
            : 'bg-primary-700 text-white hover:bg-primary-600'
        }`}
      >
        Simple
      </button>
      <button
        onClick={() => setAgentType('code-review')}
        className={`px-3 py-1 text-sm rounded ${
          agentType === 'code-review'
            ? 'bg-white text-primary-600'
            : 'bg-primary-700 text-white hover:bg-primary-600'
        }`}
      >
        Review
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Update runAgent call to pass agentType**

Change:
```typescript
await runAgent(prompt);
```

To:
```typescript
await runAgent(prompt, 'loop', agentType);
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ChatPanel.tsx
git commit -m "feat: add Simple/Review toggle buttons to ChatPanel"
```

---

## Task 6: Integration Test

**Files:**
- Requires: Server running on port 3001

- [ ] **Step 1: Start server**

```bash
cd /Users/liufukang/workplace/AI/project/simple-agent
bun run src/server/index.ts
```

- [ ] **Step 2: Start web dev server**

```bash
cd /Users/liufukang/workplace/AI/project/simple-agent/web
bun run dev
```

- [ ] **Step 3: Verify toggle buttons appear**

Open http://localhost:3000 and verify:
- "Simple" and "Review" buttons visible in ChatPanel header
- Clicking "Review" highlights it
- Clicking "Simple" highlights it

- [ ] **Step 4: Test code-review produces different output than simple**

1. With "Simple" selected, enter a simple prompt (e.g., "hello") and note the output style
2. With "Review" selected, enter the same prompt and note the output
3. Verify the outputs are different - code-review mode should produce review-style content
4. Verify server console shows "[Agent] Starting" with different context

**Expected difference:** Simple mode outputs a direct response. Code-review mode outputs structured review content (headers, bullet points, etc.) per its system prompt instructions.

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Backend types | `src/server/types.ts` |
| 2 | Backend route | `src/server/routes/agent.ts` |
| 3 | Frontend store | `web/src/store/index.ts` |
| 4 | useAgent hook | `web/src/hooks/useAgent.ts` |
| 5 | ChatPanel UI | `web/src/components/ChatPanel.tsx` |
| 6 | Integration test | Manual verification |
