import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface SystemPromptProps {
  turn: Turn
}

export function SystemPrompt({ turn }: SystemPromptProps) {
  const systemPrompts = turn.turnStart.system || []
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(systemPrompts.map((_, i) => i))
  )

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const totalTokens = systemPrompts.reduce((sum, p) => sum + estimateTokens(p), 0)

  return (
    <div className="system-column">
      <div className="column-header">
        System Prompt ({formatTokens(totalTokens)} tokens, {systemPrompts.length} sections)
      </div>
      <div className="column-content">
        <div className="system-content">
          {systemPrompts.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No system prompt</div>
          )}
          {systemPrompts.map((prompt, index) => {
            const isExpanded = expandedSections.has(index)
            const tokens = estimateTokens(prompt)

            return (
              <div key={index} className="system-section">
                <div
                  className="system-section-header"
                  onClick={() => toggleSection(index)}
                >
                  <span className="system-section-toggle">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <span className="system-section-title">
                    Section {index + 1}
                  </span>
                  <span className="system-section-meta">
                    {formatTokens(tokens)} tokens
                  </span>
                </div>
                {isExpanded && (
                  <div className="system-section-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {prompt}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
