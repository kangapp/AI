import { describe, expect, it } from 'bun:test';
import { OpenAIProvider } from './openai';

describe('OpenAIProvider', () => {
	it('should have correct name', () => {
		const provider = new OpenAIProvider('gpt-4o');
		expect(provider.name).toBe('openai');
	});

	it('should use default model if not specified', () => {
		const provider = new OpenAIProvider();
		expect(provider.model).toBe('gpt-4o');
	});

	it('should support tools', () => {
		const provider = new OpenAIProvider();
		expect(provider.supportsTools()).toBe(true);
	});

	it('should create provider with custom model', () => {
		const provider = new OpenAIProvider('gpt-4-turbo');
		expect(provider.model).toBe('gpt-4-turbo');
		expect(provider.name).toBe('openai');
	});
});
