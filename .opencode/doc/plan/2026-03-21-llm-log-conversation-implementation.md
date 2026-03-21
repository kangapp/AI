# LLM Log Conversation Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个 opencode plugin，通过 hooks 捕获每个 Turn 的完整 LLM 输入输出，写入 jsonl 文件用于学习 agent 和 LLM 交互流程。

**Architecture:** 利用 opencode 的 plugin hook 系统，在 `experimental.chat.messages.transform` 收集输入，在 `experimental.text.complete` 和 `tool.execute.after` 收集输出，在 `event` hook 中监听 `message.part.updated` 事件，当 `part.type === "step-finish"` 时立即写入 jsonl。

**Tech Stack:** TypeScript, opencode plugin system, Node.js fs module

---

## Task 1: 创建目录结构

**Files:**
- Create: `.opencode/plugin/` (directory)
- Create: `.opencode/logs/` (directory)
- Create: `.opencode/opencode.json`

**Step 1: 创建目录结构**

```bash
mkdir -p .opencode/plugin .opencode/logs
```

**Step 2: 创建 opencode.json 配置文件**

```json
{
  "plugin": ["file:///absolute/path/to/.opencode/plugin/log-conversation.ts"]
}
```

注意：plugin 路径需要使用绝对路径

**Step 3: Commit**

```bash
git add .opencode/ && git commit -m "feat: add log-conversation plugin structure"
```

---

## Task 2: 创建 log-conversation.ts 基础框架

**Files:**
- Create: `.opencode/plugin/log-conversation.ts`

**Step 1: 创建基础 plugin 框架**

```typescript
import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

// State management for current turn
interface TurnState {
  turn: number
  sessionID: string
  request: {
    messages: any[]
    system: string[]
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]
    tools: { tool: string; args: any; output: string; title: string }[]
  }
}

const turns = new Map<string, TurnState>()

function getLogPath(sessionID: string): string {
  const logDir = join(process.cwd(), ".opencode", "logs")
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  return join(logDir, `${sessionID}.jsonl`)
}

export default (input: PluginInput): Promise<Hooks> => {
  return Promise.resolve({
    "experimental.chat.messages.transform": async (_, output) => {
      // TODO: collect request data
    },

    "experimental.text.complete": async (input, output) => {
      // TODO: collect text output
    },

    "tool.execute.after": async (input, output) => {
      // TODO: collect tool calls
    },

    "event": async (input) => {
      // TODO: detect step-finish and write jsonl
    },
  })
}
```

**Step 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: create log-conversation.ts skeleton"
```

---

## Task 3: 实现 experimental.chat.messages.transform 收集输入

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 更新 chat.messages.transform hook**

```typescript
"experimental.chat.messages.transform": async (_, output) => {
  // Get sessionID from the first message's sessionID
  const sessionID = output.messages[0]?.info.sessionID
  if (!sessionID) return

  // Get or create turn state
  let state = turns.get(sessionID)
  if (!state) {
    state = {
      turn: 0,
      sessionID,
      request: null,
      response: { texts: [], tools: [] },
    }
    turns.set(sessionID, state)
  }

  // Increment turn counter
  state.turn++

  // Extract messages for LLM
  const messages = output.messages.map((m: any) => ({
    role: m.info.role,
    content: m.parts,
  }))

  // Get system prompt from messages (first system message if any)
  const systemMessages = output.messages.filter((m: any) => m.info.role === "system")
  const system = systemMessages.map((m: any) =>
    m.parts.map((p: any) => p.text || "").join("")
  )

  // Get agent and model from message metadata
  const lastMessage = output.messages[output.messages.length - 1]
  const agent = lastMessage?.info.agent || "unknown"
  const model = lastMessage?.info.model || { providerID: "unknown", modelID: "unknown" }

  state.request = {
    messages,
    system,
    agent,
    model,
  }

  // Reset response collector for new turn
  state.response = { texts: [], tools: [] }
},
```

**Step 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: implement chat.messages.transform to collect request data"
```

---

## Task 4: 实现 experimental.text.complete 收集文本输出

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 更新 experimental.text.complete hook**

