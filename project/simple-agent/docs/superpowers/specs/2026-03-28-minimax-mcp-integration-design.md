# MiniMax MCP 集成设计

**目标:** 在 simple-agent 启动时自动连接 MiniMax MCP，使 Agent 能够调用 `web_search` 和 `understand_image` 工具。

**架构:** 集成 MiniMax Token Plan MCP 服务器，通过 stdio 进程通信。

## 配置

### .env 新增配置项

```env
# MiniMax MCP 配置 (可选，不配置则不启用)
ENABLE_MINIMAX_MCP=true
# API Key 和 Host 默认使用已有的 ANTHROPIC_API_KEY 和 ANTHROPIC_BASE_URL
# 若需单独配置可添加:
# MINIMAX_API_KEY=your_api_key
# MINIMAX_API_HOST=https://api.minimaxi.com
```

### 环境变量映射

| MiniMax MCP 环境变量 | 默认值 | 说明 |
|---------------------|--------|------|
| MINIMAX_API_KEY | ANTHROPIC_API_KEY | API 密钥 |
| MINIMAX_API_HOST | ANTHROPIC_BASE_URL | **不含 `/v1`**（MCP server 会自动添加）|

**重要:** `ANTHROPIC_BASE_URL` 包含 `/v1` 后缀（如 `https://api.minimaxi.com/anthropic/v1`），但 MiniMax MCP server 也会添加 `/v1`，导致 URL 变成 `/anthropic/v1/v1/...`。代码中会自动去除末尾的 `/v1`。

## 实现

### 1. Server 启动时初始化 MCP

**文件:** `src/server/index.ts`

```typescript
import { MCPClient } from '../mcp/client';

// 全局 MCP client 实例
let mcpClient: MCPClient | null = null;

// 获取全局 MCP client (供路由使用)
export function getMCPClient(): MCPClient | null {
  return mcpClient;
}

async function initializeMCP() {
  const enableMCP = process.env.ENABLE_MINIMAX_MCP === 'true';

  if (!enableMCP) {
    console.log('[MCP] MiniMax MCP disabled');
    return;
  }

  try {
    mcpClient = new MCPClient();

    const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
    // MINIMAX_API_HOST should NOT include /v1 - the MCP server adds it
    // If using ANTHROPIC_BASE_URL which includes /v1, strip it
    let apiHost = process.env.MINIMAX_API_HOST || process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com';
    if (apiHost.endsWith('/v1')) {
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

// 在 app.listen 之前调用
await initializeMCP();
```

### 2. Agent 添加 MCP 工具注册方法

**文件:** `src/agent/agent.ts`

在 `setMCPClient` 方法后添加：

```typescript
/**
 * Register tools from MCP client
 *
 * @param mcpClient - MCP client instance
 */
async registerMCPTools(mcpClient: MCPClient): Promise<void> {
  const tools = await mcpClient.listTools();
  for (const tool of tools) {
    this.tools.push(tool);
  }
}
```

**注意:** 需要 import MCPClient 类型：
```typescript
import type { MCPClient } from '../mcp/client';
```

### 3. Server 路由集成

**文件:** `src/server/routes/agent.ts`

从 `getMCPClient()` 获取 mcpClient 并注册工具：

```typescript
import { getMCPClient } from '../index';

export function createAgentRouter(wsManager: WSManager) {
  router.post('/run', async (req, res) => {
    // ... 现有代码 ...

    const agent = new Agent({
      provider: (provider || process.env.PROVIDER || 'anthropic') as 'openai' | 'anthropic',
      model: model || process.env.MODEL || 'MiniMax-M2.7',
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    // 注册 MCP 工具 (如果可用)
    const mcpClient = getMCPClient();
    if (mcpClient) {
      try {
        await agent.registerMCPTools(mcpClient);
      } catch (error) {
        console.error('[Error] Failed to register MCP tools:', error);
      }
    }

    // 注册本地工具
    agent.registerTools([new BashTool(), new ReadTool(), new WriteTool()]);

    // ... 后续逻辑不变 ...
  });
}
```

## 工具列表

| 工具名 | 功能 |
|--------|------|
| MiniMax:web_search | 网络搜索 |
| MiniMax:understand_image | 图片理解 |

## 错误处理

1. **MCP 连接失败** - 打印错误日志，继续启动（不禁用 Agent）
2. **工具调用失败** - 捕获异常，返回错误信息给 Agent
3. **API Key 缺失** - 启动时检测并警告

## 依赖

- `uvx` - 需要提前安装: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- MCP 包: `minimax-coding-plan-mcp` (通过 uvx 远程运行，无需单独安装)

## 验证流程

1. 启动 server，检查 `[MCP] MiniMax MCP connected successfully`
2. 在 Web UI 输入 `搜索今天的新闻`，验证 web_search 被调用
3. 上传图片并提问，验证 understand_image 被调用
