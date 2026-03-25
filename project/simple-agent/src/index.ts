/**
 * CLI Entry Point for simple-agent
 *
 * Usage:
 *   bun src/index.ts --prompt "Your prompt here"
 *   bun src/index.ts -p "Your prompt" --model gpt-4o --provider openai
 *   bun src/index.ts -p "Your prompt" --session <session-id>
 *
 * Options:
 *   --prompt, -p: string (required) - User prompt
 *   --model, -m: string (default: "gpt-4o")
 *   --provider: string (default: "openai")
 *   --session: string (optional) - Session ID to resume
 *   --mode: "step" | "loop" (default: "loop")
 *   --api-key: string (optional, can use env var OPENAI_API_KEY or ANTHROPIC_API_KEY)
 *   --base-url: string (optional, for openai-compatible providers)
 */

import { Agent } from './agent/agent';
import { JsonSessionStorage } from './storage';
import { BashTool, ReadTool, WriteTool } from './tools';
import type { AgentMode, Message } from './types';

// Simple argument parser
interface CLIArgs {
  prompt: string;
  model: string;
  provider: 'openai' | 'anthropic';
  session?: string;
  mode: AgentMode;
  apiKey?: string;
  baseURL?: string;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    prompt: '',
    model: 'gpt-4o',
    provider: 'openai',
    mode: 'loop',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--prompt' || arg === '-p') {
      args.prompt = argv[++i] || '';
    } else if (arg === '--model' || arg === '-m') {
      args.model = argv[++i] || 'gpt-4o';
    } else if (arg === '--provider') {
      const provider = argv[++i] || 'openai';
      if (provider !== 'openai' && provider !== 'anthropic') {
        console.error(`Invalid provider: ${provider}. Using 'openai'.`);
      } else {
        args.provider = provider;
      }
    } else if (arg === '--session') {
      args.session = argv[++i];
    } else if (arg === '--mode') {
      const mode = argv[++i] || 'loop';
      if (mode !== 'step' && mode !== 'loop') {
        console.error(`Invalid mode: ${mode}. Using 'loop'.`);
      } else {
        args.mode = mode;
      }
    } else if (arg === '--api-key') {
      args.apiKey = argv[++i];
    } else if (arg === '--base-url') {
      args.baseURL = argv[++i];
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validate required arguments
  if (!args.prompt) {
    console.error('Error: --prompt is required');
    console.error('Usage: bun src/index.ts --prompt "Your prompt here"');
    process.exit(1);
  }

  // Get API key from args or environment
  const apiKey = args.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('Warning: No API key provided. Set --api-key or OPENAI_API_KEY/ANTHROPIC_API_KEY environment variable.');
  }

  // Initialize storage
  const storageDir = process.env.SESSION_DIR || '.sessions';
  const storage = new JsonSessionStorage(storageDir);

  // Load existing session or create new one
  let sessionId = args.session || `session-${Date.now()}`;
  let session = await storage.load(sessionId);

  if (!session) {
    session = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
  }

  // Add user message
  const userMessage: Message = {
    role: 'user',
    content: args.prompt,
  };
  session.messages.push(userMessage);
  session.updatedAt = Date.now();

  // Create agent
  const agentConfig = {
    provider: args.provider,
    model: args.model,
    apiKey,
    baseURL: args.baseURL,
  };

  const agent = new Agent(agentConfig);

  // Register built-in tools
  agent.registerTools([new BashTool(), new ReadTool(), new WriteTool()]);

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

  // Execute agent
  console.log(`\n[Simple-Agent] Starting agent (mode: ${args.mode})\n`);

  try {
    const messages = session.messages;
    let finalContent = '';

    for await (const stepResult of agent.run(messages, args.mode)) {
      switch (stepResult.type) {
        case 'message':
          if (stepResult.content) {
            console.log('[Assistant]', stepResult.content);
            finalContent = stepResult.content;
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

    // Add assistant response to session
    if (finalContent) {
      session.messages.push({
        role: 'assistant',
        content: finalContent,
      });
    }

    // Save session
    await storage.save(session);
    console.log(`\n[Session] Saved to ${storageDir}/${sessionId}.json`);

    // Output final result
    if (finalContent) {
      console.log('\n--- Final Result ---');
      console.log(finalContent);
    }
  } catch (error) {
    console.error('[Fatal Error]', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Export for testing
export { parseArgs, main };

// Run if executed directly
main();
