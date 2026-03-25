import { describe, expect, it } from 'bun:test';
import { LLMProvider, OpenAIProvider, AnthropicProvider, createProvider } from './index';

describe('LLM Index Exports', () => {
	it('should export LLMProvider', () => {
		expect(LLMProvider).toBeDefined();
	});

	it('should export OpenAIProvider', () => {
		expect(OpenAIProvider).toBeDefined();
		expect(new OpenAIProvider()).toBeInstanceOf(LLMProvider);
	});

	it('should export AnthropicProvider', () => {
		expect(AnthropicProvider).toBeDefined();
		expect(new AnthropicProvider()).toBeInstanceOf(LLMProvider);
	});
});

describe('createProvider', () => {
	it('should create OpenAI provider', () => {
		const provider = createProvider('openai', 'gpt-4o');
		expect(provider).toBeInstanceOf(OpenAIProvider);
		expect(provider.name).toBe('openai');
		expect(provider.model).toBe('gpt-4o');
	});

	it('should create Anthropic provider', () => {
		const provider = createProvider('anthropic', 'claude-3-5-sonnet');
		expect(provider).toBeInstanceOf(AnthropicProvider);
		expect(provider.name).toBe('anthropic');
		expect(provider.model).toBe('claude-3-5-sonnet');
	});

	it('should use default models when not specified', () => {
		const openaiProvider = createProvider('openai');
		expect(openaiProvider.model).toBe('gpt-4o');

		const anthropicProvider = createProvider('anthropic');
		expect(anthropicProvider.model).toBe('claude-3-5-sonnet-20241022');
	});

	it('should throw for unknown provider', () => {
		expect(() => {
			// @ts-ignore - testing runtime behavior
			createProvider('unknown');
		}).toThrow('Unknown provider: unknown');
	});
});
