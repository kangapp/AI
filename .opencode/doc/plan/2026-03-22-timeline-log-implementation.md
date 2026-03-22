# Timeline Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 request/response 格式改为时间线事件格式，用 turn_start、text、reasoning、tool_call、tool_result、turn_complete 描述与 LLM 的交互过程

**Architecture:** 用统一的事件写入函数 `writeEvent` 替代 `writeRequestToFile` 和 `appendResponseToFile`，每个事件类型实时追加到 jsonl 文件

**Tech Stack:** TypeScript, @opencode-ai/plugin

---

## Task 1: 重构写入函数

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 查看当前代码结构**

当前代码有 `writeRequestToFile` 和 `appendResponseToFile` 两个函数，需要替换为统一的 `writeEvent` 函数。

**Step 2: 删除旧的写入函数**

删除 `writeRequestToFile` 和 `appendResponseToFile` 函数（约 line 60-106）。

**Step 3: 添加统一的 writeEvent 函数**

在 `getLogPath` 函数后添加：

```typescript
// 写入事件到文件
function writeEvent(state: TurnState, event: Record<string, any>): void {
  const timestamp = new Date().toISOString()
  state.filePath = getLogPath(state.sessionID, state.shortUUID)

  const eventRecord = {
    timestamp,
    ...event,
  }

  appendFileSync(state.filePath, JSON.stringify(eventRecord) + "\n")
  debug(`writeEvent: type=${event.type} to ${state.filePath}`)
}
```

**Step 4: 删除 TurnState 中的 requestWritten 和 responseWritten 字段**

TurnState 不再需要这些 flag，因为我们现在实时追加事件。

修改 TurnState 接口（line 17-46）：

```typescript
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  filePath: string
  // 移除 requestWritten 和 responseWritten
  request: {
    messages: any[]
    system: string[]
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]
    reasoning: string[]
    toolCalls: {
      id: string
      tool: string
      args: any
      callID: string
    }[]
    tools: {
      tool: string
      args: any
      output: string
      title: string
    }[]
  }
}
```

**Step 5: 提交**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "refactor: replace writeRequestToFile/appendResponseToFile with unified writeEvent

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 实现 turn_start 事件

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 修改 chat.system.transform**

将 `chat.system.transform` (line 111-127) 改为写入 `turn_start` 事件：

