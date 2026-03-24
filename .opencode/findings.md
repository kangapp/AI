# Findings: LLM Log Conversation Plugin

## SessionID 生成逻辑

- 格式: `ses_{6字节时间戳+计数器hex}_{12位随机base62}`
- 例如: `ses_0c1e5a8f2d_AbCdEfGhIjKlMnOpQrStUv`

## Opencode Plugin Hooks

| Hook | 类型 | 说明 |
|------|------|------|
| `chat.message` | 输入 | 用户消息到达 |
| `chat.params` | 输入 | LLM 参数 |
| `chat.headers` | 输入 | HTTP headers |
| `tool.execute.before` | 工具 | 工具执行前记录 toolCall |
| `tool.execute.after` | 工具 | 工具执行后记录结果 |
| `experimental.chat.messages.transform` | 消息 | 消息历史转换 |
| `experimental.chat.system.transform` | 消息 | System prompt 转换 |
| `experimental.text.complete` | 输出 | 文本块完成 |
| `event` | 特殊 | Bus 事件 |

## Turn 生命周期

### 完整数据流

```
1. 用户发送消息
   ↓
2. chat.messages.transform (获取 msgs，但 system 未构建)
   ↓
3. chat.system.transform (可获取 system prompt)
   ↓
4. processor.process() → LLM 调用
   ↓
5. 流式输出: text-complete, tool-result, reasoning
   ↓
6. step-finish part 保存 → Bus.publish("message.part.updated", { part })
   ↓
7. event hook 收到 "message.part.updated" 事件
```

### Turn 索引规则（设计澄清 2026-03-22）

- **同一个 session 的多个 turn 在同一个文件**
- **Turn 递增时机**: `step-finish reason=tool-calls` 后，新的 `turn_start` 时 `turn += 1`
- **Turn 结束时机**: `step-finish reason=stop/length/content-filter/null` 时写入 `turn_complete`

### Turn 流程示例

```
user msg 1
  → turn_start turn=1
  → step-finish reason=tool-calls → turn += 1 (不写 turn_complete)
  → turn_start turn=2
  → step-finish reason=stop → 写入 turn_complete turn=2
```

## Part 类型

| Part Type | 事件 | 说明 | 包含 turn |
|-----------|------|------|----------|
| `text` | text | 文本输出 | ✅ |
| `reasoning` | reasoning | 思考过程 (Ultra Think) | ✅ |
| `tool` | (merged into tool_call_result) | 工具调用 | ✅ |
| `step-finish` | turn_complete | Turn 结束标志 | ✅ |
| `step-start` | step_start | 思维步骤开始 | ✅ |
| `agent` | agent_switch | Agent 切换 | ✅ |
| `retry` | retry | 重试事件 | ✅ |
| `file` | file_reference | 引用文件 | ✅ |
| `subtask` | subtask_start | 子任务（独立文件） | ✅ |
| `chat.params` | llm_params | LLM 调用参数 | ✅ |
| `permission.ask` | permission_request | 权限请求 | ✅ |

## Turn Isolation 设计 (2026-03-21)

### 目标
每个 user turn 写入独立文件 `{sessionID}_{shortUUID}.jsonl`

### 文件命名
- 格式: `{sessionID}_{shortUUID}.jsonl`
- shortUUID: `crypto.randomUUID()` 前 12 位

### 当前 vs 目标
| 方面 | 当前 | 目标 |
|------|------|------|
| 文件数 | 每 session 一个文件 | 每 turn 一个文件 |
| 文件名 | `{sessionID}.jsonl` | `{sessionID}_{shortUUID}.jsonl` |
| 示例 | `ses_abc123.jsonl` | `ses_abc123_xyz78901abcd.jsonl` |

### 实现方案
1. `chat.messages.transform` 检测 user 消息
2. 生成 shortUUID，创建独立 turnState
3. 使用 `turnKey = sessionID + shortUUID` 作为 Map key
4. turn 结束时写入独立文件

---

## TurnState 数据结构

```typescript
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string | null
  filePath: string
  responseWritten: boolean  // 防止重复写入 turn_complete
  request: {
    messages: any[]
    system: string[]
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]
    reasoning: string[]
    toolCalls: { id, tool, args, output, title }[]
    tools: { tool, args, output, title }[]
  }
}
```

## Timeline Log 事件格式

### turn_start
```json
{
  "type": "turn_start",
  "turn": 1,
  "sessionID": "ses_xxx",
  "shortUUID": "abc123",
  "parentShortUUID": null,
  "model": {...},
  "agent": "...",
  "system": [...],
  "messages": [...]
}
```

### tool_call_result
```json
{
  "type": "tool_call_result",
  "id": "call_xxx",
  "tool": "read_file",
  "args": {...},
  "output": "...",
  "title": "..."
}
```

