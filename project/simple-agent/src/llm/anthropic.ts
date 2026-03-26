import { createAnthropic } from '@ai-sdk/anthropic';
import type { Message, ChatOptions, ChatResponse } from './types';
import { LLMProvider } from './base';
import { toAiMessage, toAiToolSet, toAiToolChoice } from './converters';

/**
 * Anthropic provider using the AI SDK.
 */
export class AnthropicProvider extends LLMProvider {
	readonly name = 'anthropic';
	readonly model: string;
	readonly baseURL?: string;
	private readonly anthropic: ReturnType<typeof createAnthropic>;

	constructor(model: string = 'claude-3-5-sonnet-20241022', baseURL?: string) {
		super();
		this.model = model;
		this.baseURL = baseURL;
		this.anthropic = createAnthropic({
			baseURL: baseURL || undefined,
		});
	}

	supportsTools(): boolean {
		return true;
	}

	async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
		try {
			const { generateText } = await import('ai');

			const aiMessages = messages.map(toAiMessage);
			const aiTools = toAiToolSet(options?.tools);
			const aiToolChoice = toAiToolChoice(options?.toolChoice, aiTools);

			const result = await generateText({
				model: this.anthropic(this.model),
				messages: aiMessages,
				tools: aiTools,
				toolChoice: aiToolChoice,
				temperature: options?.temperature,
				maxOutputTokens: options?.maxTokens,
			});

			// Note: reasoningText is available for providers that support it (e.g. Anthropic)
			// OpenAI doesn't support reasoning, so reasoningText will be undefined
			const reasoning = result.reasoningText;

			return {
				content: result.text || '',
				reasoning,
				toolCalls: result.toolCalls?.map((tc) => ({
					id: tc.toolCallId,
					name: tc.toolName,
					arguments: tc.input as Record<string, unknown>,
				})),
				usage: {
					promptTokens: result.usage?.inputTokens ?? 0,
					completionTokens: result.usage?.outputTokens ?? 0,
					totalTokens: result.usage?.totalTokens ?? 0,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`LLM chat failed: ${message}`);
		}
	}
}
