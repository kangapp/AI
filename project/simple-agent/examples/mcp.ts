/**
 * MCP (Model Context Protocol) Example
 *
 * This example demonstrates:
 * - Connecting to an MCP server using stdio transport
 * - Listing available tools from the MCP server
 * - Combining MCP tools with built-in tools
 * - Running the agent with MCP tools
 */

import { Agent } from '../src/agent/agent';
import { MCPClient } from '../src/mcp';
import { BashTool, ReadTool, WriteTool } from '../src/tools';

async function main() {
  // Create MCP client
  const mcpClient = new MCPClient();

  // Connect to a filesystem MCP server via stdio
  // This example assumes a filesystem MCP server is available
  // You can replace this with any MCP server command
  console.log('[MCP] Connecting to filesystem MCP server...');

  try {
    await mcpClient.connect({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    });

    console.log('[MCP] Connected successfully');
    console.log('[MCP] Connected servers:', mcpClient.getConnectedServers());
  } catch (error) {
    console.error('[MCP] Failed to connect:', error instanceof Error ? error.message : String(error));
    console.log('\nNote: To run this example, you need an MCP server available.');
    console.log('Example: npx -y @modelcontextprotocol/server-filesystem .\n');
    process.exit(0);
  }

  // List available MCP tools
  const mcpTools = await mcpClient.listTools();
  console.log(`[MCP] Available tools: ${mcpTools.map(t => t.name).join(', ')}`);

  // Create an agent with OpenAI provider
  const agent = new Agent({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Register built-in tools
  agent.registerTools([
    new BashTool(),
    new ReadTool(),
    new WriteTool(),
    ...mcpTools, // Add MCP tools
  ]);

  // Set MCP client on agent (for tool routing if needed)
  agent.setMCPClient(mcpClient);

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

  // Define a task that uses MCP tools
  const task = 'Read the package.json file from the current directory using the filesystem MCP server';

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
  } finally {
    // Clean up MCP connection
    await mcpClient.disconnect('filesystem');
    console.log('[MCP] Disconnected');
  }
}

main();
