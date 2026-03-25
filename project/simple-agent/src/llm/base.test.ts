import { describe, expect, it } from 'bun:test';
import { LLMProvider } from './base';
import type { Message, ChatOptions, ChatResponse } from './types';

// Concrete implementation for testing
class TestProvider extends LLMProvider {
	readonly name = 'test';
	readonly model = 'test-model';

	async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
		return {
			content: 'test response',
			usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
		};
	}

	supportsTools(): boolean {
		return true;
	}
}

describe('LLMProvider', () => {
	it('should allow creating concrete implementations', () => {
		const provider = new TestProvider();
		expect(provider.name).toBe('test');
		expect(provider.model).toBe('test-model');
	});

	it('should implement chat method', async () => {
		const provider = new TestProvider();
		const messages: Message[] = [{ role: 'user', content: 'hello' }];
		const response = await provider.chat(messages);
		expect(response.content).toBe('test response');
	});

	it('should implement supportsTools method', () => {
		const provider = new TestProvider();
		expect(provider.supportsTools()).toBe(true);
	});

	it('should return usage statistics', async () => {
		const provider = new TestProvider();
		const response = await provider.chat([{ role: 'user', content: 'hi' }]);
		expect(response.usage.promptTokens).toBe(1);
		expect(response.usage.completionTokens).toBe(1);
		expect(response.usage.totalTokens).toBe(2);
	});
});