```typescript
"experimental.chat.system.transform": async (input, output) => {
  const sessionID = input.sessionID
  if (!sessionID) return
  const shortUUID = activeShortUUIDs.get(sessionID)
  if (!shortUUID) return
  const turnKey = `${sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  state.request.system = output.system

  // 写入 turn_start 事件
  writeEvent(state, {
    type: "turn_start",
    sessionID: state.sessionID,
    shortUUID: state.shortUUID,
    turn: state.turn,
    model: state.request.model,
    agent: state.request.agent,
    system: state.request.system,
    messages: state.request.messages,
  })
},
```

**Step 2: 移除 chat.messages.transform 中的 requestWritten 检查**

因为不再使用 requestWritten，移除 `writeRequestToFile` 调用后的逻辑保持不变。

**Step 3: 提交**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: write turn_start event in chat.system.transform

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 实现 text 和 reasoning 事件

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 修改 text.complete hook**

将 `text.complete` hook (line 240-248) 改为写入 `text` 事件：

```typescript
"experimental.text.complete": async (input, output) => {
  const shortUUID = activeShortUUIDs.get(input.sessionID)
  if (!shortUUID) return
  const turnKey = `${input.sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  // 写入 text 事件
  writeEvent(state, {
    type: "text",
    content: output.text,
  })

  state.response.texts.push(output.text)
},
```

**Step 2: 在 chat.messages.transform 中提取 reasoning**

在 `chat.messages.transform` 中，当检测到 assistant 消息时，提取 reasoning 内容并写入 `reasoning` 事件。

找到 assistant 消息处理部分（line 229-236），改为：

```typescript
// assistant 消息：提取 reasoning 并更新 messages
if (lastMsg?.info?.role === "assistant") {
  // 提取 reasoning 内容
  for (const part of lastMsg.parts) {
    if (part.type === "reasoning") {
      const reasoningContent = part.text || ""
      if (reasoningContent) {
        // 写入 reasoning 事件
        writeEvent(state, {
          type: "reasoning",
          content: reasoningContent,
        })
        state.response.reasoning.push(reasoningContent)
      }
    }
  }

  state.request.messages = [{
    role: "assistant",
    content: lastMsg.parts,
  }]
  debug(`chat.messages.transform: updated assistant message`)
}
```

**Step 3: 提交**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: write text and reasoning events

- text.complete writes text event
- assistant messages extract reasoning parts and write reasoning events

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 实现 tool_call 和 tool_result 事件

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 修改 tool.execute.before hook**

将 `tool.execute.before` hook (line 251-265) 改为写入 `tool_call` 事件：

```typescript
"tool.execute.before": async (input, output) => {
  const shortUUID = activeShortUUIDs.get(input.sessionID)
  if (!shortUUID) return
  const turnKey = `${input.sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  // 写入 tool_call 事件
  writeEvent(state, {
    type: "tool_call",
    id: input.callId,
    tool: input.tool,
    args: input.args,
  })

  state.response.toolCalls.push({
    id: input.callId,
    tool: input.tool,
    args: input.args,
    callID: input.callId,
  })
},
```

**Step 2: 修改 tool.execute.after hook**

将 `tool.execute.after` hook (line 268-281) 改为写入 `tool_result` 事件：

```typescript
"tool.execute.after": async (input, output) => {
  const shortUUID = activeShortUUIDs.get(input.sessionID)
  if (!shortUUID) return
  const turnKey = `${input.sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  // 写入 tool_result 事件
  writeEvent(state, {
    type: "tool_result",
    tool: input.tool,
    args: input.args,
    output: output.output,
    title: output.title,
  })

  state.response.tools.push({
    tool: input.tool,
    args: input.args,
    output: output.output,
    title: output.title,
  })
},
```

**Step 3: 提交**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: write tool_call and tool_result events

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 实现 turn_complete 事件

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 修改 step-finish 处理**

将 `event` hook 中的 `step-finish` 处理 (line 288-311) 改为写入 `turn_complete` 事件：

```typescript
if (part?.type === "step-finish") {
  const sessionID = part.sessionID
  const reason = part.reason
  debug(`step-finish: reason=${reason}`)
  const shortUUID = activeShortUUIDs.get(sessionID)
  if (!shortUUID) return
  const turnKey = `${sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  // Turn 结束条件
  const isTurnEnd = reason === "stop" ||
                    reason === "length" ||
                    reason === "content-filter" ||
                    reason === null

  if (isTurnEnd) {
    debug(`step-finish: reason=${reason}, writing turn_complete`)
    // 写入 turn_complete 事件
    writeEvent(state, {
      type: "turn_complete",
      reason,
      texts: state.response.texts,
      fullText: state.response.texts.join(""),
      reasoning: state.response.reasoning,
      toolCalls: state.response.toolCalls,
      tools: state.response.tools,
    })
  } else {
    debug(`step-finish: reason=${reason}, not ending turn`)
  }
}
```

**Step 2: 修改 session.deleted 处理**

在 `session.deleted` 处理 (line 314-334) 中，同样写入 `turn_complete` 事件：

```typescript
if (event.type === "session.deleted") {
  const sessionID = event.data?.info?.id
  if (!sessionID) return

  const shortUUID = activeShortUUIDs.get(sessionID)
  if (shortUUID) {
    const turnKey = `${sessionID}_${shortUUID}`
    const state = turns.get(turnKey)
    if (state && state.request) {
      // 写入 turn_complete 事件
      writeEvent(state, {
        type: "turn_complete",
        reason: "session_deleted",
        texts: state.response.texts,
        fullText: state.response.texts.join(""),
        reasoning: state.response.reasoning,
        toolCalls: state.response.toolCalls,
        tools: state.response.tools,
      })
    }
    turns.delete(turnKey)
  }

  activeShortUUIDs.delete(sessionID)
}
```

**Step 3: 提交**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: write turn_complete event on step-finish or session-deleted

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 清理旧逻辑并测试

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 清理 chat.messages.transform 中的旧逻辑**

移除不再需要的：
- `responseWritten` 检查
- `requestWritten` 检查
- 旧的 `appendResponseToFile` 调用

**Step 2: 清除旧日志并测试**

```bash
rm -f .opencode/logs/*.jsonl .opencode/debug.log
```

发送 3 条用户消息测试：
1. 验证生成 3 个独立文件
2. 验证每个文件包含 `turn_start` 事件
3. 验证包含 `text`、`reasoning`、`tool_call`、`tool_result` 事件
4. 验证包含 `turn_complete` 事件
5. 验证事件按时间顺序追加

**Step 3: 提交**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "fix: cleanup legacy logic and test timeline logging

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `.opencode/plugin/log-conversation.ts` | 完全重写 |

---

## 验证清单

- [ ] 发送 3 条用户消息
- [ ] 验证生成 3 个独立 jsonl 文件
- [ ] 验证每个文件包含 `turn_start` 事件
- [ ] 验证包含 `text` 事件
- [ ] 验证包含 `reasoning` 事件（如果有）
- [ ] 验证包含 `tool_call` 和 `tool_result` 事件（如果有）
- [ ] 验证包含 `turn_complete` 事件
- [ ] 验证事件按时间顺序追加
