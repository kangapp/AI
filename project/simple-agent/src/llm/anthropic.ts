import { createAnthropic } from '@ai-sdk/anthropic';
import type { Message, ChatOptions, ChatResponse } from './types';
import { LLMProvider } from './base';

/**
 * Anthropic provider using the AI SDK.
 */
export class AnthropicProvider extends LLMProvider {
	readonly name = 'anthropic';
	readonly model: string;
	private readonly anthropic: ReturnType<typeof createAnthropic>;

	constructor(model: string = 'claude-3-5-sonnet-20241022') {
		super();
		this.model = model;
		this.anthropic = createAnthropic({});
	}

	supportsTools(): boolean {
		return true;
	}

	async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
		const { generateText } = await import('ai');

		const toolChoice = options?.toolChoice;

		const result = await generateText({
			model: this.anthropic(this.model),
			messages: messages as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			tools: options?.tools as any,
			toolChoice:
				toolChoice === 'auto'
					? 'auto'
					: toolChoice === 'none'
						? 'none'
						: toolChoice && 'type' in toolChoice
							? { type: 'tool' as const, toolName: toolChoice.name }
							: undefined,
			temperature: options?.temperature,
			maxOutputTokens: options?.maxTokens,
		});

		// Extract reasoning from provider metadata if available
		const reasoning = (result as any).reasoning;

		return {
			content: result.text || '',
			reasoning,
			toolCalls: result.toolCalls?.map((tc: any) => ({
				id: tc.toolCallId,
				name: tc.toolName,
				arguments: tc.args as Record<string, unknown>,
			})),
			usage: {
				promptTokens: result.usage?.inputTokens ?? 0,
				completionTokens: result.usage?.outputTokens ?? 0,
				totalTokens: result.usage?.totalTokens ?? 0,
			},
		};
	}
}
