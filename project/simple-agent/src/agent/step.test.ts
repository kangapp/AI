import { describe, test, expect, vi } from 'bun:test';
import { step, executeToolCalls } from './step';
import type { LLMProvider } from '../llm';
import type { Tool } from '../tools/types';

// Mock LLM provider for testing
class MockLLMProvider implements LLMProvider {
  name = 'mock';
  model = 'mock-model';

  private response: ReturnType<LLMProvider['chat']>;

  constructor(response: Awaited<ReturnType<LLMProvider['chat']>>) {
    this.response = Promise.resolve(response);
  }

  supportsTools(): boolean {
    return true;
  }

  async chat() {
    return this.response;
  }
}

// Mock tool for testing
const createMockTool = (name: string, execute: Function): Tool => ({
  name,
  description: `Mock tool: ${name}`,
  parameters: {} as any,
  execute: execute as any,
});

describe('step', () => {
  test('returns message when no tool calls', async () => {
    const llm = new MockLLMProvider({
      content: 'Hello, world!',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    const result = await step(llm, [], []);

    expect(result.type).toBe('message');
    expect(result.content).toBe('Hello, world!');
    expect(result.metadata?.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  test('returns tool-call when LLM returns tool calls', async () => {
    const llm = new MockLLMProvider({
      content: '',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      toolCalls: [
        { id: 'call_1', name: 'bash', arguments: { command: 'ls' } },
      ],
    });

    const result = await step(llm, [], []);

    expect(result.type).toBe('tool-call');
    expect(result.metadata?.toolCalls).toEqual([
      { id: 'call_1', name: 'bash', arguments: { command: 'ls' } },
    ]);
  });

  test('handles multiple tool calls', async () => {
    const llm = new MockLLMProvider({
      content: '',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      toolCalls: [
        { id: 'call_1', name: 'bash', arguments: { command: 'ls' } },
        { id: 'call_2', name: 'read', arguments: { path: '/test' } },
      ],
    });

    const result = await step(llm, [], []);

    expect(result.type).toBe('tool-call');
    expect((result.metadata?.toolCalls as any[]).length).toBe(2);
  });
});

describe('executeToolCalls', () => {
  test('executes tool and returns result', async () => {
    const tools = [
      createMockTool('bash', async () => ({
        success: true,
        result: JSON.stringify({ stdout: 'test output', exitCode: 0 }),
      })),
    ];

    const toolCalls = [
      { id: 'call_1', name: 'bash', arguments: { command: 'echo test' } },
    ];

    const results = await executeToolCalls(tools, toolCalls);

    expect(results.length).toBe(1);
    expect(results[0].toolCallId).toBe('call_1');
    expect(results[0].success).toBe(true);
    expect(results[0].result).toContain('test output');
  });

  test('returns error when tool not found', async () => {
    const tools: Tool[] = [];

    const toolCalls = [
      { id: 'call_1', name: 'nonexistent', arguments: {} },
    ];

    const results = await executeToolCalls(tools, toolCalls);

    expect(results.length).toBe(1);
    expect(results[0].toolCallId).toBe('call_1');
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('not found');
  });

  test('handles tool execution error', async () => {
    const tools = [
      createMockTool('failing', async () => {
        throw new Error('Execution failed');
      }),
    ];

    const toolCalls = [
      { id: 'call_1', name: 'failing', arguments: {} },
    ];

    const results = await executeToolCalls(tools, toolCalls);

    expect(results.length).toBe(1);
    expect(results[0].toolCallId).toBe('call_1');
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Execution failed');
  });

  test('executes multiple tools in order', async () => {
    const callOrder: string[] = [];
    const tools = [
      createMockTool('first', async () => {
        callOrder.push('first');
        return { success: true, result: 'first result' };
      }),
      createMockTool('second', async () => {
        callOrder.push('second');
        return { success: true, result: 'second result' };
      }),
    ];

    const toolCalls = [
      { id: 'call_1', name: 'first', arguments: {} },
      { id: 'call_2', name: 'second', arguments: {} },
    ];

    const results = await executeToolCalls(tools, toolCalls);

    expect(callOrder).toEqual(['first', 'second']);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });
});
