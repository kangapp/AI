# LLM Log Conversation Plugin - 改进实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 改进 log-conversation plugin，捕获完整的 system prompt、tool calls 和 reasoning 数据。

**Architecture:** 使用 `experimental.chat.system.transform` 捕获 system prompt，从 `chat.messages.transform` 的 msgs 中提取 ToolPart 和 ReasoningPart。

**Tech Stack:** TypeScript, opencode plugin system, Node.js fs module

---

## Task 1: 更新 TurnState 数据结构

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 更新 TurnState 接口**

将 `request` 和 `response` 类型更新为支持更多字段：

```typescript
interface TurnState {
  turn: number
  sessionID: string
  request: {
    messages: any[]           // 完整的消息
    system: string[]          // system prompt（从 system.transform 获取）
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]           // 文本输出片段
    reasoning: string[]      // 思考过程（从 messages 提取）
    toolCalls: {              // 工具调用（从 messages 提取）
      id: string
      tool: string
      args: any
      callID: string
    }[]
    tools: {                  // 工具执行结果
      tool: string
      args: any
      output: string
      title: string
    }[]
  }
}
```

**Step 2: 提交**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: update TurnState with reasoning and toolCalls"
```

---

## Task 2: 添加 experimental.chat.system.transform hook

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 添加 system.transform hook**

在 `export default` 返回的 Hooks 中添加：

```typescript
"experimental.chat.system.transform": async (input, output) => {
  const sessionID = input.sessionID
  const state = turns.get(sessionID)
  if (!state) return

  state.request.system = output.system
},
```

**Step 2: 提交**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: add chat.system.transform to capture system prompt"
```

---

## Task 3: 改进 chat.messages.transform 提取 tool 和 reasoning

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 改进 chat.messages.transform hook**

替换当前的实现，添加 toolCalls 和 reasoning 提取：

```typescript
"experimental.chat.messages.transform": async (_, output) => {
  const sessionID = output.messages[0]?.info.sessionID
  if (!sessionID) return

  let state = turns.get(sessionID)
  if (!state) {
    state = {
      turn: 0,
      sessionID,
      request: null,
      response: { texts: [], reasoning: [], toolCalls: [], tools: [] },
    }
    turns.set(sessionID, state)
  }

  state.turn++

  // 提取消息，保留完整 parts
  const messages = output.messages.map((m: any) => ({
    role: m.info.role,
    content: m.parts,
  }))

  // 从 assistant 消息中提取 tool calls 和 reasoning
  const assistantMessages = output.messages.filter((m: any) => m.info.role === "assistant")
  const toolCalls: any[] = []
  const reasoning: string[] = []

  for (const msg of assistantMessages) {
    for (const part of msg.parts) {
      if (part.type === "tool") {
        toolCalls.push({
          id: part.id,
          tool: part.tool,
          args: part.state.input,
          callID: part.callID,
        })
      }
      if (part.type === "reasoning") {
        reasoning.push(part.text)
      }
    }
  }

  // 获取 system prompt 和 agent、model
  const systemMessages = output.messages.filter((m: any) => m.info.role === "system")
  const system = systemMessages.map((m: any) =>
    m.parts.map((p: any) => p.text || "").join("")
  )

  const lastMessage = output.messages[output.messages.length - 1]
  const agent = lastMessage?.info.agent || "unknown"
  const model = lastMessage?.info.model || { providerID: "unknown", modelID: "unknown" }

  state.request = {
    messages,
    system,
    agent,
    model,
  }

  // 重置 response 收集器，同时保存从 messages 提取的数据
  state.response = {
    texts: [],
    reasoning,
    toolCalls,
    tools: [],
  }
},
```

**Step 2: 提交**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: extract toolCalls and reasoning from messages"
```

---

## Task 4: 更新 event hook 写入完整 response

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts`

**Step 1: 更新 step-finish 写入逻辑**

更新 responseRecord 以包含 reasoning 和 toolCalls：

```typescript
const responseRecord = {
  type: "response",
  turn: state.turn,
  sessionID: state.sessionID,
  timestamp,
  texts: state.response.texts,
  fullText: state.response.texts.join(""),
  reasoning: state.response.reasoning,
  toolCalls: state.response.toolCalls,
  tools: state.response.tools,
  finishReason: part.reason,
  usage: {
    tokens: part.tokens,
    cost: part.cost,
  },
}
```

同样更新 session.deleted 中的 responseRecord。

**Step 2: 提交**

```bash
git add .opencode/plugin/log-conversation.ts && git commit -m "feat: include reasoning and toolCalls in response record"
```

---

## Task 5: 验证完整数据

**Files:**
- Test: 运行 opencode 进行一次对话

**Step 1: 清空旧日志**

```bash
rm -f .opencode/logs/*.jsonl
```

**Step 2: 运行 opencode 测试**

```bash
cd /Users/liufukang/workplace/AI
opencode
```

**Step 3: 检查输出**

```bash
cat .opencode/logs/*.jsonl
```

**验证点**：
- `system` 字段不为空
- `messages` 中包含完整的 parts
- `reasoning` 字段包含思考过程（如有）
- `toolCalls` 字段包含工具调用信息（如有）
