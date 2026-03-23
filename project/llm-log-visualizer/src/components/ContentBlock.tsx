import React from 'react'
import { inferContentType, getContentTypeColor, getContentTypeLabel } from '../utils/contentType'
import { ShellBlock } from './ShellBlock'
import { CodeBlock } from './CodeBlock'
import { TodoBlock } from './TodoBlock'
import { MarkdownBlock } from './MarkdownBlock'

interface ContentBlockProps {
  content: string
  toolName?: string
  showLabel?: boolean
}

// Extract text from JSON content block format: [{type:"text",text:"...",...}]
function extractTextFromJson(content: string): string {
  const trimmed = content.trim()
  if ((trimmed.startsWith('[{') && trimmed.endsWith('}]')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => c.text || '').join('')
      } else if (parsed && typeof parsed.text === 'string') {
        return parsed.text
      }
    } catch {
      // Not valid JSON, return as-is
    }
  }
  return content
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
        return <MarkdownBlock>{content}</MarkdownBlock>
      case 'text':
        // Try to extract text from JSON content block format
        const extractedText = extractTextFromJson(content)
        return <div className="content-text">{extractedText}</div>
      case 'error':
      default:
        return <div className="content-text">{extractTextFromJson(content)}</div>
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