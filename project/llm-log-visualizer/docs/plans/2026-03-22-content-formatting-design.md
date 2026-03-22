# LLM Log Visualizer - 内容格式化显示设计

## 概述

根据消息的元数据（从 tool name 推断类型），对不同内容类型应用不同的渲染样式。所有类型混合显示，通过颜色和标签区分。

## 内容类型定义

| 类型 | 来源 | 边框颜色 | 说明 |
|------|------|----------|------|
| `text` | 默认 | 灰色 | 普通文本 |
| `markdown` | 内容包含 Markdown 特征 | 蓝色 | 支持标题、列表、链接、代码块 |
| `command` | tool = "Bash" 的 output | 绿色 | Shell 风格高亮 |
| `code` | tool = "Read"/"Write"/"Edit" 的 output | 紫色 | 代码块高亮 |
| `todo` | 内容匹配 todo 模式 `- [ ]` 或 `- [x]` | 黄色 | Todo 列表渲染 |
| `error` | tool = "Bash" output 包含 "error"/"failed" | 红色 | 错误信息 |

## 类型推断规则

```typescript
const inferContentType = (toolName?: string, content?: string): string => {
  // Error detection (highest priority)
  if (toolName === 'Bash' && content && /error|failed|exception/i.test(content)) {
    return 'error'
  }

  // Command detection
  if (toolName === 'Bash') {
    return 'command'
  }

  // Code detection
  if (['Read', 'Write', 'Edit', 'Grep', 'Glob'].includes(toolName)) {
    return 'code'
  }

  // Todo detection
  if (content && /- \[.\]/.test(content)) {
    return 'todo'
  }

  // Markdown detection (simple heuristics)
  if (content && /^#{1,6}\s|m\*\*|^\s*[-*]\s|^\d+\.\s/.test(content)) {
    return 'markdown'
  }

  return 'text'
}
```

## UI 效果

```
┌─────────────────────────────────────────┐
│ [markdown]                             │
│ This is **bold** and *italic* text     │
│ - list item 1                          │
│ - list item 2                          │
├─────────────────────────────────────────┤
│ [command]                              │
│ $ git status                           │
│ On branch master                       │
│ nothing to commit, working tree clean  │
├─────────────────────────────────────────┤
│ [code]                                 │
│ src/App.tsx                            │
│ 1 │ const App = () => {               │
│ 2 │   return <div />                  │
│ 3 │ }                                 │
├─────────────────────────────────────────┤
│ [todo]                                 │
│ ☑ Fix bug in parser                    │
│ ☐ Add new feature                      │
├─────────────────────────────────────────┤
│ [text]                                 │
│ Just a plain text message...           │
└─────────────────────────────────────────┘
```

## 标签样式

- 固定显示在消息左上角
- 圆角标签，颜色与边框一致
- 标签颜色与边框颜色对应

| 类型 | 标签颜色 |
|------|----------|
| text | #666 (灰色) |
| markdown | #0066cc (蓝色) |
| command | #22863a (绿色) |
| code | #6f42c1 (紫色) |
| todo | #f0ad4e (黄色) |
| error | #dc3545 (红色) |

## 组件结构

```typescript
interface ContentBlockProps {
  type: ContentType
  content: string
  toolName?: string
}

// 组件层级
<ContentRenderer>
  <TextBlock />
  <MarkdownBlock />
  <ShellBlock />
  <CodeBlock />
  <TodoBlock />
  <ErrorBlock />
</ContentRenderer>
```

## 渲染策略

```typescript
const renderContent = (content: string, contentType: string, toolName?: string) => {
  switch (contentType) {
    case 'command':
      return <ShellBlock>{content}</ShellBlock>
    case 'markdown':
      return <MarkdownBlock>{content}</MarkdownBlock>
    case 'code':
      return <CodeBlock syntax={inferSyntax(toolName)}>{content}</CodeBlock>
    case 'todo':
      return <TodoBlock>{content}</TodoBlock>
    case 'error':
      return <ErrorBlock>{content}</ErrorBlock>
    default:
      return <TextBlock>{content}</TextBlock>
  }
}
```

## 实现计划

1. 创建 `ContentBlock` 组件 - 根据类型渲染内容
2. 创建类型推断函数 `inferContentType`
3. 创建 `ShellBlock` 组件 - Shell 风格高亮
4. 创建 `MarkdownBlock` 组件 - 基础 Markdown 渲染
5. 创建 `CodeBlock` 组件 - 代码高亮
6. 创建 `TodoBlock` 组件 - Todo 列表渲染
7. 更新 `renderMessages` 使用 ContentBlock
8. 更新 `renderToolCalls` 使用 ContentBlock
9. 添加 CSS 样式

## 变更文件清单

| 文件 | 变更类型 |
|------|----------|
| `src/components/ContentBlock.tsx` | 新增 |
| `src/components/ShellBlock.tsx` | 新增 |
| `src/components/MarkdownBlock.tsx` | 新增 |
| `src/components/CodeBlock.tsx` | 新增 |
| `src/components/TodoBlock.tsx` | 新增 |
| `src/components/ErrorBlock.tsx` | 新增 |
| `src/utils/contentType.ts` | 新增 - 类型推断 |
| `src/App.tsx` | 修改 - 使用 ContentBlock |
| `src/App.css` | 修改 - 添加样式 |
