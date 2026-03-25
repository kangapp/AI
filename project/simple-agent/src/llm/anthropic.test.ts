import { describe, expect, it } from 'bun:test';
import { AnthropicProvider } from './anthropic';

describe('AnthropicProvider', () => {
	it('should have correct name', () => {
		const provider = new AnthropicProvider('claude-3-5-sonnet');
		expect(provider.name).toBe('anthropic');
	});

	it('should use default model if not specified', () => {
		const provider = new AnthropicProvider();
		expect(provider.model).toBe('claude-3-5-sonnet-20241022');
	});

	it('should support tools', () => {
		const provider = new AnthropicProvider();
		expect(provider.supportsTools()).toBe(true);
	});

	it('should create provider with custom model', () => {
		const provider = new AnthropicProvider('claude-opus-4-20250109');
		expect(provider.model).toBe('claude-opus-4-20250109');
		expect(provider.name).toBe('anthropic');
	});
});
