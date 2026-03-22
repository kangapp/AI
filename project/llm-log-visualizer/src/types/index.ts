export type EventType =
  | "turn_start"
  | "turn_complete"
  | "llm_params"
  | "text"
  | "reasoning"
  | "tool_call_result"
  | "step_start"
  | "agent_switch"
  | "retry"
  | "file_reference"
  | "subtask_start"
  | "permission_request"

export interface TurnStart {
  type: "turn_start"
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string | null
  model: { providerID: string; modelID: string }
  agent: string
  system: string[]
  messages: any[]
}

export interface TurnComplete {
  type: "turn_complete"
  turn: number
  reason: string
  texts: string[]
  fullText: string
  reasoning: string[]
  toolCalls: ToolCall[]
  tools: Tool[]
}

export interface ToolCall {
  id: string
  tool: string
  args: any
  output: string | null
  title: string | null
}

export interface Tool {
  tool: string
  args: any
  output: string
  title: string
}

export interface LlmParams {
  type: "llm_params"
  turn: number
  temperature?: number
  topP?: number
  topK?: number
  options?: any
}

export interface TextEvent {
  type: "text"
  turn: number
  content: string
}

export interface ReasoningEvent {
  type: "reasoning"
  turn: number
  content: string
}

export interface ToolCallResult {
  type: "tool_call_result"
  turn: number
  id: string
  tool: string
  args: any
  output: string
  title: string
}

export type AnyEvent =
  | TurnStart
  | TurnComplete
  | LlmParams
  | TextEvent
  | ReasoningEvent
  | ToolCallResult

export interface Turn {
  turnStart: TurnStart
  events: AnyEvent[]
  turnComplete: TurnComplete | null
}

export interface Message {
  role: string
  content: string | object
}

export interface CachedView {
  currentTurn: number
  systemPrompt: string[]
  messages: Message[]
  toolCalls: ToolCall[]
  toolTurnCounts: number[]  // 每个 turn 的 tool 数量（从 Turn 1 到 currentTurn）
  reasoning: string[]
  turnComplete: TurnComplete | null
}

export interface JsonlFile {
  filename: string
  filepath: string
  turns: Turn[]
  cachedViews: CachedView[]
  modifiedAt: Date
}
