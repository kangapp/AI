// src/server/routes/agent.ts
import { Router } from 'express';
import { Agent } from '../agent/agent';
import { BashTool, ReadTool, WriteTool } from '../tools';
import { WSManager } from '../websocket';
import type { AgentRunRequest } from './types';

const router = Router();

export function createAgentRouter(wsManager: WSManager) {
  router.post('/run', async (req, res) => {
    const { sessionId, prompt, mode, model, provider } = req.body as AgentRunRequest;

    const agent = new Agent({
      provider: (provider || process.env.PROVIDER || 'anthropic') as 'openai' | 'anthropic',
      model: model || process.env.MODEL || 'MiniMax-M2.7',
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    agent.registerTools([new BashTool(), new ReadTool(), new WriteTool()]);

    const abortController = new AbortController();
    req.on('aborted', () => {
      abortController.abort();
    });

    const sid = sessionId || `session-${Date.now()}`;

    wsManager.send(sid, { type: 'agent:start', data: { sessionId: sid } });
    wsManager.send(sid, { type: 'message', data: { content: prompt, role: 'user' } });

    const messages = [{ role: 'user' as const, content: prompt }];

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
            break;
          case 'tool-call':
            for (const tc of stepResult.metadata.toolCalls) {
              wsManager.send(sid, { type: 'tool:call', data: { tool: tc.name, params: tc.input } });
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
