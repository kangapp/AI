// src/server/routes/agent.ts
import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Agent } from '../../agent/agent';
import { BashTool, ReadTool, WriteTool } from '../../tools';
import { WSManager } from '../websocket';
import { getMCPClient } from '../index';
import type { AgentRunRequest } from './types';

const router = Router();

export function createAgentRouter(wsManager: WSManager) {
  router.post('/run', async (req, res) => {
    const { sessionId, prompt, mode, model, provider } = req.body as AgentRunRequest;
    const agentType = (req.body as AgentRunRequest).agentType || 'simple';

    // Build messages array
    const messages: { role: 'system' | 'user'; content: string }[] = [];

    if (agentType === 'code-review') {
      // Load system prompt from code-review-agent
      // Navigate from src/server/routes -> src/server -> src -> project root -> code-review-agent
      const systemPromptPath = join(process.cwd(), '..', 'code-review-agent', 'prompts', 'system.md');
      try {
        const systemPrompt = await readFile(systemPromptPath, 'utf-8');
        messages.push({ role: 'system', content: systemPrompt });
      } catch (e) {
        // If system prompt file is missing, fail fast - code-review mode requires it
        console.error('[Error] Failed to load code-review system prompt:', e);
        res.status(500).json({ error: 'Code review system prompt not found' });
        return;
      }
    }

    messages.push({ role: 'user', content: prompt });

    console.log('[DEBUG] Creating agent with config:', {
      provider: provider || process.env.PROVIDER || 'anthropic',
      model: model || process.env.MODEL || 'MiniMax-M2.7',
      hasApiKey: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    const agent = new Agent({
      provider: (provider || process.env.PROVIDER || 'anthropic') as 'openai' | 'anthropic',
      model: model || process.env.MODEL || 'MiniMax-M2.7',
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    agent.registerTools([new BashTool(), new ReadTool(), new WriteTool()]);

    // 注册 MCP 工具 (如果可用)
    const mcpClient = getMCPClient();
    if (mcpClient) {
      try {
        await agent.registerMCPTools(mcpClient);
      } catch (error) {
        console.error('[Error] Failed to register MCP tools:', error);
      }
    }

    const abortController = new AbortController();
    req.on('aborted', () => {
      abortController.abort();
    });

    const sid = sessionId || `session-${Date.now()}`;

    wsManager.send(sid, { type: 'agent:start', data: { sessionId: sid } });
    wsManager.send(sid, { type: 'message', data: { content: prompt, role: 'user' } });

    // 订阅 Agent 事件
    agent.on('iteration:start', (data) => {
      wsManager.send(sid, { type: 'iteration:start', data: { iteration: data.iteration } });
    });

    agent.on('iteration:end', (data) => {
      wsManager.send(sid, {
        type: 'iteration:end',
        data: {
          iteration: data.iteration,
          promptTokens: data.usage?.promptTokens || 0,
          completionTokens: data.usage?.completionTokens || 0,
        },
      });
    });

    try {
      for await (const stepResult of agent.run(messages, mode, { signal: abortController.signal })) {
        switch (stepResult.type) {
          case 'message':
            wsManager.send(sid, { type: 'message', data: { content: stepResult.content, role: 'assistant' } });
            if (stepResult.reasoning) {
              wsManager.send(sid, { type: 'reasoning', data: { content: stepResult.reasoning } });
            }
            break;
          case 'tool-call':
            for (const tc of stepResult.metadata.toolCalls) {
              wsManager.send(sid, { type: 'tool:call', data: { tool: tc.name, params: tc.arguments } });
            }
            if (stepResult.reasoning) {
              wsManager.send(sid, { type: 'reasoning', data: { content: stepResult.reasoning } });
            }
            break;
          case 'tool-result':
            wsManager.send(sid, { type: 'tool:result', data: { tool: 'tool', result: stepResult.content } });
            break;
          case 'done':
            wsManager.send(sid, { type: 'agent:complete', data: { finalMessage: stepResult.content } });
            break;
          case 'error':
            wsManager.send(sid, { type: 'error', data: { message: stepResult.content } });
            break;
        }
      }
    } catch (err) {
      wsManager.send(sid, { type: 'error', data: { message: String(err) } });
    }

    res.status(202).json({ sessionId: sid });
  });

  return router;
}
