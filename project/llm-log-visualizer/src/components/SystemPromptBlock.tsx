import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

export type DisplayMode = 'compact' | 'comfortable' | 'detailed'

interface SystemPromptBlockProps {
  content: string
  displayMode: DisplayMode
}

type ContentType = 'markdown' | 'json' | 'xml' | 'plain'

function detectContentType(content: string): ContentType {
  const trimmed = content.trim()

  // 检查是否包含明显的 markdown 语法
  const markdownIndicators = [
    /^#+ /m,           // 标题
    /\*\*[^*]+\*\*/m,  // 粗体
    /\*[^*]+\*/m,      // 斜体
    /^[-*]\s/m,        // 无序列表
    /^\d+\.\s/m,       // 有序列表
    /```/,             // 代码块
    /`[^`]+`/,         // 行内代码
    /\[.+\]\(.+\)/m,   // 链接
    /!\[.+\]\(.+\)/m,  // 图片
    /\|.+\|/m,         // 表格
  ]

  const hasMarkdown = markdownIndicators.some(pattern => pattern.test(trimmed))
  if (hasMarkdown) {
    return 'markdown'
  }

  // 检查是否是纯 JSON（不包含 markdown 语法）
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {}
  }

  // 检查是否是 XML
  if (/<[a-z]+[^>]*>[\s\S]*?<\/[a-z]+>/i.test(trimmed)) {
    return 'xml'
  }

  return 'plain'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function highlightKeyContent(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const headerMatch = line.match(/^([A-Z][A-Z_\s]+):?\s*$/)
    const isImportant = /^\s*[-*]\s*(IMPORTANT|CRITICAL|NOTE|WARNING|KEY)/i.test(line)
    const isKeyValue = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)
    
    let className = ''
    if (headerMatch) className = 'sp-line-header'
    else if (isImportant) className = 'sp-line-important'
    else if (isKeyValue) className = 'sp-line-keyvalue'
    
    return (
      <span key={i} className={className ? `sp-line ${className}` : 'sp-line'}>
        {line || ' '}
      </span>
    )
  })
}

export const SystemPromptBlock: React.FC<SystemPromptBlockProps> = ({ content, displayMode }) => {
  const contentType = useMemo(() => detectContentType(content), [content])
  
  const renderContent = () => {
    switch (contentType) {
      case 'markdown':
        return (
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeHighlight]}
            className={`sp-markdown sp-${displayMode}`}
          >
            {content}
          </ReactMarkdown>
        )
      
      case 'json':
        try {
          const parsed = JSON.parse(content)
          return (
            <pre className={`sp-code sp-${displayMode}`}>
              <code>{JSON.stringify(parsed, null, 2)}</code>
            </pre>
          )
        } catch {
          return (
            <pre className={`sp-code sp-${displayMode}`}>
              <code>{content}</code>
            </pre>
          )
        }
      
      case 'xml':
        return (
          <pre className={`sp-code sp-${displayMode}`}>
            <code dangerouslySetInnerHTML={{ __html: escapeHtml(content) }} />
          </pre>
        )
      
      case 'plain':
      default:
        return (
          <div className={`sp-plain sp-${displayMode}`}>
            {highlightKeyContent(content)}
          </div>
        )
    }
  }
  
  return (
    <div className={`sp-block sp-${displayMode}`}>
      <span className="sp-type-badge">{contentType}</span>
      {renderContent()}
    </div>
  )
}
