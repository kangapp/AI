// src/server/index.ts
import { config } from 'dotenv';
config({ override: true });
import express from 'express';
import cors from 'cors';
import { createAgentRouter } from './routes/agent';
import { createSessionRouter } from './routes/session';
import { WSManager } from './websocket';
import { MCPClient } from '../mcp/client';

// 全局 MCP client 实例
let mcpClient: MCPClient | null = null;

// 获取全局 MCP client (供路由使用)
export function getMCPClient(): MCPClient | null {
  return mcpClient;
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SESSION_DIR = process.env.SESSION_DIR || '.sessions';

// WebSocket Manager
const wsManager = new WSManager(PORT + 1); // WebSocket on 3002

async function initializeMCP() {
  const enableMCP = process.env.ENABLE_MINIMAX_MCP === 'true';

  if (!enableMCP) {
    console.log('[MCP] MiniMax MCP disabled');
    return;
  }

  try {
    mcpClient = new MCPClient();

    const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
    const apiHost = process.env.MINIMAX_API_HOST || process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com';

    await mcpClient.connect({
      name: 'MiniMax',
      transport: 'stdio',
      command: 'uvx',
      args: ['minimax-coding-plan-mcp', '-y'],
      env: {
        MINIMAX_API_KEY: apiKey,
        MINIMAX_API_HOST: apiHost,
      },
    });

    console.log('[MCP] MiniMax MCP connected successfully');

    // 列出可用工具
    const tools = await mcpClient.listTools();
    console.log(`[MCP] Available tools: ${tools.map(t => t.name).join(', ')}`);
  } catch (error) {
    console.error('[MCP] Failed to connect to MiniMax MCP:', error);
    mcpClient = null;
  }
}

// Routes
app.use('/api/agent', createAgentRouter(wsManager));
app.use('/api/sessions', createSessionRouter(SESSION_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/debug/env', (_req, res) => {
  res.json({
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    hasBaseUrl: !!process.env.ANTHROPIC_BASE_URL,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    model: process.env.MODEL,
    provider: process.env.PROVIDER,
  });
});

// 在监听前初始化 MCP
initializeMCP().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket running on ws://localhost:${PORT + 1}`);
  });
});
