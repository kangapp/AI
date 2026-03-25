import { createOpenAI } from '@ai-sdk/openai';
import type { Message, ChatOptions, ChatResponse } from './types';
import { LLMProvider } from './base';
import { toAiMessage, toAiToolSet, toAiToolChoice } from './converters';

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
		try {
			const { generateText } = await import('ai');

			const aiMessages = messages.map(toAiMessage);
			const aiTools = toAiToolSet(options?.tools);
			const aiToolChoice = toAiToolChoice(options?.toolChoice, aiTools);

			const result = await generateText({
				model: this.openai(this.model),
				messages: aiMessages,
				tools: aiTools,
				toolChoice: aiToolChoice,
				temperature: options?.temperature,
				maxOutputTokens: options?.maxTokens,
			});

			return {
				content: result.text || '',
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
