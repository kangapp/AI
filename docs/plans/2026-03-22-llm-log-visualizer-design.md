# LLM Log Visualizer - 设计文档

## Overview

一个 React 前端应用，用于可视化 `.opencode/logs/` 目录下的 jsonl 日志文件，分 turn 展示 LLM 的输入输出。

## Layout

```
┌──────────┬─────────────────────┬─────────────────────────────┐
│          │   System Prompt     │   Chat History              │
│  Timeline│   (scrollbar)       │   (scrollbar, Markdown)     │
│          │   Markdown          │                             │
│  ● Turn 1├─────────────────────┼─────────────────────────────┤
│  ● Turn 2│                     │   Tool History             │
│  ● Turn 3│                     │   (scrollbar, 可展开卡片)   │
└──────────┴─────────────────────┴─────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Status Bar: Sysprompt tokens | Chat tokens | Tools count        │
└─────────────────────────────────────────────────────────────────┘
```

### 列说明

| 列 | 宽度 | 内容 |
|---|------|------|
| Timeline | 120px fixed | 垂直时间线，点击切换 turn |
| System Prompt | 30% | Markdown 渲染，可滚动 |
| Chat + Tool History | 70% | 上下垂直布局，可独立滚动 |

## Features

### 1. 文件加载

- **默认加载**：启动时扫描 `.opencode/logs/` 目录
- **拖拽上传**：支持将 jsonl 文件拖拽到页面
- **排序**：按文件修改时间倒序排列
- **文件列表**：左侧 Timeline 下方显示可用文件

### 2. Timeline 导航

- 垂直时间线，每个节点显示 `Turn N`
- 当前 turn 高亮显示
- 点击切换 turn
- 也可用键盘 ← → 切换

### 3. System Prompt

- Markdown 渲染（使用 react-markdown）
- 代码高亮（使用 rehype-highlight）
- 独立滚动区域

### 4. Chat History

- Markdown 渲染
- 显示 user/assistant 消息
- 区分角色（user/assistant）
- 独立滚动区域

### 5. Tool History

- 可展开卡片列表
- 默认显示摘要：tool name + 状态
- 点击展开查看完整 args/output
- JSON 格式化显示

### 6. Status Bar

- System Prompt token 估算
- Chat History token 估算
- Tool Calls 数量
- 当前 Turn / 总 Turns

## Data Schema

jsonl 每行格式：

```typescript
type EventType =
  | "turn_start"      // turn 开始
  | "turn_complete"   // turn 结束
  | "llm_params"      // LLM 参数
  | "text"           // 文本输出
  | "reasoning"      // 思考过程
  | "tool_call_result" // 工具调用结果
  | "step_start"     // 步骤开始
  | "agent_switch"   // Agent 切换
  | "retry"          // 重试
  | "file_reference" // 文件引用
  | "subtask_start"  // 子任务
  | "permission_request" // 权限请求

interface Turn {
  turn_start: {
    turn: number
    sessionID: string
    shortUUID: string
    model: { providerID: string; modelID: string }
    agent: string
    system: string[]
    messages: any[]
  }
  events: Event[]  // 中间的事件
  turn_complete: {
    turn: number
    reason: string
    texts: string[]
    fullText: string
    reasoning: string[]
    toolCalls: ToolCall[]
    tools: Tool[]
  }
}
```

## Technical Stack

- React 18 + TypeScript
- Vite
- react-markdown + rehype-highlight
- 纯 CSS（无 Tailwind 等框架）

## File Structure

```
llm-log-visualizer/
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── components/
│   │   ├── Timeline.tsx
│   │   ├── SystemPrompt.tsx
│   │   ├── ChatHistory.tsx
│   │   ├── ToolHistory.tsx
│   │   ├── StatusBar.tsx
│   │   └── ToolCard.tsx
│   ├── hooks/
│   │   ├── useJsonlParser.ts
│   │   └── useFileLoader.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── tokenizer.ts
└── README.md
```

## Implementation Phases

1. **Phase 1**: 项目搭建 + 基本布局
2. **Phase 2**: 文件加载（默认目录 + 拖拽）
3. **Phase 3**: Timeline 组件
4. **Phase 4**: System Prompt Markdown 渲染
5. **Phase 5**: Chat History Markdown 渲染
6. **Phase 6**: Tool History 可展开卡片
7. **Phase 7**: Status Bar Token 统计
8. **Phase 8**: 细节打磨
