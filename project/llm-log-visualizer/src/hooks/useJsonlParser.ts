import { useCallback } from 'react'
import type {
  Turn,
  AnyEvent,
  JsonlFile,
  CachedView,
  Message,
  ToolCall,
  ReasoningEvent,
  AgentSwitchEvent,
  RetryEvent,
  FileReferenceEvent,
  SubtaskStartEvent,
  PermissionRequestEvent,
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
      // 累积 messages（每个 turn 的 user message，按 turn 倒序）
      const messages: Message[] = []
      for (let i = index; i >= 0; i--) {
        const userMsgs = turns[i].turnStart.messages.filter(m => m.role === 'user')
        messages.push(...userMsgs)
      }

      // 累积 toolCalls（按 turn 倒序，turn 内按时间正序）
      // 从 turnComplete.toolCalls 和 events 中的 tool_call_result 收集
      const toolCalls: ToolCall[] = []
      const toolTurnCounts: number[] = []  // 每个 turn 的 tool 数量

      // 累积各类事件（按 turn 倒序，turn 内按时间正序）
      const agentSwitches: AgentSwitchEvent[] = []
      const retries: RetryEvent[] = []
      const fileReferences: FileReferenceEvent[] = []
      const subtaskStarts: SubtaskStartEvent[] = []
      const permissionRequests: PermissionRequestEvent[] = []
      const reasoningEvents: ReasoningEvent[] = []

      for (let i = index; i >= 0; i--) {
        // 从 turnComplete.toolCalls 获取（已合并的最终结果）
        const tcFromComplete = turns[i].turnComplete?.toolCalls || []
        // 从 events 中的 tool_call_result 获取（原始事件）
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

        // 收集各类事件
        for (const event of turns[i].events) {
          switch (event.type) {
            case 'reasoning':
              reasoningEvents.push(event as ReasoningEvent)
              break
            case 'agent_switch':
              agentSwitches.push(event as AgentSwitchEvent)
              break
            case 'retry':
              retries.push(event as RetryEvent)
              break
            case 'file_reference':
              fileReferences.push(event as FileReferenceEvent)
              break
            case 'subtask_start':
              subtaskStarts.push(event as SubtaskStartEvent)
              break
            case 'permission_request':
              permissionRequests.push(event as PermissionRequestEvent)
              break
          }
        }
      }

      return {
        currentTurn: turn.turnStart.turn,
        systemPrompt: turn.turnStart.system,
        messages,
        toolCalls,
        toolTurnCounts,
        reasoning: reasoningEvents,
        turnComplete: turn.turnComplete,
        agentSwitches,
        retries,
        fileReferences,
        subtaskStarts,
        permissionRequests,
      }
    })
  }

  return { parseContent }
}
