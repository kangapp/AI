// src/server/index.ts
import { config } from 'dotenv';
config({ override: true });
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
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
    // MINIMAX_API_HOST should NOT include /anthropic/v1 - the MCP server constructs the full path
    // Strip /anthropic/v1 or /v1 suffix from ANTHROPIC_BASE_URL
    let apiHost = process.env.MINIMAX_API_HOST || process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com';
    if (apiHost.endsWith('/anthropic/v1')) {
      apiHost = apiHost.replace(/\/anthropic\/v1$/, '');
    } else if (apiHost.endsWith('/v1')) {
      apiHost = apiHost.replace(/\/v1$/, '');
    }

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

// Image upload configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || '.uploads';
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Ensure upload directory exists
import { mkdir } from 'fs/promises';
mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl, filename: req.file.originalname });
});

// Serve uploaded images
app.use('/uploads', express.static(UPLOAD_DIR));

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
