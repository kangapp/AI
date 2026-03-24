import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface ChatHistoryProps {
  turn: Turn
}

// Extract text content from message content (handles JSON string format)
function extractTextContent(content: any): string {
  if (typeof content === 'string') {
    // Try to parse if it's a JSON string
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        // Array of content blocks: [{"type":"text","text":"..."}]
        return parsed.map((c: any) => c.text || '').join('')
      } else if (parsed && typeof parsed.text === 'string') {
        return parsed.text
      }
    } catch {
      // Not JSON, return as-is
      return content
    }
  }
  if (Array.isArray(content)) {
    return content.map((c: any) => c.text || '').join('')
  }
  return ''
}

export function ChatHistory({ turn }: ChatHistoryProps) {
  const messages = turn.turnStart.messages || []
  const fullText = turn.turnComplete?.fullText || turn.events
    .filter(e => e.type === 'text')
    .map(e => (e as any).content)
    .join('')

  const tokens = estimateTokens(fullText)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const toggleCollapse = (idx: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  return (
    <div className="chat-column">
      <div className="column-header">
        Chat History ({formatTokens(tokens)} tokens)
      </div>
      <div className="column-content">
        <div className="chat-content">
          {messages.map((msg: any, idx: number) => {
            const role = msg.role || 'assistant'
            const content = extractTextContent(msg.content)
            const isCollapsed = collapsed.has(idx)

            return (
              <div key={idx} className={`chat-message ${role} ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="chat-message-header" onClick={() => toggleCollapse(idx)}>
                  <div className="chat-role">{role}</div>
                  <button className="chat-collapse-btn">
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                </div>
                {!isCollapsed && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {content}
                  </ReactMarkdown>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
