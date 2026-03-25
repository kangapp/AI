import type { Message, Tool, ToolChoice } from './types';
import type { CoreMessage, Tool as AiTool, ToolSet } from 'ai';
import { tool, jsonSchema } from 'ai';
import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider';

/**
 * Converts our Message type to AI SDK CoreMessage type.
 */
export function toAiMessage(msg: Message): CoreMessage {
	const { role, content, toolCallId, toolName } = msg;

	if (role === 'tool') {
		const toolOutput: LanguageModelV2ToolResultOutput = {
			type: 'text',
			value: content,
		};
		return {
			role: 'tool' as const,
			content: [
				{
					type: 'tool-result' as const,
					toolCallId: toolCallId!,
					toolName: toolName!,
					output: toolOutput,
				},
			],
		};
	}

	if (role === 'system') {
		return {
			role: 'system' as const,
			content: content,
		};
	}

	if (role === 'user') {
		return {
			role: 'user' as const,
			content: content,
		};
	}

	if (role === 'assistant') {
		return {
			role: 'assistant' as const,
			content: content,
		};
	}

	// Fallback for unknown roles
	return {
		role: 'user' as const,
		content: content,
	};
}

/**
 * Converts our Tool type to AI SDK Tool type.
 */
export function toAiTool(t: Tool): AiTool {
	return tool({
		name: t.name,
		description: t.description || '',
		inputSchema: jsonSchema(t.parameters as Record<string, unknown>),
	});
}

/**
 * Converts an array of Tool to a ToolSet (record).
 */
export function toAiToolSet(tools: Tool[] | undefined): ToolSet | undefined {
	if (!tools || tools.length === 0) {
		return undefined;
	}
	const toolSet: ToolSet = {};
	for (const t of tools) {
		toolSet[t.name] = toAiTool(t);
	}
	return toolSet;
}

/**
 * Converts our ToolChoice type to AI SDK toolChoice type.
 */
export function toAiToolChoice(
	toolChoice: ToolChoice | undefined,
	_availableTools: ToolSet | undefined
):
	| 'auto'
	| 'none'
	| 'required'
	| { type: 'tool'; toolName: string }
	| undefined {
	if (!toolChoice) {
		return undefined;
	}

	if (toolChoice === 'auto') {
		return 'auto';
	}

	if (toolChoice === 'none') {
		return 'none';
	}

	if (toolChoice && 'type' in toolChoice) {
		return { type: 'tool' as const, toolName: toolChoice.name };
	}

	return undefined;
}
