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

export interface AgentSwitchEvent {
  type: "agent_switch"
  turn: number
  agent: string
  source: string
}

export interface RetryEvent {
  type: "retry"
  turn: number
  attempt: number
  error: string
}

export interface FileReferenceEvent {
  type: "file_reference"
  turn: number
  mime: string
  filename: string
  url: string
}

export interface SubtaskStartEvent {
  type: "subtask_start"
  turn: number
  sessionID: string
  shortUUID: string
  parentShortUUID: string
  prompt: string
  description: string
  agent: string
  model: { providerID: string; modelID: string }
  command: string
}

export interface PermissionRequestEvent {
  type: "permission_request"
  turn: number
  permissionType: string
  pattern: string
  title: string
  status: string
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
  | AgentSwitchEvent
  | RetryEvent
  | FileReferenceEvent
  | SubtaskStartEvent
  | PermissionRequestEvent

export interface Turn {
  turnStart: TurnStart
  events: AnyEvent[]
  turnComplete: TurnComplete | null
}

// Unified chat item type for chronological display
export type ChatItem =
  | { kind: 'user'; content: string; contentType?: 'text' | 'file' | 'command' | 'reference'; turn: number; filename?: string }
  | { kind: 'assistant'; content: string; turn: number }
  | { kind: 'reasoning'; content: string; turn: number }
  | { kind: 'agent_switch'; agent: string; turn: number }
  | { kind: 'retry'; attempt: number; error: string; turn: number }
  | { kind: 'file_reference'; filename: string; mime: string; url: string; turn: number }
  | { kind: 'subtask_start'; description: string; turn: number }
  | { kind: 'permission_request'; permissionType: string; title: string; status: string; turn: number }

export interface Message {
  role: string
  content: string | object
}

export interface CachedView {
  currentTurn: number
  systemPrompt: string[]
  chatItems: ChatItem[]
  toolCalls: ToolCall[]
  toolTurnCounts: number[]  // 每个 turn 的 tool 数量（从 Turn 1 到 currentTurn）
  turnComplete: TurnComplete | null
}

export interface JsonlFile {
  filename: string
  filepath: string
  turns: Turn[]
  cachedViews: CachedView[]
  modifiedAt: Date
}
