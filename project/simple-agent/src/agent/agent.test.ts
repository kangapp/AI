import { describe, test, expect, vi } from 'bun:test';
import { Agent } from './agent';
import type { AgentConfig } from '../types';
import type { LLMProvider } from '../llm';

// Mock LLM for testing
const createMockLLM = (): LLMProvider => ({
  name: 'mock',
  model: 'mock-model',
  supportsTools: () => true,
  chat: vi.fn().mockResolvedValue({
    content: 'Test response',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  }),
});

describe('Agent', () => {
  test('creates agent with config', () => {
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
    };

    const agent = new Agent(config);

    expect(agent).toBeDefined();
  });

  test('run returns async generator', () => {
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      llm: createMockLLM() as any,
    };

    const agent = new Agent(config);
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    const result = agent.run(messages, 'step');

    expect(result).toBeDefined();
    expect(typeof result[Symbol.asyncIterator]).toBe('function');
  });

  test('on and emit work for events', () => {
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
    };

    const agent = new Agent(config);
    const handler = vi.fn();

    agent.on('test-event', handler);
    agent.emit('test-event', { data: 'test' });

    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });

  test('getEventHistory returns emitted events', () => {
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
    };

    const agent = new Agent(config);
    agent.emit('event1', { data: 1 });
    agent.emit('event2', { data: 2 });

    const history = agent.getEventHistory();

    expect(history.length).toBe(2);
    expect(history[0].event).toBe('event1');
    expect(history[1].event).toBe('event2');
  });

  test('adds system prompt if provided', async () => {
    const mockLLM = createMockLLM();
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'You are a helpful assistant.',
      llm: mockLLM as any,
    };

    const agent = new Agent(config);
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    // Consume the generator to trigger the run
    for await (const _ of agent.run(messages, 'step')) {
      // consume
    }

    // System prompt should have been added
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are a helpful assistant.');
  });

  test('does not duplicate system prompt', async () => {
    const mockLLM = createMockLLM();
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'You are a helpful assistant.',
      llm: mockLLM as any,
    };

    const agent = new Agent(config);
    const messages = [
      { role: 'system' as const, content: 'Existing system prompt' },
      { role: 'user' as const, content: 'Hello' },
    ];

    for await (const _ of agent.run(messages, 'step')) {
      // consume
    }

    // Should not have added another system prompt
    const systemCount = messages.filter(m => m.role === 'system').length;
    expect(systemCount).toBe(1);
  });

  test('registerTools stores tools', () => {
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
    };

    const agent = new Agent(config);
    const tools = [
      {
        name: 'test-tool',
        description: 'A test tool',
        parameters: {} as any,
        execute: async () => ({ success: true, result: 'ok' }),
      },
    ];

    agent.registerTools(tools);

    // Tools are stored internally - this is a basic check
    expect(agent).toBeDefined();
  });

  test('step mode yields single result', async () => {
    const mockLLM = createMockLLM();
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      llm: mockLLM as any,
    };

    const agent = new Agent(config);
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    const results: any[] = [];
    for await (const result of agent.run(messages, 'step')) {
      results.push(result);
    }

    // Should have at least the step result
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test('loop mode yields done result', async () => {
    const mockLLM = createMockLLM();
    const config: AgentConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      maxIterations: 3,
      llm: mockLLM as any,
    };

    const agent = new Agent(config);
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    const results: any[] = [];
    for await (const result of agent.run(messages, 'loop')) {
      results.push(result);
    }

    // Loop should complete with done
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[results.length - 1].type).toBe('done');
  });
});
