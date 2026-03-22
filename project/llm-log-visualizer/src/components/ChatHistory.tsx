import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface ChatHistoryProps {
  turn: Turn
}

export function ChatHistory({ turn }: ChatHistoryProps) {
  const messages = turn.turnStart.messages || []
  const fullText = turn.turnComplete?.fullText || turn.events
    .filter(e => e.type === 'text')
    .map(e => (e as any).content)
    .join('')

  const tokens = estimateTokens(fullText)

  return (
    <div className="chat-column">
      <div className="column-header">
        Chat History ({formatTokens(tokens)} tokens)
      </div>
      <div className="column-content">
        <div className="chat-content">
          {messages.map((msg: any, idx: number) => {
            const role = msg.role || 'assistant'
            const content = typeof msg.content === 'string'
              ? msg.content
              : msg.content?.map((c: any) => c.text || '').join('') || ''

            return (
              <div key={idx} className={`chat-message ${role}`}>
                <div className="chat-role">{role}</div>
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {content}
                </ReactMarkdown>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
