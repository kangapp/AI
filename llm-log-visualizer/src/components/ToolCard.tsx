import { useState } from 'react'
import type { ToolCallResult } from '../types'

interface ToolCardProps {
  tool: ToolCallResult
}

export function ToolCard({ tool }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`tool-card ${expanded ? 'expanded' : ''}`}>
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-name">{tool.tool}</span>
        <span className="tool-status">{expanded ? '▼' : '▶'}</span>
      </div>
      <div className="tool-card-body">
        <div className="tool-args">
          <div className="tool-args-title">Arguments:</div>
          <pre>{JSON.stringify(tool.args, null, 2)}</pre>
        </div>
        <div className="tool-output">
          <div className="tool-output-title">Output:</div>
          <pre>{tool.output || '(empty)'}</pre>
        </div>
      </div>
    </div>
  )
}
