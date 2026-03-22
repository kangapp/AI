# Turn Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 每个 user turn 写入独立文件 `{sessionID}_{shortUUID}.jsonl`

**Architecture:** 在 `chat.messages.transform` hook 中检测 user 消息，生成 shortUUID 并创建独立的 turnState，每个 turn 结束时写入独立文件。

**Tech Stack:** TypeScript, @opencode-ai/plugin, crypto.randomUUID()

---

## Task 1: 修改 getLogPath 函数

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts:35-41`

**Step 1: 修改 getLogPath 函数签名**

将函数从 `getLogPath(sessionID: string)` 改为 `getLogPath(sessionID: string, shortUUID?: string)`

当 shortUUID 存在时，文件名为 `{sessionID}_{shortUUID}.jsonl`

```typescript
function getLogPath(sessionID: string, shortUUID?: string): string {
  const logDir = join(process.cwd(), ".opencode", "logs")
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  const baseName = shortUUID ? `${sessionID}_${shortUUID}` : sessionID
  return join(logDir, `${baseName}.jsonl`)
}
```

**Step 2: Commit**

```bash
git add plugin/log-conversation.ts
git commit -m "refactor: add shortUUID parameter to getLogPath"
```

---

## Task 2: 添加 shortUUID 生成逻辑

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts:55-69`

**Step 1: 在 chat.messages.transform 中检测 user 消息并生成 shortUUID**

在检测到 user 消息时（role === "user"），生成新的 shortUUID 并创建独立的 turnState。

当前代码在 line 60-69 创建 turnState，需要修改为在检测到 user 消息时生成 shortUUID 并作为新 turn 的标识。

关键变更：
- 在 user 消息时：生成 shortUUID，创建新的 turnState，使用 `sessionID + shortUUID` 作为 key
- 不再使用 `turns.get(sessionID)`，改为 `turns.get(sessionID + shortUUID)` 或类似逻辑

```typescript
"experimental.chat.messages.transform": async (_, output) => {
  const sessionID = output.messages[0]?.info.sessionID
  if (!sessionID) return

  // 检测是否是 user 消息（新 turn 的开始）
  const hasUserMessage = output.messages.some((m: any) => m.info.role === "user")

  if (hasUserMessage) {
    // 生成 shortUUID 并创建新的 turnState
    const shortUUID = crypto.randomUUID().substring(0, 12)
    const turnKey = `${sessionID}_${shortUUID}`

    const state: TurnState = {
      turn: 0,
      sessionID,
      shortUUID,
      request: null as any,
      response: { texts: [], reasoning: [], toolCalls: [], tools: [] },
    }
    turns.set(turnKey, state)
  }

  // ... 后续处理不变，但使用 turnKey 替代 sessionID
}
```

**Step 2: Commit**

```bash
git add plugin/log-conversation.ts
git commit -m "feat: generate shortUUID on user message for turn isolation"
```

---

## Task 3: 更新所有使用 sessionID 的地方

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts:127-146`
- Modify: `.opencode/plugin/log-conversation.ts:149-235`

**Step 1: 更新所有 turns.get(sessionID) 为使用 turnKey**

由于数据结构变化，需要：
1. 在 TurnState 中添加 `shortUUID` 字段
2. 将 `turns` Map 的 key 从 `sessionID` 改为包含 shortUUID 的复合 key
3. 所有使用 `turns.get(sessionID)` 的地方需要改为 `turns.get(turnKey)`
4. 在 `getLogPath` 调用时传入 shortUUID

需要修改的位置：
- `experimental.text.complete` hook (line 127-133)
- `tool.execute.after` hook (line 136-146)
- `event` hook 中的 `message.part.updated` 处理 (line 149-195)
- `event` hook 中的 `session.deleted` 处理 (line 197-234)

**Step 2: Commit**

```bash
git add plugin/log-conversation.ts
git commit -m "refactor: use turnKey (sessionID + shortUUID) for state lookup"
```

---

## Task 4: 测试验证

**Step 1: 测试独立文件生成**

1. 启动 opencode 会话
2. 发送第一条用户消息
3. 验证生成文件 `ses_xxx_{shortUUID1}.jsonl`
4. 发送第二条用户消息
5. 验证生成文件 `ses_xxx_{shortUUID2}.jsonl`
6. 验证两个文件内容各自只包含一个 turn

**Step 2: Commit**

```bash
git add doc/
git commit -m "test: verify turn isolation produces separate files"
```

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `.opencode/plugin/log-conversation.ts` | 修改 |
| `.opencode/doc/plan/2026-03-21-turn-isolation-design.md` | 新增 |
| `.opencode/doc/plan/2026-03-21-turn-isolation-implementation.md` | 新增 |
