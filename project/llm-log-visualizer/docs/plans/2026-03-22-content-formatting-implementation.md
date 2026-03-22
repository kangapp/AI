# 内容格式化显示实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 根据消息的元数据（从 tool name 推断类型），对不同内容类型应用不同的渲染样式，通过颜色和标签区分

**Architecture:** 创建独立的内容块组件，根据类型推断函数选择渲染方式

**Tech Stack:** React 18, TypeScript, react-markdown, 纯 CSS

---

## Task 1: 创建类型推断函数

**Files:**
- Create: `src/utils/contentType.ts`

**Step 1: 创建 contentType.ts**

```typescript
export type ContentType = 'text' | 'markdown' | 'command' | 'code' | 'todo' | 'error'

export const inferContentType = (toolName?: string, content?: string): ContentType => {
  // Error detection (highest priority)
  if (toolName === 'Bash' && content && /error|failed|exception/i.test(content)) {
    return 'error'
  }

  // Command detection
  if (toolName === 'Bash') {
    return 'command'
  }

  // Code detection
  if (['Read', 'Write', 'Edit', 'Grep', 'Glob'].includes(toolName || '')) {
    return 'code'
  }

  // Todo detection
  if (content && /- \[.\]/.test(content)) {
    return 'todo'
  }

  // Markdown detection (simple heuristics)
  if (content && /^#{1,6}\s|^[*_].|^\s*[-*]\s|^\d+\.\s/.test(content)) {
    return 'markdown'
  }

  return 'text'
}

export const getContentTypeColor = (type: ContentType): string => {
  const colors: Record<ContentType, string> = {
    text: '#666666',
    markdown: '#0066cc',
    command: '#22863a',
    code: '#6f42c1',
    todo: '#f0ad4e',
    error: '#dc3545',
  }
  return colors[type]
}

export const getContentTypeLabel = (type: ContentType): string => {
  const labels: Record<ContentType, string> = {
    text: 'text',
    markdown: 'markdown',
    command: 'command',
    code: 'code',
    todo: 'todo',
    error: 'error',
  }
  return labels[type]
}
```

**Step 2: Commit**

```bash
git add src/utils/contentType.ts
git commit -m "feat: add contentType utility functions"
```

---

## Task 2: 创建 ContentBlock 组件

**Files:**
- Create: `src/components/ContentBlock.tsx`

**Step 1: 创建 ContentBlock.tsx**

```typescript
import React from 'react'
import { inferContentType, getContentTypeColor, getContentTypeLabel, ContentType } from '../utils/contentType'
import { ShellBlock } from './ShellBlock'
import { CodeBlock } from './CodeBlock'
import { TodoBlock } from './TodoBlock'

interface ContentBlockProps {
  content: string
  toolName?: string
  showLabel?: boolean
}

export const ContentBlock: React.FC<ContentBlockProps> = ({ content, toolName, showLabel = true }) => {
  const contentType = inferContentType(toolName, content)
  const borderColor = getContentTypeColor(contentType)
  const label = getContentTypeLabel(contentType)

  const renderContent = () => {
    switch (contentType) {
      case 'command':
        return <ShellBlock>{content}</ShellBlock>
      case 'code':
        return <CodeBlock>{content}</CodeBlock>
      case 'todo':
        return <TodoBlock>{content}</TodoBlock>
      case 'markdown':
      case 'text':
      case 'error':
      default:
        return <div className="content-text">{content}</div>
    }
  }

  return (
    <div className="content-block" style={{ borderLeftColor: borderColor }}>
      {showLabel && (
        <span className="content-type-label" style={{ backgroundColor: borderColor }}>
          {label}
        </span>
      )}
      {renderContent()}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ContentBlock.tsx
git commit -m "feat: add ContentBlock component"
```

---

## Task 3: 创建 ShellBlock 组件

**Files:**
- Create: `src/components/ShellBlock.tsx`

**Step 1: 创建 ShellBlock.tsx**

```typescript
import React from 'react'

interface ShellBlockProps {
  children: string
}

export const ShellBlock: React.FC<ShellBlockProps> = ({ children }) => {
  const lines = children.split('\n')

  return (
    <div className="shell-block">
      {lines.map((line, i) => (
        <div key={i} className="shell-line">
          {line.startsWith('$ ') ? (
            <>
              <span className="shell-prompt">$</span>
              <span className="shell-command">{line.slice(2)}</span>
            </>
          ) : (
            <span className="shell-output">{line}</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ShellBlock.tsx
git commit -m "feat: add ShellBlock component"
```

---

## Task 4: 创建 CodeBlock 组件

**Files:**
- Create: `src/components/CodeBlock.tsx`

**Step 1: 创建 CodeBlock.tsx**

```typescript
import React from 'react'

interface CodeBlockProps {
  children: string
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children }) => {
  const lines = children.split('\n')

  return (
    <div className="code-block">
      {lines.map((line, i) => (
        <div key={i} className="code-line">
          <span className="code-line-number">{i + 1}</span>
          <span className="code-content">{line}</span>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/CodeBlock.tsx
git commit -m "feat: add CodeBlock component"
```

