/**
 * Step mode for agent execution
 *
 * Performs a single LLM call and handles tool calls if present.
 * Does NOT loop - just one step.
 */

import type { Message, StepResult } from '../types';
import type { LLMProvider, ChatResponse } from '../llm';
import type { Tool, ToolContext } from '../tools/types';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Execute a single step of agent execution
 *
 * @param llm - The LLM provider
 * @param tools - Available tools
 * @param messages - Conversation messages
 * @param context - Tool execution context
 * @param signal - Optional abort signal
 * @returns StepResult with the LLM response or tool calls
 */
export async function step(
  llm: LLMProvider,
  tools: Tool[],
  messages: Message[],
  context: ToolContext = {},
  signal?: AbortSignal,
  maxTokens?: number
): Promise<StepResult> {
  // Call the LLM with current messages and tools
  const response = await llm.chat(messages, {
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters),
    })),
    signal,
    maxTokens,
  });

  // Check if the response has tool calls
  if (response.toolCalls && response.toolCalls.length > 0) {
    // Return tool-call result with the first tool call
    const toolCall = response.toolCalls[0];
    return {
      type: 'tool-call',
      content: JSON.stringify(toolCall),
      reasoning: response.reasoning,
      metadata: {
        toolCalls: response.toolCalls,
        toolName: toolCall.name,
        usage: response.usage,
      },
    };
  }

  // No tool calls - return the text response
  // But if content is empty or looks like a tool call JSON, treat it as empty message
  const content = response.content || '';
  if (!content || content.startsWith('{')) {
    // Empty response or malformed - this is unexpected
    return {
      type: 'message',
      content: '',
      reasoning: response.reasoning,
      metadata: {
        usage: response.usage,
      },
    };
  }

  return {
    type: 'message',
    content: content,
    reasoning: response.reasoning,
    metadata: {
      usage: response.usage,
    },
  };
}

/**
 * Execute tool calls and return results
 *
 * @param tools - Available tools registry
 * @param toolCalls - Tool calls to execute
 * @param context - Tool execution context
 * @returns Array of tool results
 */
export async function executeToolCalls(
  tools: Tool[],
  toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[],
  context: ToolContext = {}
): Promise<{ toolCallId: string; success: boolean; result?: string; error?: string }[]> {
  const results = [];

  for (const toolCall of toolCalls) {
    const tool = tools.find(t => t.name === toolCall.name);

    if (!tool) {
      results.push({
        toolCallId: toolCall.id,
        success: false,
        error: `Tool "${toolCall.name}" not found`,
      });
      continue;
    }

    try {
      const result = await tool.execute(toolCall.arguments, context);
      results.push({
        toolCallId: toolCall.id,
        success: result.success,
        result: result.result,
        error: result.error,
      });
    } catch (error) {
      results.push({
        toolCallId: toolCall.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
