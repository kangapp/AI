# Timeline Log V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Timeline Log V2，添加 7 种新事件类型（llm_params, permission_request, step_start, agent_switch, retry, file_reference, subtask_start）

**Architecture:** 在现有 log-conversation.ts 插件基础上添加新 hooks 和事件处理，不改变核心文件写入逻辑

**Tech Stack:** TypeScript, @opencode-ai/plugin SDK

---

## 准备工作

**读取现有实现：**
- `.opencode/plugin/log-conversation.ts` - 当前实现
- `.opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts` - Hooks 类型定义

---

## Task 1: 更新 TurnState 数据结构

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts:17-44`

**步骤 1: 更新 TurnState interface**

在 `TurnState` 接口中添加 `parentShortUUID` 字段：

```typescript
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string | null  // 新增：父任务 shortUUID，子任务时使用
  filePath: string
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

**步骤 2: 更新 state 创建逻辑（两处）**

1. 主任务创建（约 line 182）：
```typescript
state = {
  turn: 1,
  sessionID,
  shortUUID,
  parentShortUUID: null,  // 主任务为 null
  filePath: "",
  request: { ... },
  response: { texts: [], reasoning: [], toolCalls: [], tools: [] },
}
```

2. session.deleted 中的 fallback 创建（约 line 350）：
```typescript
state = {
  turn: state.turn,
  sessionID: state.sessionID,
  shortUUID: state.shortUUID,
  parentShortUUID: state.parentShortUUID,  // 保持不变
  ...
}
```

