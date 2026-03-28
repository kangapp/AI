/**
 * Loop mode for agent execution
 *
 * Loops until maxIterations or no more tool calls.
 * Each iteration calls step() and yields StepResults.
 */

import type { Message, StepResult } from '../types';
import type { LLMProvider } from '../llm';
import type { Tool, ToolContext } from '../tools/types';
import { step, executeToolCalls } from './step';

export interface LoopOptions {
  maxIterations?: number;
  context?: ToolContext;
  signal?: AbortSignal;
  maxTokens?: number;
}

/**
 * Execute agent in loop mode
 *
 * @param llm - The LLM provider
 * @param tools - Available tools
 * @param messages - Conversation messages (will be mutated)
 * @param events - Event emitter for observability
 * @param options - Loop options
 * @yields StepResult for each iteration
 */
export async function* loop(
  llm: LLMProvider,
  tools: Tool[],
  messages: Message[],
  events: { emit: (event: string, data: unknown) => void },
  options: LoopOptions = {}
): AsyncGenerator<StepResult> {
  const maxIterations = options.maxIterations ?? 10;
  const context = options.context ?? {};

  let iteration = 0;
  let hasToolCalls = true;

  while (iteration < maxIterations && hasToolCalls) {
    // Check for abort signal
    if (options.signal?.aborted) {
      throw new Error('Agent execution aborted');
    }

    iteration++;

    // Emit iteration start event
    events.emit('iteration:start', { iteration, maxIterations });

    // Execute one step
    const stepResult = await step(llm, tools, messages, context, options.signal, options.maxTokens);
    yield stepResult;

    // Handle tool calls if present
    if (stepResult.type === 'tool-call' && stepResult.metadata?.toolCalls) {
      const toolCalls = stepResult.metadata.toolCalls as {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
      }[];

      // Emit tool call event
      events.emit('tool:call', { toolCalls });

      // Execute tool calls
      const toolResults = await executeToolCalls(tools, toolCalls, context);

      // Emit tool result event
      events.emit('tool:result', { results: toolResults });

      // Yield tool result to caller
      yield {
        type: 'tool-result' as const,
        content: JSON.stringify(toolResults),
        metadata: { results: toolResults },
      };

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: stepResult.content || '',
        toolCalls: toolCalls,
      });

      // Add tool result messages
      // For providers that don't support tool_result format (like MiniMax),
      // use role: 'user' with text content instead
      const llmWithBaseURL = llm as { baseURL?: string };
      const useTextFormat = llmWithBaseURL?.baseURL?.includes('minimax');

      for (const result of toolResults) {
        const toolCall = toolCalls.find(tc => tc.id === result.toolCallId);
        const resultContent = result.success ? result.result || '' : result.error || 'Tool execution failed';

        if (useTextFormat) {
          // MiniMax: use text format instead of tool_result
          messages.push({
            role: 'user' as const,
            content: `[${toolCall?.name || 'tool'} result] ${resultContent}`,
          });
        } else {
          // Standard format for other providers
          messages.push({
            role: 'tool' as const,
            content: resultContent,
            toolCallId: result.toolCallId,
            toolName: toolCall?.name,
          });
        }
      }

      // Continue looping - there might be more tool calls
      hasToolCalls = true;
    } else {
      // No tool calls - we're done
      hasToolCalls = false;

      // Add assistant message to conversation
      if (stepResult.type === 'message') {
        messages.push({
          role: 'assistant',
          content: stepResult.content || '',
        });
      }
    }

    // Emit iteration complete event
    events.emit('iteration:end', { iteration });
  }

  // Emit completion event
  events.emit('loop:complete', { iterations: iteration, hasToolCalls });

  yield {
    type: 'done',
    content: `Completed after ${iteration} iterations`,
    metadata: { iterations: iteration },
  };
}
