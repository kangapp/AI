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
