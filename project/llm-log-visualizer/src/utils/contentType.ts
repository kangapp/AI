export type ContentType = 'text' | 'markdown' | 'command' | 'code' | 'todo' | 'error'

export const inferContentType = (toolName?: string, content?: string): ContentType => {
  // JSON detection - if content looks like JSON array/object, treat as text
  if (content && typeof content === 'string') {
    const trimmed = content.trim()
    if ((trimmed.startsWith('[{') && trimmed.endsWith('}]')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      // Check if it's valid JSON (has "type" and "text" fields which indicate content blocks)
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed) && parsed[0]?.type === 'text') {
          return 'text'  // Content block format, render as text
        }
      } catch {
        // Not valid JSON, continue with other checks
      }
    }
  }

  // XML/content block format detection (e.g., <path>, <content> tags) - treat as text
  if (content && (/<path>|<content>|<type>/.test(content) || /<[a-z]+>[^<]+<\/[a-z]+>/.test(content))) {
    return 'text'
  }

  // Markdown detection (highest priority for mixed content)
  if (content && (/\n#{1,6}\s/.test(content) || /^\s*[-*]\s/.test(content) || /\n\|.*\|.*\|/.test(content))) {
    return 'markdown'
  }

  // Error detection
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
