# MiniMax MCP 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 simple-agent 启动时自动连接 MiniMax MCP，使 Agent 能够调用 web_search 和 understand_image 工具

**Architecture:** 在 server 启动时 fork stdio 进程连接 MiniMax MCP (uvx minimax-coding-plan-mcp)，通过现有的 MCPClient 类管理连接，在 Agent 运行前注册 MCP 工具

**Tech Stack:** TypeScript, MCP (Model Context Protocol), stdio transport

---

## 文件修改概览

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/server/index.ts` | 修改 | MCP 初始化和全局状态 |
| `src/agent/agent.ts` | 修改 | 添加 registerMCPTools 方法 |
| `src/server/routes/agent.ts` | 修改 | 集成 MCP 工具注册 |
| `.env.example` | 修改 | 添加 MCP 配置文档 |

---

## Task 1: Server 初始化 MCP

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: 添加 MCP import 和全局变量**

在 `src/server/index.ts` 文件顶部添加 import 和全局变量：

```typescript
import { MCPClient } from '../mcp/client';

// 全局 MCP client 实例
let mcpClient: MCPClient | null = null;
```

- [ ] **Step 2: 添加 getMCPClient 函数**

在全局变量后添加：

```typescript
// 获取全局 MCP client (供路由使用)
export function getMCPClient(): MCPClient | null {
  return mcpClient;
}
```

- [ ] **Step 3: 添加 initializeMCP 函数**

在 `getMCPClient` 函数后添加：

```typescript
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
```

- [ ] **Step 4: 在 app.listen 前调用 initializeMCP**

修改 `app.listen` 调用：

```typescript
// 在监听前初始化 MCP
initializeMCP().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket running on ws://localhost:${PORT + 1}`);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: add MiniMax MCP initialization on server startup"
```

---

## Task 2: Agent 添加 MCP 工具注册方法

**Files:**
- Modify: `src/agent/agent.ts`
- Import type: `MCPClient` from `../mcp/client`

- [ ] **Step 1: 添加 MCPClient 类型 import**

在 `src/agent/agent.ts` 顶部的 import 语句中添加：

```typescript
import type { MCPClient } from '../mcp/client';
```

- [ ] **Step 2: 添加 registerMCPTools 方法**

找到 `src/agent/agent.ts` 中的 `setMCPClient` 方法，在其后面添加：

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

**注意**: MCP 工具通过 `createMcpToolExecutor` 闭包捕获了 `mcpClient.callTool` 的引用，因此在 `loop.ts` 或 `step.ts` 中无需额外处理 mcpClient

- [ ] **Step 3: Commit**

```bash
git add src/agent/agent.ts
git commit -m "feat: add registerMCPTools method to Agent"
```

---

## Task 3: 路由集成 MCP 工具

**Files:**
- Modify: `src/server/routes/agent.ts`

- [ ] **Step 1: 添加 getMCPClient import**

在 `src/server/routes/agent.ts` 顶部添加：

```typescript
import { getMCPClient } from '../index';
```

- [ ] **Step 2: 在 Agent 创建后注册 MCP 工具**

在 `agent.registerTools([new BashTool(), new ReadTool(), new WriteTool()]);` 之后、任何事件订阅（如 `agent.on('iteration:start', ...)`）之前添加：

```typescript
// 注册 MCP 工具 (如果可用)
const mcpClient = getMCPClient();
if (mcpClient) {
  try {
    await agent.registerMCPTools(mcpClient);
  } catch (error) {
    console.error('[Error] Failed to register MCP tools:', error);
  }
}
```

**错误处理**: 如果 MCP 初始化失败（mcpClient 为 null），Agent 仍可正常工作（降级为非 MCP 模式）

- [ ] **Step 3: Commit**

```bash
git add src/server/routes/agent.ts
git commit -m "feat: integrate MCP tools in agent router"
```

---

## Task 4: 更新 .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 添加 MCP 配置说明**

在 `.env.example` 文件末尾添加：

```env
# MiniMax MCP 配置 (可选)
# 启用 MiniMax MCP (需要先安装 uvx: curl -LsSf https://astral.sh/uv/install.sh | sh)
ENABLE_MINIMAX_MCP=false
# API Key 和 Host 默认使用上面的 ANTHROPIC_API_KEY 和 ANTHROPIC_BASE_URL
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add MiniMax MCP configuration to .env.example"
```

---

## Task 5: 验证测试

**Files:**
- 测试文件: 无需修改测试文件

- [ ] **Step 1: 验证 ENABLE_MINIMAX_MCP=false 降级行为**

```bash
# 设置 ENABLE_MINIMAX_MCP=false (或未设置)
npm run dev:server

# 预期: 服务器正常启动，控制台显示 "[MCP] MiniMax MCP disabled"
```

- [ ] **Step 2: 验证 ENABLE_MINIMAX_MCP=true 正常连接**

```bash
# 设置 ENABLE_MINIMAX_MCP=true
# 确保 uvx 已安装: which uvx
npm run dev:server

# 预期输出应包含:
# [MCP] MiniMax MCP connected successfully
# [MCP] Available tools: MiniMax:web_search, MiniMax:understand_image
```

- [ ] **Step 3: 手动测试 web_search**

在 Web UI 中输入：`搜索今天的新闻`

预期：控制台应显示 `tool:call` 调用了 MiniMax:web_search 工具

- [ ] **Step 4: 手动测试 understand_image**

在 Web UI 中上传图片并输入：`这张图片里有什么`

预期：控制台应显示 `tool:call` 调用了 MiniMax:understand_image 工具

---

## 验证清单

- [ ] `ENABLE_MINIMAX_MCP=false` 时服务器正常启动但不加载 MCP
- [ ] `ENABLE_MINIMAX_MCP=true` 时服务器启动并连接 MCP
- [ ] 服务器启动时打印 `[MCP] Available tools: ...`
- [ ] web_search 工具能正常返回搜索结果
- [ ] understand_image 工具能正常返回图片理解结果
- [ ] MCP 工具调用失败时 Agent 不会崩溃（错误被捕获）
