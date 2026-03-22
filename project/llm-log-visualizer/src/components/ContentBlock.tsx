import React from 'react'
import { inferContentType, getContentTypeColor, getContentTypeLabel } from '../utils/contentType'
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