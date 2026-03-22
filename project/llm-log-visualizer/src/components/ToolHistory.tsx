import type { Turn } from '../types'
import { ToolCard } from './ToolCard'

interface ToolHistoryProps {
  turn: Turn
}

export function ToolHistory({ turn }: ToolHistoryProps) {
  const toolResults = turn.events.filter(
    (e): e is any => e.type === 'tool_call_result'
  )

  return (
    <div className="tool-column">
      <div className="column-header">
        Tool History ({toolResults.length} calls)
      </div>
      <div className="column-content">
        <div className="tool-content">
          {toolResults.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No tool calls in this turn
            </div>
          ) : (
            toolResults.map((tool, idx) => (
              <ToolCard key={tool.id || idx} tool={tool} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
