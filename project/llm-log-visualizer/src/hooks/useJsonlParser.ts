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
        // Each content block becomes a separate chat item
        for (const msg of currentTurn.turnStart.messages) {
          if (msg.role === 'user') {
            const contentBlocks = extractContentBlocks(msg.content)
            for (const block of contentBlocks) {
              chatItems.push({
                kind: 'user',
                content: block.text,
                contentType: block.type,
                filename: block.filename,
                mime: block.mime,
                url: block.url,
                hasContent: block.hasContent,
                turn: currentTurn.turnStart.turn
              })
            }
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

  interface ContentBlock {
    type: 'text' | 'file' | 'command' | 'reference'
    text: string
    mime?: string
    filename?: string
    url?: string
    hasContent?: boolean
  }

  function cleanLineNumbers(text: string): string {
    // Remove "1: ", "2: ", etc. prefixes at the start of lines
    return text.replace(/^\d+:\s*/gm, '')
  }

  function extractContentFromTag(text: string): string {
    // Extract content from <content>...</content> tags
    const match = text.match(/<content>([\s\S]*?)<\/content>/)
    if (match) {
      return match[1].trim()
    }
    return text
  }

  function extractContentBlocks(content: any): ContentBlock[] {
    if (typeof content === 'string') {
      // Check if the string contains <content> tags
      const extracted = extractContentFromTag(content)
      if (extracted !== content) {
        return [{ type: 'text', text: cleanLineNumbers(extracted) }]
      }
      return [{ type: 'text', text: content }]
    }
    if (Array.isArray(content)) {
      return content.map((c: any) => {
        if (c.type === 'file') {
          let text = c.source?.text?.value || c.text || `[File: ${c.filename || c.url}]`
          // Check for <content> tags and extract content while preserving file info
          const extractedContent = extractContentFromTag(text)
          if (extractedContent !== text) {
            // Content was extracted from tags - return file block with content
            return {
              type: 'file' as const,
              text: cleanLineNumbers(extractedContent),
              mime: c.mime,
              filename: c.filename,
              url: c.url,
              hasContent: true,
            }
          }
          return {
            type: 'file' as const,
            text: cleanLineNumbers(text),
            mime: c.mime,
            filename: c.filename,
            url: c.url,
          }
        }
        if (c.type === 'command') {
          let text = c.text || ''
          // Extract content from tags if present
          text = extractContentFromTag(text)
          return {
            type: 'command' as const,
            text: cleanLineNumbers(text),
          }
        }
        // For text type, check for <content> tags
        let text = c.text || ''
        text = extractContentFromTag(text)
        return {
          type: 'text' as const,
          text: cleanLineNumbers(text),
        }
      })
    }
    if (content && typeof content === 'object') {
      if (content.text) {
        let text = content.text
        text = extractContentFromTag(text)
        return [{ type: 'text', text: cleanLineNumbers(text) }]
      }
      if (content.content) {
        let text = typeof content.content === 'string' ? content.content : JSON.stringify(content.content)
        text = extractContentFromTag(text)
        return [{ type: 'text', text: cleanLineNumbers(text) }]
      }
    }
    return [{ type: 'text', text: JSON.stringify(content) }]
  }

  return { parseContent }
}
