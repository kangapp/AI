/**
 * Agent - Main orchestrator for LLM-powered agents
 *
 * Coordinates LLM, tools, and events for agent execution.
 */

import type { Message, AgentConfig, AgentMode, StepResult, RunOptions } from '../types';
import type { LLMProvider } from '../llm';
import type { Tool, ToolContext } from '../tools/types';
import { EventEmitter } from '../events/emitter';
import { step, executeToolCalls } from './step';
import { loop } from './loop';

/**
 * Agent class for LLM-powered task execution
 */
export class Agent {
  private llm: LLMProvider;
  private tools: Tool[];
  private mcpClient: unknown; // MCPClient | null
  private events: EventEmitter;
  private config: AgentConfig;

  /**
   * Create a new Agent
   *
   * @param config - Agent configuration
   */
  constructor(config: AgentConfig) {
    this.config = config;
    this.events = new EventEmitter();
    this.tools = [];
    this.mcpClient = null;

    // Check if an LLM was provided for testing (extends config)
    const llmOverride = (config as unknown as { llm?: LLMProvider }).llm;
    if (llmOverride) {
      this.llm = llmOverride;
    } else {
      // Create LLM provider
      const { createProvider } = require('../llm');
      this.llm = createProvider(config.provider, config.model, config.baseURL);
    }

    // Set API key if provided (set env var for AI SDK to pick up)
    if (config.apiKey) {
      if (config.provider === 'anthropic') {
        process.env.ANTHROPIC_API_KEY = config.apiKey;
      } else {
        process.env.OPENAI_API_KEY = config.apiKey;
      }
    }

    // Set base URL if provided
    if (config.baseURL) {
      // Provider base URL would be set here if needed
    }
  }

  /**
   * Register tools with the agent
   *
   * @param tools - Tools to register
   */
  registerTools(tools: Tool[]): void {
    this.tools = tools;
  }

  /**
   * Set MCP client for MCP tool access
   *
   * @param client - MCP client instance
   */
  setMCPClient(client: unknown): void {
    this.mcpClient = client;
  }

  /**
   * Run the agent with the given messages
   *
   * @param messages - Conversation messages
   * @param mode - Execution mode ('step' or 'loop')
   * @returns AsyncGenerator yielding StepResults
   */
  async *run(
    messages: Message[],
    mode: AgentMode = 'loop',
    options: RunOptions = {}
  ): AsyncGenerator<StepResult> {
    const { signal } = options;
    // Add system prompt if provided
    if (this.config.systemPrompt) {
      const hasSystem = messages.some(m => m.role === 'system');
      if (!hasSystem) {
        messages.unshift({
          role: 'system',
          content: this.config.systemPrompt,
        });
      }
    }

    // Emit start event
    this.events.emit('agent:start', { mode, messageCount: messages.length });

    if (mode === 'step') {
      // Step mode: single LLM call, handle tools if present
      yield* this.runStepMode(messages, signal);
    } else {
      // Loop mode: iterate until no more tool calls or max iterations
      yield* this.runLoopMode(messages, signal);
    }

    // Emit complete event
    this.events.emit('agent:complete', {});
  }

  /**
   * Run in step mode - single LLM call
   */
  private async *runStepMode(messages: Message[], signal?: AbortSignal): AsyncGenerator<StepResult> {
    const stepResult = await step(this.llm, this.tools, messages, {}, signal);

    yield stepResult;

    // Handle tool calls if present
    if (stepResult.type === 'tool-call' && stepResult.metadata?.toolCalls) {
      const toolCalls = stepResult.metadata.toolCalls as {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
      }[];

      this.events.emit('tool:call', { toolCalls });

      const toolResults = await executeToolCalls(this.tools, toolCalls);

      this.events.emit('tool:result', { results: toolResults });

      // Return tool results
      yield {
        type: 'tool-result',
        content: JSON.stringify(toolResults),
        metadata: { results: toolResults },
      };
    }
  }

  /**
   * Run in loop mode - iterate until complete
   */
  private async *runLoopMode(messages: Message[], signal?: AbortSignal): AsyncGenerator<StepResult> {
    const maxIterations = this.config.maxIterations ?? 10;
    const maxTokens = this.config.maxTokens ?? 8192;

    yield* loop(this.llm, this.tools, messages, this.events, {
      maxIterations,
      signal,
      maxTokens,
    });
  }

  /**
   * Subscribe to an event
   *
   * @param event - Event name
   * @param handler - Event handler
   */
  on(event: string, handler: (data: unknown) => void): void {
    this.events.on(event, handler);
  }

  /**
   * Emit an event
   *
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data: unknown): void {
    this.events.emit(event, data);
  }

  /**
   * Get event history
   */
  getEventHistory(): { timestamp: number; event: string; data: unknown }[] {
    return this.events.getHistory();
  }
}
