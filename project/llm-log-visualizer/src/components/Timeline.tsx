import type { Turn } from '../types'

interface TimelineProps {
  turns: Turn[]
  currentTurn: number
  onSelectTurn: (turn: number) => void
}

export function Timeline({ turns, currentTurn, onSelectTurn }: TimelineProps) {
  return (
    <div className="timeline">
      {turns.map((turn) => (
        <div
          key={turn.turnStart.turn}
          className={`timeline-item ${turn.turnStart.turn === currentTurn ? 'active' : ''}`}
          onClick={() => onSelectTurn(turn.turnStart.turn)}
        >
          <div className="timeline-dot" />
          <span>Turn {turn.turnStart.turn}</span>
        </div>
      ))}
    </div>
  )
}
