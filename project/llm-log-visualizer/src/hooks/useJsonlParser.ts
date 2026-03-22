import { useCallback } from 'react'
import type { Turn, AnyEvent, JsonlFile, CachedView, Message, ToolCall } from '../types'

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
    const cachedViews = buildCachedViews(turns)

    return {
      filename: '',
      filepath: '',
      turns,
      cachedViews,
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

  const buildCachedViews = (turns: Turn[]): CachedView[] => {
    return turns.map((turn, index) => {
      // 累积 messages（每个 turn 的 user message，按 turn 倒序）
      const messages: Message[] = []
      for (let i = index; i >= 0; i--) {
        const userMsgs = turns[i].turnStart.messages.filter(m => m.role === 'user')
        messages.push(...userMsgs)
      }

      // 累积 toolCalls（按 turn 倒序，turn 内按时间正序）
      const toolCalls: ToolCall[] = []
      for (let i = index; i >= 0; i--) {
        const tc = turns[i].turnComplete?.toolCalls || []
        toolCalls.push(...tc)
      }

      return {
        currentTurn: turn.turnStart.turn,
        systemPrompt: turn.turnStart.system,
        messages,
        toolCalls,
        reasoning: turn.turnComplete?.reasoning || [],
        turnComplete: turn.turnComplete
      }
    })
  }

  return { parseContent }
}
