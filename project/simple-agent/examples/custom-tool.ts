/**
 * Custom Tool Example
 *
 * This example demonstrates:
 * - Defining a custom tool with Zod schema
 * - Implementing the Tool interface
 * - Registering the custom tool with an Agent
 */

import { z } from 'zod';
import { Agent } from '../src/agent/agent';
import type { Tool, ToolContext, ToolResult } from '../src/tools/types';

/**
 * WebSearchTool - A custom tool for web searching
 */
class WebSearchTool implements Tool {
  name = 'web_search';
  description = 'Search the web for information. Use this when you need to find current or detailed information.';
  parameters = z.object({
    query: z.string().describe('The search query to look up'),
    limit: z.number().optional().default(5).describe('Maximum number of results to return'),
  });

  async execute(params: unknown, _context: ToolContext): Promise<ToolResult> {
    const { query, limit = 5 } = this.parameters.parse(params);

    try {
      // This is a mock implementation
      // In a real implementation, you would call an actual search API
      console.log(`[WebSearch] Searching for: "${query}" (limit: ${limit})`);

      // Simulate search results
      const mockResults = [
        { title: `Result 1 for ${query}`, url: `https://example.com/1?q=${encodeURIComponent(query)}` },
        { title: `Result 2 for ${query}`, url: `https://example.com/2?q=${encodeURIComponent(query)}` },
        { title: `Result 3 for ${query}`, url: `https://example.com/3?q=${encodeURIComponent(query)}` },
      ].slice(0, limit);

      return {
        success: true,
        result: JSON.stringify({
          query,
          results: mockResults,
          total: mockResults.length,
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * CalculatorTool - A custom tool with complex parameters
 */
class CalculatorTool implements Tool {
  name = 'calculator';
  description = 'Perform mathematical calculations';
  parameters = z.object({
    expression: z.string().describe('The mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")'),
  });

  async execute(params: unknown, _context: ToolContext): Promise<ToolResult> {
    const { expression } = this.parameters.parse(params);

    try {
      // WARNING: eval is used here only for demonstration purposes
      // In production, use a safe expression parser like mathjs
      // eslint-disable-next-line no-eval
      const result = eval(expression);

      return {
        success: true,
        result: JSON.stringify({
          expression,
          result,
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

async function main() {
  // Determine provider from environment
  const provider = process.env.PROVIDER || 'openai';
  const model = process.env.MODEL || 'gpt-4o';
  const baseURL = process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_BASE_URL;

  // Create an agent
  const agent = new Agent({
    provider,
    model,
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    baseURL,
  });

  // Register custom tools
  agent.registerTools([
    new WebSearchTool(),
    new CalculatorTool(),
  ]);

  // Bind event handlers for logging
  agent.on('agent:start', (data) => {
    console.log('[Agent] Starting:', data);
  });

  agent.on('agent:complete', () => {
    console.log('[Agent] Completed');
  });

  agent.on('tool:call', (data) => {
    console.log('[Tool] Calling:', JSON.stringify(data, null, 2));
  });

  agent.on('tool:result', (data) => {
    console.log('[Tool] Result:', JSON.stringify(data, null, 2));
  });

  // Define a task that uses our custom tools
  const task = 'Calculate 15 * 8 and then search the web for the result';

  // Run the agent in loop mode
  console.log(`\n[Simple-Agent] Starting agent with task: "${task}"\n`);

  const messages = [
    { role: 'user' as const, content: task },
  ];

  try {
    for await (const stepResult of agent.run(messages, 'loop')) {
      switch (stepResult.type) {
        case 'message':
          if (stepResult.content) {
            console.log('[Assistant]', stepResult.content);
          }
          break;
        case 'tool-call':
          console.log('[Tool Call]', JSON.stringify(stepResult.metadata, null, 2));
          break;
        case 'tool-result':
          console.log('[Tool Result]', stepResult.content);
          break;
        case 'done':
          console.log('[Done] Agent finished execution');
          break;
        case 'error':
          console.error('[Error]', stepResult.content);
          break;
      }
    }
  } catch (error) {
    console.error('[Fatal Error]', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
