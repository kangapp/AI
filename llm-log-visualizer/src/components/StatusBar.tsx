import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface StatusBarProps {
  turn: Turn
  currentTurn: number
  totalTurns: number
}

export function StatusBar({ turn, currentTurn, totalTurns }: StatusBarProps) {
  const systemTokens = estimateTokens(turn.turnStart.system.join('\n'))

  const chatText = turn.turnComplete?.fullText ||
    turn.events.filter(e => e.type === 'text').map(e => (e as any).content).join('')
  const chatTokens = estimateTokens(chatText)

  const toolCount = turn.events.filter(e => e.type === 'tool_call_result').length

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Sysprompt:</span>
        <span>{formatTokens(systemTokens)}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Chat:</span>
        <span>{formatTokens(chatTokens)}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Tools:</span>
        <span>{toolCount}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Turn:</span>
        <span>{currentTurn} / {totalTurns}</span>
      </div>
    </div>
  )
}