---

## Task 5: 创建 TodoBlock 组件

**Files:**
- Create: `src/components/TodoBlock.tsx`

**Step 1: 创建 TodoBlock.tsx**

```typescript
import React from 'react'

interface TodoBlockProps {
  children: string
}

export const TodoBlock: React.FC<TodoBlockProps> = ({ children }) => {
  const lines = children.split('\n').filter(line => line.trim())

  return (
    <div className="todo-block">
      {lines.map((line, i) => {
        const isChecked = line.includes('- [x]') || line.includes('- [X]')
        const isUnchecked = line.includes('- [ ]')
        const text = line.replace(/- \[[xX ]\]\s*/, '')

        return (
          <div key={i} className={`todo-item ${isChecked ? 'checked' : ''}`}>
            <span className="todo-checkbox">
              {isChecked ? '☑' : isUnchecked ? '☐' : '•'}
            </span>
            <span className="todo-text">{text}</span>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/TodoBlock.tsx
git commit -m "feat: add TodoBlock component"
```

---

## Task 6: 添加 CSS 样式

**Files:**
- Modify: `src/App.css`

**Step 1: 添加 CSS 样式**

在 App.css 末尾添加：

```css
/* Content Block */
.content-block {
  border-left: 3px solid #666;
  padding-left: 12px;
  margin: 8px 0;
  position: relative;
}

.content-type-label {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  color: white;
  margin-bottom: 6px;
  font-weight: 600;
}

.content-text {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Shell Block */
.shell-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
}

.shell-line {
  line-height: 1.5;
}

.shell-prompt {
  color: #4ec9b0;
  margin-right: 8px;
}

.shell-command {
  color: #dcdcaa;
}

.shell-output {
  color: #d4d4d4;
}

/* Code Block */
.code-block {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  overflow-x: auto;
}

.code-line {
  display: flex;
  line-height: 1.5;
}

.code-line-number {
  color: #999;
  min-width: 30px;
  text-align: right;
  margin-right: 12px;
  user-select: none;
}

.code-content {
  white-space: pre;
}

/* Todo Block */
.todo-block {
  padding: 8px 0;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.todo-checkbox {
  font-size: 14px;
  line-height: 1.4;
}

.todo-text {
  font-size: 14px;
  line-height: 1.4;
}

.todo-item.checked .todo-text {
  text-decoration: line-through;
  color: #999;
}
```

**Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat: add content block CSS styles"
```

---

## Task 7: 更新 App.tsx 使用 ContentBlock

**Files:**
- Modify: `src/App.tsx`

**Step 1: 导入 ContentBlock**

在文件顶部添加：

```typescript
import { ContentBlock } from './components/ContentBlock'
```

**Step 2: 修改 renderMessages 函数**

找到 `renderMessages` 函数中的消息渲染部分，修改为使用 ContentBlock：

```typescript
const renderMessages = () => {
  if (!currentView) return null
  const messages = currentView?.messages || []
  const texts = currentView?.turnComplete?.texts || []

  return (
    <div className="chat-content">
      {messages.filter(m => m.role === 'user').map((msg, i) => (
        <div key={i} className="chat-message user">
          <div className="chat-role">User</div>
          <ContentBlock content={renderContent(msg.content)} showLabel={false} />
        </div>
      ))}
      {texts.map((text, i) => (
        <div key={i} className="chat-message assistant">
          <div className="chat-role">Assistant</div>
          <ContentBlock content={renderContent(text)} showLabel={false} />
        </div>
      ))}
    </div>
  )
}
```

**Step 3: 修改 tool output 渲染**

在 `renderToolCalls` 函数中，为 tool output 添加 ContentBlock：

```typescript
// 在 tool-card-body 中的 output 部分使用 ContentBlock
{tool.output && (
  <div className="tool-output">
    <div className="tool-section-title">Output</div>
    <ContentBlock content={typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)} toolName={tool.tool} />
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate ContentBlock in App.tsx"
```

---

## Task 8: 测试验证

**Step 1: 启动 dev server**

```bash
cd /Users/liufukang/workplace/AI/project/llm-log-visualizer
npm run dev
```

**Step 2: 测试步骤**

1. 拖拽 jsonl 文件到页面
2. 验证消息显示正常
3. 验证 Shell 命令（如 git status）显示为绿色边框的 shell 样式
4. 验证代码显示为紫色边框的代码块样式
5. 验证 Todo 列表显示为黄色边框的 todo 样式
6. 验证不同类型有正确的颜色标签

**Step 3: Commit**

```bash
git add -A
git commit -m "test: verify content formatting functionality"
```

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `src/utils/contentType.ts` | 新增 |
| `src/components/ContentBlock.tsx` | 新增 |
| `src/components/ShellBlock.tsx` | 新增 |
| `src/components/CodeBlock.tsx` | 新增 |
| `src/components/TodoBlock.tsx` | 新增 |
| `src/App.tsx` | 修改 |
| `src/App.css` | 修改 |
