# Turn Isolation Design

## 需求

将每个 user turn 写入独立文件，而不是整个 session 共用一个文件。

## 当前状态

- 所有 turn 共用 `{sessionID}.jsonl`
- 例：`ses_2ef77d91cffeQpfTNwbCUUnZzm.jsonl` 包含所有 turn

## 目标

每个 user turn 生成独立文件，文件名为 `{sessionID}_{shortUUID}.jsonl`

## 实现方案

### 文件命名

| 字段 | 说明 |
|------|------|
| sessionID | opencode session ID（保持不变） |
| shortUUID | UUID v4 前 12 位（每次 turn 新生成） |
| 格式 | `{sessionID}_{shortUUID}.jsonl` |
| 示例 | `ses_abc123_xyz78901abcd.jsonl` |

### ID 生成

使用 `crypto.randomUUID()` 取前 12 字符生成 shortUUID。

### 数据结构

每个 shortUUID 对应独立的 `TurnState`，实现文件隔离。

### 数据流

```
user 消息 → 生成 shortUUID → 创建独立 turnState →
  → step-finish → 写入 {sessionID}_{shortUUID}.jsonl
```

### 触发时机

在 `experimental.chat.messages.transform` hook 中检测 user 消息，生成新 shortUUID 并创建独立 state。

### 文件结构

```
.opencode/
  logs/
    ses_abc123_shortXYZ1.jsonl  ← turn 1
    ses_abc123_shortXYZ2.jsonl  ← turn 2
    ses_abc123_shortXYZ3.jsonl  ← turn 3
```

## 影响范围

- 修改 `getLogPath()` 函数签名
- 在 `chat.messages.transform` 中添加 shortUUID 生成逻辑
- 每个 turn 结束时写入对应独立文件

## 测试验证

1. 连续发送 2 条用户消息
2. 验证生成 2 个独立文件
3. 验证每个文件只包含一个 turn 的 request/response
