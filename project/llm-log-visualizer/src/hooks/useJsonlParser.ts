import { useCallback } from 'react'
import type { Turn, AnyEvent, JsonlFile } from '../types'

export function useJsonlParser() {
  const parseContent = useCallback((content: string): JsonlFile => {
    const lines = content.trim().split('\n')
    const events: AnyEvent[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        events.push(JSON.parse(line))
      } catch (e) {
        console.warn('Failed to parse line:', line)
      }
    }

    const turns = buildTurns(events)

    return {
      filename: '',
      filepath: '',
      turns,
      cachedViews: [],
      modifiedAt: new Date(),
    }
  }, [])

  const buildTurns = (events: AnyEvent[]): Turn[] => {
    const turns: Turn[] = []
    let currentTurn: Turn | null = null

    for (const event of events) {
      if (event.type === 'turn_start') {
        if (currentTurn) {
          turns.push(currentTurn)
        }
        currentTurn = {
          turnStart: event as any,
          events: [],
          turnComplete: null,
        }
      } else if (event.type === 'turn_complete') {
        if (currentTurn) {
          currentTurn.turnComplete = event as any
          turns.push(currentTurn)
          currentTurn = null
        }
      } else if (currentTurn) {
        currentTurn.events.push(event)
      }
    }

    if (currentTurn) {
      turns.push(currentTurn)
    }

    return turns
  }

  return { parseContent }
}
