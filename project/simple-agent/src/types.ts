/**
 * Global type definitions for simple-agent
 */

// Message types
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}

// Tool-related types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: string;
  error?: string;
}

// Agent configuration
export interface AgentConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
  baseURL?: string;
  systemPrompt?: string;
  maxIterations?: number;
  tools?: ToolDefinition[];
  mcpServers?: MCPServerConfig[];
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// Agent mode
export type AgentMode = 'step' | 'loop';

// Step result for agent execution
export interface StepResult {
  type: 'message' | 'tool-call' | 'tool-result' | 'error' | 'done';
  content?: string;
  metadata?: Record<string, unknown>;
}
