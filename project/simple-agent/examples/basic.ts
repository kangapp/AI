/**
 * Basic Agent Usage Example
 *
 * This example demonstrates:
 * - Creating an Agent with OpenAI provider
 * - Registering built-in tools (BashTool, ReadTool, WriteTool)
 * - Running the agent in loop mode
 * - Handling agent events
 */

import { Agent } from '../src/agent/agent';
import { BashTool, ReadTool, WriteTool } from '../src/tools';

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

  // Register built-in tools
  agent.registerTools([
    new BashTool(),
    new ReadTool(),
    new WriteTool(),
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

  // Define a simple task
  const task = 'List the files in the current directory using bash';

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
