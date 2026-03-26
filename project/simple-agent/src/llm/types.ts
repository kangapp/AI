/**
 * Represents a single message in a conversation.
 */
export interface Message {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	name?: string;
	toolCallId?: string;
	toolName?: string;
}

/**
 * Tool definition for function calling.
 */
export interface Tool {
	name: string;
	description?: string;
	parameters: Record<string, unknown>;
}

/**
 * Tool choice configuration.
 */
export type ToolChoice = 'auto' | 'none' | { type: 'function'; name: string };

/**
 * Options for chat completion.
 */
export interface ChatOptions {
	tools?: Tool[];
	toolChoice?: ToolChoice;
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
}

/**
 * A tool call returned by the model.
 */
export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/**
 * Usage statistics from the model.
 */
export interface Usage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Response from chat completion.
 */
export interface ChatResponse {
	content: string;
	reasoning?: string;
	toolCalls?: ToolCall[];
	usage: Usage;
}
