# Turn Isolation V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修改 `step-finish` 判断条件，只在 `reason` 为 `stop/length/content-filter` 时写入 response

**Architecture:** 在 `event` hook 的 `message.part.updated` 处理中，精确判断 turn 结束条件

**Tech Stack:** TypeScript, @opencode-ai/plugin

---

## Task 1: 修改 step-finish 判断条件

**Files:**
- Modify: `.opencode/plugin/log-conversation.ts:291-299`

**Step 1: 查看当前代码**

当前代码 (line 291-299):
```typescript
if (reason !== "tool-calls") {
  debug(`step-finish: reason=${reason}, appending response`)
  appendResponseToFile(state)
} else {
  debug(`step-finish: tool-calls, not ending turn`)
}
```

**问题**: 这个条件会将 `unknown` 等其他 reason 也当作 turn 结束，但设计要求只有 `stop/length/content-filter` 才算真正结束。

**Step 2: 修改判断条件**

将 line 294 修改为:
```typescript
const isTurnEnd = reason === "stop" || reason === "length" || reason === "content-filter"
if (isTurnEnd) {
  debug(`step-finish: reason=${reason}, appending response`)
  appendResponseToFile(state)
} else {
  debug(`step-finish: reason=${reason}, not ending turn`)
}
```

**Step 3: 验证修改**

查看修改后的完整 event hook 处理逻辑:
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

  // 只有当 reason 是 stop/length/content-filter 时，才追加 response 到文件
  const isTurnEnd = reason === "stop" || reason === "length" || reason === "content-filter"
  if (isTurnEnd) {
    debug(`step-finish: reason=${reason}, appending response`)
    appendResponseToFile(state)
  } else {
    debug(`step-finish: reason=${reason}, not ending turn`)
  }
}
```

**Step 4: 清除旧日志并测试**

```bash
rm -f .opencode/logs/*.jsonl .opencode/debug.log
```

发送 3 条用户消息测试：
1. 验证生成 3 个独立文件
2. 验证每个文件包含成对的 request + response
3. 验证 tool-calls 后的继续对话不会导致数据丢失

**Step 5: Commit**

```bash
git add .opencode/plugin/log-conversation.ts
git commit -m "fix: precise turn-end detection for step-finish reason

Only write response when reason is stop/length/content-filter.
Previously used reason !== 'tool-calls' which could incorrectly
handle 'unknown' reason values.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `.opencode/plugin/log-conversation.ts` | 修改 line 294 |

---

## 验证清单

- [ ] 发送 3 条用户消息
- [ ] 验证生成 3 个独立 jsonl 文件
- [ ] 验证每个文件包含 request + response 配对
- [ ] 验证 tool-calls 场景下数据正确累积
