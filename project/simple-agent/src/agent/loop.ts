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

// ============================================================================
// Phase Detection Constants (Magic Strings)
// ============================================================================

const PHASE_COMPLETE_MARKERS = ['**__PHASE: COMPLETE__**', '**__REVIEW_COMPLETE__**'];
const PHASE_ANALYZING_MARKERS = ['**__PHASE: ANALYZING__**'];
const PHASE_COLLECTING_MARKERS = ['**__PHASE: COLLECTING__**'];

const REPORT_STRUCTURE_MARKERS = [
  '## 总结',
  '## Summary',
  '### 严重问题',
  '### 建议改进',
  '# Code Review',
  '# Code Review Report',
];

// ============================================================================
// Types and Helper Functions
// ============================================================================

type Phase = 'collecting' | 'analyzing' | 'complete' | 'unknown';

/**
 * 从 AI 的 message content 中提取阶段信息
 */
function detectPhase(content: string): Phase {
  if (PHASE_COMPLETE_MARKERS.some(marker => content.includes(marker))) {
    return 'complete';
  }
  if (PHASE_ANALYZING_MARKERS.some(marker => content.includes(marker))) {
    return 'analyzing';
  }
  if (PHASE_COLLECTING_MARKERS.some(marker => content.includes(marker))) {
    return 'collecting';
  }
  return 'unknown';
}

/**
 * 检查内容是否包含报告结构（作为备用完成判断）
 */
function containsReportStructure(content: string): boolean {
  return REPORT_STRUCTURE_MARKERS.some(marker => content.includes(marker));
}

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
      // No tool calls - check phase to decide whether to continue or terminate
      if (stepResult.type === 'message') {
        const content = stepResult.content || '';
        const phase = detectPhase(content);

        if (phase === 'complete') {
          // AI 宣布完成，终止 loop
          hasToolCalls = false;
          events.emit('loop:phase', { phase: 'complete' });
        } else if (phase === 'unknown') {
          // 有内容但无明确阶段
          if (content.length > 200 && containsReportStructure(content)) {
            // 内容较长且包含报告结构，视为完成
            hasToolCalls = false;
            events.emit('loop:phase', { phase: 'complete', reason: 'report_structure' });
          } else if (content.trim().length > 0) {
            // 有实际内容（即使是短响应），视为最终回复
            // 不再等待 tool calls，终止循环
            hasToolCalls = false;
            events.emit('loop:phase', { phase: 'complete', reason: 'short_response' });
          } else {
            // 空内容或纯 whitespace，继续等待
            hasToolCalls = true;
            events.emit('loop:waiting', { reason: 'empty_content' });
          }
        } else {
          // collecting 或 analyzing，继续循环
          hasToolCalls = true;
          events.emit('loop:phase', { phase });
        }

        // Add assistant message to conversation
        messages.push({
          role: 'assistant',
          content: content,
        });
      } else {
        // 未知类型，终止 loop
        hasToolCalls = false;
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
