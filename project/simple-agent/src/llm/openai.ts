import { createOpenAI } from '@ai-sdk/openai';
import type { Message, ChatOptions, ChatResponse } from './types';
import { LLMProvider } from './base';

/**
 * OpenAI provider using the AI SDK.
 */
export class OpenAIProvider extends LLMProvider {
	readonly name = 'openai';
	readonly model: string;
	private readonly openai: ReturnType<typeof createOpenAI>;

	constructor(model: string = 'gpt-4o') {
		super();
		this.model = model;
		this.openai = createOpenAI({});
	}

	supportsTools(): boolean {
		return true;
	}

	async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
		const { generateText } = await import('ai');

		const toolChoice = options?.toolChoice;

		const result = await generateText({
			model: this.openai(this.model),
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

		return {
			content: result.text || '',
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
