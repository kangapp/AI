import { describe, test, expect, vi } from 'bun:test';
import { z } from 'zod';
import { loop } from './loop';
import type { LLMProvider } from '../llm';
import type { Tool } from '../tools/types';

// Mock LLM provider for testing
class MockLLMProvider implements LLMProvider {
  name = 'mock';
  model = 'mock-model';

  private responses: Awaited<ReturnType<LLMProvider['chat']>>[];
  private callCount = 0;

  constructor(responses: Awaited<ReturnType<LLMProvider['chat']>>[]) {
    this.responses = responses;
  }

  supportsTools(): boolean {
    return true;
  }

  async chat() {
    const response = this.responses[this.callCount] || {
      content: 'No more responses',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
    this.callCount++;
    return response;
  }
}

// Mock tool for testing
const createMockTool = (name: string, execute: Function): Tool => ({
  name,
  description: `Mock tool: ${name}`,
  parameters: z.object({}),
  execute: execute as any,
});

describe('loop', () => {
  test('yields message when no tool calls', async () => {
    const llm = new MockLLMProvider([
      {
        content: 'Final response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);

    const events = { emit: vi.fn() };
    const messages: any[] = [{ role: 'user', content: 'Hello' }];

    const results: any[] = [];
    for await (const result of loop(llm, [], messages, events as any)) {
      results.push(result);
    }

    expect(results.length).toBe(2); // step result + done
    expect(results[0].type).toBe('message');
    expect(results[0].content).toBe('Final response');
    expect(results[1].type).toBe('done');
  });

  test('loops when tool calls are present', async () => {
    let callCount = 0;
    const tools = [
      createMockTool('bash', async () => {
        callCount++;
        return { success: true, result: `call ${callCount}` };
      }),
    ];

    // First call returns tool call, second call returns final response
    const llm = new MockLLMProvider([
      {
        content: 'Using tool',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toolCalls: [{ id: 'call_1', name: 'bash', arguments: { command: 'ls' } }],
      },
      {
        content: 'Done',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);

    const events = { emit: vi.fn() };
    const messages: any[] = [{ role: 'user', content: 'Run command' }];

    const results: any[] = [];
    for await (const result of loop(llm, tools, messages, events as any)) {
      results.push(result);
    }

    expect(callCount).toBe(1);
    expect(results.length).toBe(3); // tool-call + tool-result + done

    // Verify tool result was added to messages
    expect(messages.length).toBe(4); // original + assistant + tool result + final assistant
  });

  test('respects maxIterations', async () => {
    const tools = [
      createMockTool('bash', async () => ({
        success: true,
        result: 'output',
      })),
    ];

    // Mock has 4 responses (3 with tool calls + 1 without to stop)
    // With maxIterations=3, we get 3 iterations + done = 4 results
    const llm = new MockLLMProvider([
      {
        content: 'Using tool',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toolCalls: [{ id: 'call_1', name: 'bash', arguments: {} }],
      },
      {
        content: 'Using tool',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toolCalls: [{ id: 'call_2', name: 'bash', arguments: {} }],
      },
      {
        content: 'Using tool',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toolCalls: [{ id: 'call_3', name: 'bash', arguments: {} }],
      },
      {
        content: 'Done',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);

    const events = { emit: vi.fn() };
    const messages: any[] = [{ role: 'user', content: 'Run command' }];

    const results: any[] = [];
    for await (const result of loop(llm, tools, messages, events as any, { maxIterations: 3 })) {
      results.push(result);
    }

    // Should hit maxIterations and stop
    expect(results.length).toBe(4); // 3 tool-calls + done
    expect(results[3].type).toBe('done');
    expect(results[3].metadata?.iterations).toBe(3);
  });

  test('emits events during execution', async () => {
    const llm = new MockLLMProvider([
      {
        content: 'Final',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);

    const emit = vi.fn();
    const events = { emit };
    const messages: any[] = [{ role: 'user', content: 'Hello' }];

    for await (const _ of loop(llm, [], messages, events as any)) {
      // consume the generator
    }

    expect(emit).toHaveBeenCalledWith('iteration:start', expect.any(Object));
    expect(emit).toHaveBeenCalledWith('iteration:end', expect.any(Object));
    expect(emit).toHaveBeenCalledWith('loop:complete', expect.any(Object));
  });

  test('handles multiple tool calls in sequence', async () => {
    let callCount = 0;
    const tools = [
      createMockTool('read', async () => {
        callCount++;
        return { success: true, result: `read ${callCount}` };
      }),
    ];

    const llm = new MockLLMProvider([
      // First iteration: tool call
      {
        content: 'Reading',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toolCalls: [{ id: 'call_1', name: 'read', arguments: { path: '/a' } }],
      },
      // Second iteration: tool call again
      {
        content: 'Reading again',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toolCalls: [{ id: 'call_2', name: 'read', arguments: { path: '/b' } }],
      },
      // Third iteration: no tool calls
      {
        content: 'Done',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ]);

    const events = { emit: vi.fn() };
    const messages: any[] = [{ role: 'user', content: 'Read files' }];

    const results: any[] = [];
    for await (const result of loop(llm, tools, messages, events as any)) {
      results.push(result);
    }

    expect(callCount).toBe(2);
    expect(results.length).toBe(4); // 2 tool-calls + 2 tool-results + done
  });
});
