import { useState } from 'react'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'
import { SystemPromptBlock, DisplayMode } from './SystemPromptBlock'

interface SystemPromptProps {
  turn: Turn
}

export function SystemPrompt({ turn }: SystemPromptProps) {
  const systemPrompts = turn.turnStart.system || []
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(systemPrompts.map((_, i) => i))
  )
  const [displayMode, setDisplayMode] = useState<DisplayMode>('compact')

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

  const toggleAll = () => {
    if (expandedSections.size === systemPrompts.length) {
      setExpandedSections(new Set())
    } else {
      setExpandedSections(new Set(systemPrompts.map((_, i) => i)))
    }
  }

  const totalTokens = systemPrompts.reduce((sum, p) => sum + estimateTokens(p), 0)

  const displayModes: { mode: DisplayMode; label: string; icon: string }[] = [
    { mode: 'compact', label: '紧凑', icon: '▤' },
    { mode: 'comfortable', label: '舒适', icon: '▦' },
    { mode: 'detailed', label: '详细', icon: '▣' },
  ]

  return (
    <div className="system-column">
      <div className="column-header">
        <span className="column-title">
          System Prompt ({formatTokens(totalTokens)} tokens, {systemPrompts.length} sections)
        </span>
        <div className="display-mode-switcher">
          {displayModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              className={`mode-btn ${displayMode === mode ? 'active' : ''}`}
              onClick={() => setDisplayMode(mode)}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      <div className="column-content">
        <div className="system-content">
          {systemPrompts.length === 0 && (
            <div className="no-content">No system prompt</div>
          )}
          {systemPrompts.map((prompt, index) => {
            const isExpanded = expandedSections.has(index)
            const tokens = estimateTokens(prompt)
            const preview = prompt.slice(0, 80).replace(/\n/g, ' ')

            return (
              <div key={index} className={`system-section ${isExpanded ? 'expanded' : ''}`}>
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
                  {!isExpanded && (
                    <span className="system-section-preview">{preview}...</span>
                  )}
                </div>
                {isExpanded && (
                  <div className="system-section-content">
                    <SystemPromptBlock
                      content={prompt}
                      displayMode={displayMode}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {systemPrompts.length > 1 && (
          <button className="toggle-all-btn" onClick={toggleAll}>
            {expandedSections.size === systemPrompts.length ? '折叠全部' : '展开全部'}
          </button>
        )}
      </div>
    </div>
  )
}
