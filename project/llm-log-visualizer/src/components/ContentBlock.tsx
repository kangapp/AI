import React, { useMemo } from 'react'
import { inferContentType, getContentTypeColor, getContentTypeLabel } from '../utils/contentType'
import { ShellBlock } from './ShellBlock'
import { CodeBlock } from './CodeBlock'
import { TodoBlock } from './TodoBlock'
import { MarkdownBlock } from './MarkdownBlock'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

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

// Escape HTML to display tags as text
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Extract content from <content>...</content> tags
function extractContentFromTag(text: string): string {
  const match = text.match(/<content>([\s\S]*?)<\/content>/)
  if (match) {
    return match[1].trim()
  }
  return text
}

// Remove "1: ", "2: ", etc. prefixes at the start of lines
function cleanLineNumbers(text: string): string {
  return text.replace(/^\d+:\s*/gm, '')
}

// Get file extension from filename
function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

// Check if file should be rendered as code (based on extension)
function isCodeFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'yaml', 'yml', 'xml', 'html', 'css', 'scss', 'md', 'sql', 'sh', 'bash', 'zsh', 'toml', 'ini', 'cfg', 'conf', 'log']
  return codeExtensions.includes(ext)
}

// Check if content has <type>file</type> and extract file info
function parseFileContent(content: string): { isFile: boolean; filename: string; fileContent: string; hasContent: boolean; isCode: boolean } {
  if (content.includes('<type>file</type>')) {
    const pathMatch = content.match(/<path>(.*?)<\/path>/s)
    const contentMatch = content.match(/<content>([\s\S]*?)<\/content>/)
    const filename = pathMatch ? pathMatch[1] : ''
    return {
      isFile: true,
      filename,
      fileContent: contentMatch ? cleanLineNumbers(contentMatch[1].trim()) : '',
      hasContent: !!contentMatch,
      isCode: isCodeFile(filename),
    }
  }
  return { isFile: false, filename: '', fileContent: '', hasContent: false, isCode: false }
}

export const ContentBlock: React.FC<ContentBlockProps> = ({ content, toolName, showLabel = true }) => {
  const contentType = inferContentType(toolName, content)
  const borderColor = getContentTypeColor(contentType)
  const label = getContentTypeLabel(contentType)

  // Check if this is a file content
  const fileInfo = useMemo(() => parseFileContent(content), [content])

  const renderContent = () => {
    // Handle file type content with <content> tags
    if (fileInfo.isFile && fileInfo.hasContent) {
      const ext = getFileExtension(fileInfo.filename)
      return (
        <div className="tool-content-file">
          <div className="tool-content-file-header">
            <span className="file-tag">
              <span className="file-tag-label">📎 FILE</span>
              {fileInfo.filename && <span className="file-tag-name">{fileInfo.filename}</span>}
            </span>
          </div>
          <div className="tool-content-file-body">
            {fileInfo.isCode ? (
              // Render as code block for code files
              <pre className="tool-file-code">
                <code>{fileInfo.fileContent}</code>
              </pre>
            ) : (
              // Render as markdown for non-code files (e.g., .md)
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code: ({ node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    if (match && match[1] === 'mermaid') {
                      return (
                        <div className="mermaid-chart">
                          <div className="mermaid" dangerouslySetInnerHTML={{ __html: codeString }} />
                        </div>
                      )
                    }
                    if (className) {
                      return <code className={className} {...props}>{children}</code>
                    }
                    return <code {...props}>{children}</code>
                  }
                }}
              >
                {fileInfo.fileContent}
              </ReactMarkdown>
            )}
          </div>
        </div>
      )
    }

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
        // Also check for content tags in extracted text
        const contentWithTag = extractContentFromTag(extractedText)
        return <div className="content-text" dangerouslySetInnerHTML={{ __html: escapeHtml(contentWithTag) }} />
      case 'error':
      default:
        return <div className="content-text" dangerouslySetInnerHTML={{ __html: escapeHtml(extractTextFromJson(content)) }} />
    }
  }

  return (
    <div className="content-block" style={{ borderLeftColor: borderColor }}>
      {showLabel && !fileInfo.isFile && (
        <span className="content-type-label" style={{ backgroundColor: borderColor }}>
          {label}
        </span>
      )}
      {renderContent()}
    </div>
  )
}