---

## LLM Log Visualizer (2026-03-22 Redesign)

### 项目信息
- 位置: `project/llm-log-visualizer/`
- 技术栈: React 18 + TypeScript + Vite + 纯 CSS
- 功能: 可视化 jsonl 日志文件，分 turn 展示

### 新 UI 布局
```
┌────────────────────────────────────────────────────────────┐
│  LLM Log Visualizer              ← Turn 1/12 →           │
├──────────┬─────────────────────┬─────────────────────────┤
│  Files   │   System Prompt     │   Conversation           │
│  (侧边栏) │   (可滚动)         │   (可滚动)               │
│          │                    │                         │
│  📄file1 │   Markdown 渲染     │   User/Assistant 消息   │
│  📄file2 │                    │                         │
│          │                    ├─────────────────────────┤
│          │                    │   Tool Calls            │
│          │                    │   (可展开卡片)           │
├──────────┴─────────────────────┴─────────────────────────┤
│  File: xxx.jsonl  |  Turn: 1/12  |  Tools: 3          │
└────────────────────────────────────────────────────────────┘
```

### 组件列表
| 组件 | 说明 |
|------|------|
| App | 主组件，整合所有功能 |
| App.css | 深色主题样式 |
| useJsonlParser | JSONL 解析 hook |

### Tool Call 数据来源
Tool calls 从两个地方读取：
1. `turnComplete.toolCalls` - turn 结束时汇总
2. `events` 数组中的 `tool_call_result` 事件

### 消息内容格式
消息 `content` 可能是：
- 字符串: `"Hello"`
- 对象: `{ type: "text", text: "Hello", id: "..." }`

需要 `renderContent()` 处理各种格式。

### Vite Server Middleware 路由顺序
```typescript
// 精确路由必须放在前面
server.middlewares.use('/api/logs/:filename', handler)  // 先匹配
server.middlewares.use('/api/logs', handler)            // 后匹配
```

### 拖拽事件处理
使用 `dragCounter` 计数器避免闪烁：
- `dragenter` → counter++
- `dragleave` → counter--
- counter ≤ 0 时才隐藏 drop zone

同时 drop zone 使用 `pointer-events: none` 避免阻挡事件。

---

## LLM Log Visualizer (旧版设计 - 已废弃)

```json
{
  "type": "turn_complete",
  "turn": 1,
  "reason": "stop",
  "texts": [...],
  "fullText": "...",
  "reasoning": [...],
  "toolCalls": [...],
  "tools": [...]
}
```

---

## Content Formatting (2026-03-22)

### 内容类型推断

```typescript
type ContentType = 'text' | 'markdown' | 'command' | 'code' | 'todo' | 'error'

inferContentType(toolName?, content?):
  - error: Bash + error/failed/exception
  - command: tool = "Bash"
  - code: tool = Read/Write/Edit/Grep/Glob
  - todo: content 匹配 - [ ] / - [x]
  - markdown: content 匹配 #/*/- 模式
  - text: 默认
```

### 组件结构

```
ContentBlock
├── ShellBlock (command)
├── CodeBlock (code)
├── TodoBlock (todo)
├── MarkdownBlock (markdown) - react-markdown + rehype-highlight
└── content-text (text/error)
```

### CSS 样式

- `.content-block` - 左边框颜色区分类型
- `.shell-block` - 深色背景 (#1e1e1e)
- `.code-block` - 浅色背景，行号
- `.markdown-block` - GitHub 风格 Markdown

---

## LLM Log Visualizer (2026-03-24 更新)

### `<content>` 标签解析

日志中的 `<content>...</content>` 标签包含被读取的 markdown 文件内容：

```typescript
function extractContentFromTag(text: string): string {
  const match = text.match(/<content>([\s\S]*?)<\/content>/)
  if (match) {
    return match[1].trim()
  }
  return text
}
```

### 行号清理

日志中的内容常带有行号前缀 (`1:`, `2:`, etc.)，需要清理：

```typescript
function cleanLineNumbers(text: string): string {
  return text.replace(/^\d+:\s*/gm, '')
}
```

### Mermaid 图表支持

- 安装 `mermaid` npm 包
- 初始化配置使用 `dark` 主题
- ReactMarkdown components 自定义渲染 `language-mermaid` 代码块
- `useEffect` 调用 `mermaid.run()` 渲染图表

### ChatItem 类型扩展

```typescript
export type ChatItem =
  | { kind: 'user'; content: string; contentType?: 'text' | 'file' | 'command' | 'reference'; turn: number; filename?: string }
```

每个 content block 独立生成一个 ChatItem，支持：
- `contentType: 'file'` - 文件引用，带 filename
- `contentType: 'command'` - 命令
- `contentType: 'text'` - 普通文本
