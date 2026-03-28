// src/server/types.ts

export interface AgentRunRequest {
  sessionId?: string;
  prompt: string;
  mode: 'loop' | 'step';
  model?: string;
  provider?: 'openai' | 'anthropic';
  agentType?: 'simple' | 'code-review';
}

export interface Session {
  id: string;
  createdAt: string;
  lastMessage?: string;
}

export type WSEvent =
  | { type: 'agent:start'; data: { sessionId: string } }
  | { type: 'message'; data: { content: string; role: 'user' | 'assistant' } }
  | { type: 'tool:call'; data: { tool: string; params: unknown } }
  | { type: 'tool:result'; data: { tool: string; result: string } }
  | { type: 'iteration:start'; data: { iteration: number } }
  | { type: 'iteration:end'; data: { iteration: number; promptTokens: number; completionTokens: number } }
  | { type: 'agent:complete'; data: { finalMessage: string } }
  | { type: 'error'; data: { message: string } };
