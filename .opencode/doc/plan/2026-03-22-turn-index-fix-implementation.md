# Turn Index and Tool Merge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 turn 索引递增问题，合并 tool_call + tool_result 为 tool_call_result

**Architecture:** 修改 chat.messages.transform 中的 user 消息处理逻辑，以及 tool.execute hooks 的配对逻辑

**Tech Stack:** TypeScript, @opencode-ai/plugin SDK

---

## 准备工作

**读取现有实现：**
- `.opencode/plugin/log-conversation.ts` - 当前实现

---

## Task 1: 修复 Turn 索引递增

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

### 问题分析

当前逻辑（有问题）：
```typescript
if (isUserMessage && state) {
  // 写入前一个 turn complete
  writeEvent(state, { type: "turn_complete", ... })
  turns.delete(turnKey)  // 删除 state
  activeShortUUIDs.delete(sessionID)  // 删除 shortUUID
  state = null
}

if (isUserMessage) {
  // 创建新 state
  state = { turn: 1, ... }  // 永远从 1 开始
}
```

### 修复逻辑

当收到 user 消息且有 state 时：
1. 写入前一个 turn 的 turn_complete
2. **递增 turn += 1**
3. **不删除 state 和 shortUUID**
4. 更新 messages 继续使用同一文件

```typescript
if (isUserMessage && state) {
  // 写入前一个 turn complete
  writeEvent(state, {
    type: "turn_complete",
    reason: "user_message",
    texts: state.response.texts,
    fullText: state.response.texts.join(""),
    reasoning: state.response.reasoning,
    toolCalls: state.response.toolCalls,
    tools: state.response.tools,
  })

  // 递增 turn（不创建新文件，不删除 state）
  state.turn += 1

  // 重置 response
  state.response = { texts: [], reasoning: [], toolCalls: [], tools: [] }

  // 更新 messages 为当前 user 消息
  state.request.messages = [{
    role: "user",
    content: lastMsg.parts,
  }]

  // 不返回，继续执行（会触发后续 hooks）
  // 注意：不要 return，让 chat.system.transform 触发
}
```

### 关键点

1. **不删除 state** - 继续使用同一个 state
2. **不删除 shortUUID** - 同一 shortUUID 的多个 turn 写入同一文件
3. **递增 turn** - state.turn += 1
4. **重置 response** - 每个 turn 的 response 要清空

**步骤 1: 修改 chat.messages.transform 中的 user 消息处理**

找到约 line 138-153 的代码，修改逻辑。

**步骤 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: increment turn index on user message instead of creating new file"
```

---

## Task 2: 合并 tool_call 和 tool_result

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

### 问题分析

当前逻辑：
- `tool.execute.before`: 立即写入 `tool_call` 事件
- `tool.execute.after`: 立即写入 `tool_result` 事件

问题：两个事件分开，无法配对。

### 修复逻辑

- `tool.execute.before`: 只暂存到 `pendingToolCalls`，不写事件
- `tool.execute.after`: 找到对应的 pending，合并写入 `tool_call_result`

```typescript
// tool.execute.before
state.response.toolCalls.push({
  id: input.callId,
  tool: input.tool,
  args: input.args,
  // output 和 title 暂时为 null
  output: null,
  title: null,
})

// tool.execute.after
// 找到对应的 toolCall
const toolCall = state.response.toolCalls.find(tc => tc.id === input.callId)
if (toolCall) {
  // 更新 output 和 title
  toolCall.output = output.output
  toolCall.title = output.title

  // 合并写入 tool_call_result
  writeEvent(state, {
    type: "tool_call_result",
    id: toolCall.id,
    tool: toolCall.tool,
    args: toolCall.args,
    output: output.output,
    title: output.title,
  })
}
```

### 关键点

1. **不立即写入** - tool.execute.before 只暂存
2. **配对写入** - tool.execute.after 时通过 callId 找到对应的 call
3. **统一事件** - type 为 `tool_call_result`

**步骤 1: 修改 tool.execute.before（删除 writeEvent）**

约 line 278-301，删除 writeEvent 部分。

**步骤 2: 修改 tool.execute.after（添加合并逻辑）**

约 line 303-326，添加查找和合并写入逻辑。

**步骤 3: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: merge tool_call and tool_result into tool_call_result"
```

---

## Task 3: 更新 turn_complete 中的 toolCalls

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

### 说明

turn_complete 中的 `toolCalls` 数组现在应该包含完整的 output 和 title（因为已合并）。

检查并确保 turn_complete 事件写入时 toolCalls 包含完整信息。

**步骤 1: 检查 turn_complete 写入**

约 line 420-440，确认 `toolCalls: state.response.toolCalls` 包含完整字段。

**步骤 2: Commit（如需要）**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "chore: verify turn_complete toolCalls structure"
```

---

## 实现顺序

1. Task 1: Turn 索引递增
2. Task 2: 合并 tool_call_result
3. Task 3: 检查 turn_complete

---

## 注意事项

1. **Turn 索引从 1 开始**：首次 user 消息 turn=1，后续每次 user 消息 turn += 1
2. **tool.execute.before 不写事件**：只暂存到 state.response.toolCalls
3. **tool.execute.after 配对写入**：通过 callId 找到对应的 call，合并后写入
4. **保持向后兼容**：TurnState 中的 toolCalls 数组结构不变，只是多了 output 和 title