**步骤 3: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: add parentShortUUID to TurnState"
```

---

## Task 2: 添加 `chat.params` hook 写入 llm_params 事件

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

**步骤 1: 在 hooks 对象中添加 chat.params hook**

在 `export default` 函数返回的 hooks 对象中，添加：

```typescript
"chat.params": async (input, output) => {
  const sessionID = input.sessionID
  if (!sessionID) return
  const shortUUID = activeShortUUIDs.get(sessionID)
  if (!shortUUID) return
  const turnKey = `${sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  writeEvent(state, {
    type: "llm_params",
    temperature: output.temperature,
    topP: output.topP,
    topK: output.topK,
    options: output.options,
  })
},
```

**步骤 2: 测试验证**

运行 opencode 并发送消息，检查 `.opencode/logs/` 中的 jsonl 文件是否包含 `llm_params` 事件。

**步骤 3: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: add chat.params hook for llm_params event"
```

---

## Task 3: 添加 `permission.ask` hook 写入 permission_request 事件

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

**步骤 1: 在 hooks 对象中添加 permission.ask hook**

```typescript
"permission.ask": async (input, output) => {
  const sessionID = input.session?.sessionID
  if (!sessionID) return
  const shortUUID = activeShortUUIDs.get(sessionID)
  if (!shortUUID) return
  const turnKey = `${sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  writeEvent(state, {
    type: "permission_request",
    permissionType: input.type,
    pattern: input.pattern,
    title: input.title,
    status: output.status,
  })
},
```

**注意：** 需要确认 `input` 中是否有 `sessionID` 字段。从 SDK 类型看：
```typescript
"permission.ask"?: (input: Permission, output: {
    status: "ask" | "deny" | "allow";
}) => Promise<void>;
```

`Permission` 类型包含 `sessionID`：
```typescript
export type Permission = {
    id: string;
    type: string;
    pattern?: string | Array<string>;
    sessionID: string;  // <-- 在这里
    messageID: string;
    callID?: string;
    title: string;
    metadata: { ... };
    time: { ... };
};
```

所以应该使用 `input.sessionID`。

**步骤 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: add permission.ask hook for permission_request event"
```

---

## Task 4: 在 event hook 中处理新的 Part 类型

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

**步骤 1: 在 event hook 中添加 step-start, agent, retry, file part 处理**

在 `if (event.type === "message.part.updated")` 块中，添加对 `step-start`, `agent`, `retry`, `file`, `subtask` part 的处理。

当前代码（约 line 305-339）只处理 `step-finish`：

```typescript
if (event.type === "message.part.updated") {
  const part = event.properties?.part
  if (part?.type === "step-finish") {
    // ... existing code
  }
  return
}
```

需要修改为：

```typescript
if (event.type === "message.part.updated") {
  const part = event.properties?.part
  if (!part) return

  const sessionID = part.sessionID
  const shortUUID = activeShortUUIDs.get(sessionID)
  if (!shortUUID) {
    // 可能是子任务，尝试处理
    // 见 Task 6
    return
  }
  const turnKey = `${sessionID}_${shortUUID}`
  const state = turns.get(turnKey)
  if (!state) return

  switch (part.type) {
    case "step-start":
      writeEvent(state, {
        type: "step_start",
        stepId: part.id,
      })
      break

    case "agent":
      writeEvent(state, {
        type: "agent_switch",
        agent: part.name,
        source: part.source,
      })
      break

    case "retry":
      writeEvent(state, {
        type: "retry",
        attempt: part.attempt,
        error: part.error?.message || String(part.error),
      })
      break

    case "file":
      writeEvent(state, {
        type: "file_reference",
        mime: part.mime,
        filename: part.filename,
        url: part.url,
      })
      break

    case "subtask":
      // 处理子任务，见 Task 6
      break

    case "step-finish":
      // ... existing code 移动到这里
      break
  }
  return
}
```

**步骤 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: handle step-start, agent, retry, file parts in event hook"
```

---

## Task 5: 更新 turn_start 事件包含 parentShortUUID

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

**步骤 1: 更新 turn_start 事件写入**

在 `chat.system.transform` hook 中（约 line 96-104）更新 turn_start：

```typescript
writeEvent(state, {
  type: "turn_start",
  turn: state.turn,
  sessionID: state.sessionID,
  shortUUID: state.shortUUID,
  parentShortUUID: state.parentShortUUID,  // 新增
  model: state.request.model,
  agent: state.request.agent,
  system: state.request.system,
  messages: state.request.messages,
})
```

同样更新 `session.deleted` 中的 turn_start 写入。

**步骤 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: include parentShortUUID in turn_start event"
```

---

## Task 6: 实现子任务独立文件追踪

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

**概述：** 当检测到 `subtask` part 时，创建独立的 TurnState 和文件，与父任务完全分离。

**步骤 1: 添加子任务状态映射**

在全局变量区域添加：

```typescript
// 追踪子任务的 sessionID -> parentShortUUID 映射
const subtaskParentMap = new Map<string, string>()
```

**步骤 2: 在 event hook 的 subtask case 中创建独立追踪**

```typescript
case "subtask":
  // 子任务有独立的 sessionID
  const subtaskSessionID = sessionID  // part.sessionID
  const subtaskShortUUID = crypto.randomUUID().substring(0, 12)
  const parentShortUUID = shortUUID  // 当前 shortUUID 是父任务的

  // 映射子任务 sessionID 到父任务 shortUUID
  subtaskParentMap.set(subtaskSessionID, parentShortUUID)

  // 为子任务创建独立的 TurnState
  const subtaskState: TurnState = {
    turn: 1,
    sessionID: subtaskSessionID,
    shortUUID: subtaskShortUUID,
    parentShortUUID: parentShortUUID,
    filePath: "",
    request: {
      messages: [{
        role: "user",
        content: [{ type: "text", text: part.prompt }],
      }],
      system: [],
      agent: part.agent || "unknown",
      model: part.model || { providerID: "unknown", modelID: "unknown" },
    },
    response: { texts: [], reasoning: [], toolCalls: [], tools: [] },
  }

  // 设置子任务为活跃状态
  activeShortUUIDs.set(subtaskSessionID, subtaskShortUUID)
  turns.set(`${subtaskSessionID}_${subtaskShortUUID}`, subtaskState)

  // 写入 subtask_start 事件
  writeEvent(subtaskState, {
    type: "subtask_start",
    sessionID: subtaskSessionID,
    shortUUID: subtaskShortUUID,
    parentShortUUID: parentShortUUID,
    prompt: part.prompt,
    description: part.description,
    agent: part.agent,
    model: part.model,
    command: part.command,
  })
  break
```

**步骤 3: 更新 session.deleted 处理子任务**

```typescript
if (event.type === "session.deleted") {
  const sessionID = event.data?.info?.id
  if (!sessionID) return

  // 清理子任务映射
  subtaskParentMap.delete(sessionID)

  // ... existing code
}
```

**步骤 4: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "feat: implement independent subtask tracking with parentShortUUID"
```

---

## Task 7: 更新 turn_complete 事件结构

**文件:**
- Modify: `.opencode/plugin/log-conversation.ts`

**概述：** 确保 turn_complete 包含完整的字段，包括新增的 reason 字段。

当前 turn_complete 已经包含：
- reason
- texts, fullText
- reasoning
- toolCalls, tools

验证这些字段是否完整，如有需要补充。

**步骤 1: 检查并更新**

```typescript
writeEvent(state, {
  type: "turn_complete",
  reason: reason,
  texts: state.response.texts,
  fullText: state.response.texts.join(""),
  reasoning: state.response.reasoning,
  toolCalls: state.response.toolCalls,
  tools: state.response.tools,
})
```

确保 `reason` 字段正确传递。

**步骤 2: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "chore: verify turn_complete event structure"
```

---

## Task 8: 验证测试

**概述：** 发送多种类型的消息，验证所有 13 种事件类型都被正确记录。

**测试场景：**

| 测试 | 预期事件 |
|------|----------|
| 基本对话 | turn_start, llm_params, step_start, text, turn_complete |
| 包含 reasoning | + reasoning |
| 调用工具 | + tool_call, tool_result |
| 权限请求 | + permission_request |
| 重试场景 | + retry |
| 文件场景 | + file_reference |
| Agent 切换 | + agent_switch |
| 子任务 | + subtask_start（在独立文件中） |

**步骤 1: 运行 opencode 并执行测试**

```bash
cd /Users/liufukang/workplace/AI/.opencode
# 启动 opencode 并进行测试对话
```

**步骤 2: 检查日志文件**

```bash
ls -la .opencode/logs/
cat .opencode/logs/ses_*.jsonl | jq .type | sort | uniq -c
```

**步骤 3: 验证所有事件类型**

预期事件类型：
- turn_start
- llm_params
- permission_request
- step_start
- text
- reasoning
- tool_call
- tool_result
- agent_switch
- retry
- file_reference
- subtask_start
- turn_complete

---

## 实现顺序

1. Task 1: TurnState 数据结构
2. Task 5: turn_start 包含 parentShortUUID（依赖 Task 1）
3. Task 2: chat.params hook
4. Task 3: permission.ask hook
5. Task 4: event hook 处理新 Part 类型（step-start, agent, retry, file）
6. Task 6: 子任务独立追踪（依赖 Task 1, 4, 5）
7. Task 7: turn_complete 检查
8. Task 8: 验证测试

---

## 注意事项

1. **hook 执行顺序：** opencode 中 hook 的执行顺序可能不同，需要通过日志确认
2. **子任务的 step-finish：** 子任务完成后会触发独立的 session.deleted，需要正确清理
3. **空值处理：** permission_request, agent_switch 等可能为空，确保类型安全
