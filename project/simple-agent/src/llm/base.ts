import type { Message, ChatOptions, ChatResponse } from './types';

/**
 * Abstract base class for LLM providers.
 */
export abstract class LLMProvider {
	/**
	 * The name of the provider (e.g., 'openai', 'anthropic').
	 */
	abstract readonly name: string;

	/**
	 * The model identifier used by this provider.
	 */
	abstract readonly model: string;

	/**
	 * The base URL for the API (optional).
	 */
	readonly baseURL?: string;

	/**
	 * Send a chat completion request.
	 */
	abstract chat(
		messages: Message[],
		options?: ChatOptions
	): Promise<ChatResponse>;

	/**
	 * Check if this provider supports tool calling.
	 */
	abstract supportsTools(): boolean;
}
