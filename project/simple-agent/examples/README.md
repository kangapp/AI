# Simple-Agent Examples

This directory contains example files demonstrating how to use simple-agent.

## Prerequisites

Set your API key environment variable:

```bash
# For OpenAI
export OPENAI_API_KEY=your-api-key

# For Anthropic
export ANTHROPIC_API_KEY=your-api-key
```

## Examples

### 1. Basic Usage (`basic.ts`)

Demonstrates basic Agent usage with built-in tools:

- Creating an Agent with OpenAI provider
- Registering built-in tools (BashTool, ReadTool, WriteTool)
- Running the agent in loop mode
- Handling agent events

```bash
bun examples/basic.ts
```

### 2. MCP Integration (`mcp.ts`)

Demonstrates connecting to an MCP (Model Context Protocol) server:

- Connecting to an MCP server using stdio transport
- Listing available tools from the MCP server
- Combining MCP tools with built-in tools
- Running the agent with MCP tools

```bash
# Make sure you have an MCP server available
# This example uses the filesystem MCP server
bun examples/mcp.ts
```

### 3. Custom Tool (`custom-tool.ts`)

Demonstrates creating and registering custom tools:

- Defining a tool with Zod schema
- Implementing the Tool interface
- Registering custom tools with an Agent
- Creating multiple custom tools (WebSearchTool, CalculatorTool)

```bash
bun examples/custom-tool.ts
```

## Running All Examples

```bash
# Set your API key
export OPENAI_API_KEY=your-api-key

# Run examples
bun examples/basic.ts
bun examples/custom-tool.ts
# bun examples/mcp.ts  # Requires MCP server
```

## Common Options

All examples accept these environment variables:

- `OPENAI_API_KEY` - OpenAI API key (required for OpenAI provider)
- `ANTHROPIC_API_KEY` - Anthropic API key (required for Anthropic provider)

You can also modify the examples to use different models:

```typescript
const agent = new Agent({
  provider: 'openai',
  model: 'gpt-4o',  // or 'gpt-4o-mini', 'gpt-3.5-turbo', etc.
  apiKey: process.env.OPENAI_API_KEY,
});
```
