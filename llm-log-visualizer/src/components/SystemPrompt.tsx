import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { Turn } from '../types'
import { estimateTokens, formatTokens } from '../utils/tokenizer'

interface SystemPromptProps {
  turn: Turn
}

export function SystemPrompt({ turn }: SystemPromptProps) {
  const systemText = turn.turnStart.system.join('\n')
  const tokens = estimateTokens(systemText)

  return (
    <div className="system-column">
      <div className="column-header">
        System Prompt ({formatTokens(tokens)} tokens)
      </div>
      <div className="column-content">
        <div className="system-content">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {systemText}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
