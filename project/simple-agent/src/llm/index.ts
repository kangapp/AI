import { LLMProvider } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
export type { Message, ChatOptions, ChatResponse, Tool, ToolCall, ToolChoice, Usage } from './types';

export { LLMProvider, OpenAIProvider, AnthropicProvider };

/**
 * Factory function to create a provider by name.
 */
export function createProvider(name: 'openai' | 'anthropic', model?: string, baseURL?: string): LLMProvider {
	switch (name) {
		case 'openai':
			return new OpenAIProvider(model, baseURL);
		case 'anthropic':
			return new AnthropicProvider(model);
		default:
			throw new Error(`Unknown provider: ${name}`);
	}
}