```typescript
"experimental.text.complete": async (input, output) => {
  const state = turns.get(input.sessionID)
  if (!state) return

  state.response.texts.push(output.text)
},
```

**Step 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: implement text.complete to collect output text"
```

---

## Task 5: 实现 tool.execute.after 收集工具调用

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 更新 tool.execute.after hook**

```typescript
"tool.execute.after": async (input, output) => {
  const state = turns.get(input.sessionID)
  if (!state) return

  state.response.tools.push({
    tool: input.tool,
    args: input.args,
    output: output.output,
    title: output.title,
  })
},
```

**Step 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: implement tool.execute.after to collect tool calls"
```

---

## Task 6: 实现 event hook 检测 step-finish 并写入 jsonl

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 实现 event hook**

```typescript
"event": async (input) => {
  const event = input.event as any

  // 监听 message.part.updated 事件，当收到 step-finish 时写入 jsonl
  if (event.type === "message.part.updated") {
    const part = event.properties?.part
    if (part?.type === "step-finish") {
      const sessionID = part.sessionID
      const state = turns.get(sessionID)

      if (!state || !state.request) return

      // Get current timestamp
      const timestamp = new Date().toISOString()

      // Write request record
      const requestRecord = {
        type: "request",
        turn: state.turn,
        sessionID: state.sessionID,
        timestamp,
        model: state.request.model,
        agent: state.request.agent,
        system: state.request.system,
        messages: state.request.messages,
      }

      // Write response record
      const responseRecord = {
        type: "response",
        turn: state.turn,
        sessionID: state.sessionID,
        timestamp,
        texts: state.response.texts,
        fullText: state.response.texts.join(""),
        tools: state.response.tools,
        finishReason: part.reason,
        usage: {
          tokens: part.tokens,
          cost: part.cost,
        },
      }

      const logPath = getLogPath(sessionID)
      appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
      appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")
    }
  }
},
```

**Step 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: implement event hook to write jsonl on step-finish"
```

---

## Task 7: 处理 session 结束时写入最后一批数据

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 扩展 event hook 处理 session 结束**

当 session 结束时，如果还有未写入的数据（可能最后的 Turn 没有 step-finish），需要写入。

```typescript
// 在 event hook 中添加
if (event.type === "session.deleted") {
  const sessionID = event.data?.info?.id
  if (!sessionID) return

  const state = turns.get(sessionID)
  if (!state || !state.request) return

  // Write remaining turn data if any
  const timestamp = new Date().toISOString()
  const logPath = getLogPath(sessionID)

  const requestRecord = {
    type: "request",
    turn: state.turn,
    sessionID: state.sessionID,
    timestamp,
    model: state.request.model,
    agent: state.request.agent,
    system: state.request.system,
    messages: state.request.messages,
  }

  const responseRecord = {
    type: "response",
    turn: state.turn,
    sessionID: state.sessionID,
    timestamp,
    texts: state.response.texts,
    fullText: state.response.texts.join(""),
    tools: state.response.tools,
  }

  appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
  appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")

  // Clean up state
  turns.delete(sessionID)
}
```

**Step 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: handle session end to write final turn data"
```

---

## Task 8: 验证实现

**Files:**
- Test: 运行 opencode 进行一次对话

**Step 1: 运行 opencode 测试**

```bash
cd /Users/liufukang/workplace/AI
opencode
```

**Step 2: 检查输出文件**

```bash
ls -la .opencode/logs/
cat .opencode/logs/*.jsonl
```

**Step 3: 验证 jsonl 格式**

每条记录应该是完整的 JSON，包含：
- `type`: "request" 或 "response"
- `turn`: 轮次编号
- `sessionID`: 会话 ID
- `timestamp`: ISO 时间戳
- 对于 request: `messages`, `system`, `agent`, `model`
- 对于 response: `texts`, `fullText`, `tools`, `finishReason`, `usage`

---

## Task 9: 添加 .gitignore

**Files:**
- Create: `.opencode/.gitignore`

**Step 1: 创建 .gitignore**

```
logs/
```

**Step 2: Commit**

```bash
git add .opencode/.gitignore && git commit -m "chore: add logs to gitignore"
```
