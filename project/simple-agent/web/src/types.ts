// web/src/types.ts
// 共享的 WebSocket 事件类型

export type WSEvent =
  | { type: 'agent:start'; data: { sessionId: string } }
  | { type: 'message'; data: { content: string; role: 'user' | 'assistant' } }
  | { type: 'tool:call'; data: { tool: string; params: unknown } }
  | { type: 'tool:result'; data: { tool: string; result: string } }
  | { type: 'iteration:start'; data: { iteration: number } }
  | { type: 'iteration:end'; data: { iteration: number; promptTokens: number; completionTokens: number } }
  | { type: 'agent:complete'; data: { finalMessage: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'reasoning'; data: { content: string } };
