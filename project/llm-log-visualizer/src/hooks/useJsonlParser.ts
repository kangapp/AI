import { useCallback } from 'react'
import type {
  Turn,
  AnyEvent,
  JsonlFile,
  CachedView,
  ChatItem,
  ToolCall,
} from '../types'

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
      // Collect chat items in chronological order (older → newer)
      const chatItems: ChatItem[] = []

      for (let i = 0; i <= index; i++) {
        const currentTurn = turns[i]

        // 1. User messages from turnStart.messages
        for (const msg of currentTurn.turnStart.messages) {
          if (msg.role === 'user') {
            const content = extractContent(msg.content)
            chatItems.push({ kind: 'user', content, turn: currentTurn.turnStart.turn })
          }
        }

        // 2. Events from turns[i].events (chronological order within turn)
        for (const event of currentTurn.events) {
          switch (event.type) {
            case 'reasoning':
              chatItems.push({ kind: 'reasoning', content: (event as any).content, turn: (event as any).turn })
              break
            case 'text':
              chatItems.push({ kind: 'assistant', content: (event as any).content, turn: (event as any).turn })
              break
            case 'agent_switch':
              chatItems.push({ kind: 'agent_switch', agent: (event as any).agent, turn: (event as any).turn })
              break
            case 'retry':
              chatItems.push({ kind: 'retry', attempt: (event as any).attempt, error: (event as any).error, turn: (event as any).turn })
              break
            case 'file_reference':
              chatItems.push({ kind: 'file_reference', filename: (event as any).filename, mime: (event as any).mime, url: (event as any).url, turn: (event as any).turn })
              break
            case 'subtask_start':
              chatItems.push({ kind: 'subtask_start', description: (event as any).description || (event as any).prompt?.substring(0, 100) || '', turn: (event as any).turn })
              break
            case 'permission_request':
              chatItems.push({ kind: 'permission_request', permissionType: (event as any).permissionType, title: (event as any).title || '', status: (event as any).status, turn: (event as any).turn })
              break
          }
        }
      }

      // Collect toolCalls and toolTurnCounts (unchanged)
      const toolCalls: ToolCall[] = []
      const toolTurnCounts: number[] = []

      for (let i = 0; i <= index; i++) {
        const tcFromComplete = turns[i].turnComplete?.toolCalls || []
        const tcFromEvents = turns[i].events
          .filter(e => e.type === 'tool_call_result')
          .map(e => ({
            id: (e as any).id || '',
            tool: (e as any).tool || '',
            args: (e as any).args || {},
            output: (e as any).output || null,
            title: (e as any).title || null,
          }))

        const turnToolCount = tcFromComplete.length + tcFromEvents.length
        toolTurnCounts.push(turnToolCount)
        toolCalls.push(...tcFromComplete, ...tcFromEvents)
      }

      return {
        currentTurn: turn.turnStart.turn,
        systemPrompt: turn.turnStart.system,
        chatItems,
        toolCalls,
        toolTurnCounts,
        turnComplete: turn.turnComplete,
      }
    })
  }

  function extractContent(content: any): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map((c: any) => c.text || '').join('')
    }
    if (content && typeof content === 'object') {
      if (content.text) return content.text
      if (content.content) return typeof content.content === 'string' ? content.content : JSON.stringify(content.content)
    }
    return JSON.stringify(content)
  }

  return { parseContent }
}
