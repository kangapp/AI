# Simple Agent Web 前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Simple Agent 增加 Web 前端界面（对话交互 + 可视化控制台 + 任务管理），三栏布局，蓝紫渐变风格。

**Architecture:**
- BFF 层：Express + WebSocket，直接调用现有 Agent 核心代码
- 前端：React + Vite + Tailwind CSS + Zustand
- 通信：HTTP REST API + WebSocket 实时事件推送
- 会话存储：复用现有的 `.sessions/` 文件系统

**Tech Stack:** React, Vite, Tailwind CSS, Zustand, Express, ws, TypeScript

---

## 文件结构

### 新增文件

```
simple-agent/
├── src/server/                    # BFF 层
│   ├── index.ts                   # HTTP + WebSocket 入口
│   ├── types.ts                   # API 类型定义
│   ├── routes/
│   │   ├── agent.ts               # POST /api/agent/run
│   │   └── session.ts             # GET/POST/DELETE /api/sessions
│   └── websocket.ts               # WebSocket 事件推送
├── web/                          # React 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css             # Tailwind 入口
│   │   ├── store/
│   │   │   └── index.ts          # Zustand store
│   │   ├── hooks/
│   │   │   ├── useAgent.ts
│   │   │   └── useWebSocket.ts
│   │   └── components/
│   │       ├── TaskList.tsx
│   │       ├── ChatPanel.tsx
│   │       ├── ConsolePanel.tsx
│   │       └── common/
│   │           ├── Button.tsx
│   │           └── Input.tsx
│   └── tailwind.config.js
└── package.json                   # Workspace 根配置
```

### 修改文件

- `package.json` — 添加 workspace 配置，添加 server 依赖

---

## 阶段一：BFF Server

### Task 1: BFF 基础结构

**文件:**
- 创建: `src/server/types.ts`
- 修改: `package.json`

- [ ] **Step 1: 创建 `src/server/types.ts`**

```typescript
// src/server/types.ts

export interface AgentRunRequest {
  sessionId?: string;
  prompt: string;
  mode: 'loop' | 'step';
  model?: string;
  provider?: 'openai' | 'anthropic';
}

export interface Session {
  id: string;
  createdAt: string;
  lastMessage?: string;
}

export type WSEvent =
  | { type: 'agent:start'; data: { sessionId: string } }
  | { type: 'message'; data: { content: string; role: 'user' | 'assistant' } }
  | { type: 'tool:call'; data: { tool: string; params: unknown } }
  | { type: 'tool:result'; data: { tool: string; result: string } }
  | { type: 'iteration:start'; data: { iteration: number } }
  | { type: 'iteration:end'; data: { iteration: number; promptTokens: number; completionTokens: number } }
  | { type: 'agent:complete'; data: { finalMessage: string } }
  | { type: 'error'; data: { message: string } };
```

- [ ] **Step 2: 修改根 `package.json` 添加 workspace 和依赖**

```json
{
  "workspaces": ["web"],
  "scripts": {
    "dev:server": "bun run src/server/index.ts",
    "dev:web": "cd web && bun run dev"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "cors": "^2.8.5"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/server/types.ts package.json
git commit -m "feat(server): add BFF types and workspace config"
```

---

### Task 2: WebSocket 事件推送

**文件:**
- 创建: `src/server/websocket.ts`

- [ ] **Step 1: 创建 `src/server/websocket.ts`**

```typescript
// src/server/websocket.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { WSEvent } from './types';

export class WSManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws, req) => {
      const sessionId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('sessionId');
      if (sessionId) {
        this.clients.set(sessionId, ws);
      }
    });
  }

  send(sessionId: string, event: WSEvent) {
    const client = this.clients.get(sessionId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  }

  close(sessionId: string) {
    const client = this.clients.get(sessionId);
    if (client) {
      client.close();
      this.clients.delete(sessionId);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/websocket.ts
git commit -m "feat(server): add WebSocket manager"
```

---

### Task 3: Agent API 路由

**文件:**
- 创建: `src/server/routes/agent.ts`

- [ ] **Step 1: 创建 `src/server/routes/agent.ts`**

```typescript
// src/server/routes/agent.ts
import { Router } from 'express';
import { Agent } from '../agent/agent';
import { BashTool, ReadTool, WriteTool } from '../tools';
import { WSManager } from '../websocket';
import type { AgentRunRequest } from '../types';

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

    const sid = sessionId || `session-${Date.now()}`;

    wsManager.send(sid, { type: 'agent:start', data: { sessionId: sid } });
    wsManager.send(sid, { type: 'message', data: { content: prompt, role: 'user' } });

    const messages = [{ role: 'user' as const, content: prompt }];

    let iteration = 0;

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
      for await (const stepResult of agent.run(messages, mode)) {
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
```

**注意:** Agent 导入路径需根据实际项目结构验证。根据 spec，`src/agent/agent.ts` 存在。实际路径可能是 `../../agent/agent`（从 `src/server/routes/` 出发）。

- [ ] **Step 2: Commit**

```bash
git add src/server/routes/agent.ts
git commit -m "feat(server): add agent run API route"
```

---

### Task 4: Session API 路由

**文件:**
- 创建: `src/server/routes/session.ts`

- [ ] **Step 1: 创建 `src/server/routes/session.ts`**

```typescript
// src/server/routes/session.ts
import { Router } from 'express';
import { readdir, rm } from 'fs/promises';
import { join } from 'path';
import type { Session } from '../types';

const router = Router();

export function createSessionRouter(sessionDir: string) {
  router.get('/', async (_req, res) => {
    try {
      const files = await readdir(sessionDir);
      const sessions: Session[] = files
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const id = f.replace('.json', '');
          return { id, createdAt: '', lastMessage: '' };
        });
      res.json({ sessions });
    } catch {
      res.json({ sessions: [] });
    }
  });

  router.post('/', (_req, res) => {
    const sessionId = `session-${Date.now()}`;
    res.json({ sessionId });
  });

  router.delete('/:id', async (req, res) => {
    try {
      await rm(join(sessionDir, `${req.params.id}.json`));
      res.json({ success: true });
    } catch {
      res.json({ success: false });
    }
  });

  return router;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/routes/session.ts
git commit -m "feat(server): add session management API routes"
```

---

### Task 5: BFF Server 入口

**文件:**
- 创建: `src/server/index.ts`

- [ ] **Step 1: 创建 `src/server/index.ts`**

```typescript
// src/server/index.ts
import express from 'express';
import cors from 'cors';
import { createAgentRouter } from './routes/agent';
import { createSessionRouter } from './routes/session';
import { WSManager } from './websocket';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SESSION_DIR = process.env.SESSION_DIR || '.sessions';

// WebSocket Manager
const wsManager = new WSManager(PORT + 1); // WebSocket on 3002

// Routes
app.use('/api/agent', createAgentRouter(wsManager));
app.use('/api/sessions', createSessionRouter(SESSION_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket running on ws://localhost:${PORT + 1}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(server): add BFF server entry point"
```

---

## 阶段二：React Frontend

### Task 6: Frontend 项目初始化

**文件:**
- 创建: `web/package.json`
- 创建: `web/vite.config.ts`
- 创建: `web/index.html`
- 创建: `web/tailwind.config.js`

- [ ] **Step 1: 创建 `web/package.json`**

```json
{
  "name": "simple-agent-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: 创建 `web/vite.config.ts`**

```typescript
// web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 3: 创建 `web/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Simple Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 `web/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: 创建 `web/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/vite.config.ts web/index.html web/tailwind.config.js web/postcss.config.js
git commit -m "feat(web): initialize React project with Vite and Tailwind"
```

---

### Task 7: Tailwind 入口和基础组件

**文件:**
- 创建: `web/src/index.css`
- 创建: `web/src/main.tsx`
- 创建: `web/src/components/common/Button.tsx`
- 创建: `web/src/components/common/Input.tsx`

- [ ] **Step 1: 创建 `web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900;
}
```

- [ ] **Step 2: 创建 `web/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: 创建 `web/src/components/common/Button.tsx`**

```tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500';

  const variants = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: 创建 `web/src/components/common/Input.tsx`**

```tsx
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className = '', error = false, ...props }: InputProps) {
  return (
    <input
      className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
      } ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/index.css web/src/main.tsx web/src/components/common/Button.tsx web/src/components/common/Input.tsx
git commit -m "feat(web): add Tailwind setup and base components"
```

---

### Task 8: Zustand Store

**文件:**
- 创建: `web/src/store/index.ts`
- 创建: `web/src/types.ts` (共享类型)

- [ ] **Step 1: 创建 `web/src/types.ts` (共享类型)**

```typescript
// web/src/types.ts
// 共享的 WebSocket 事件类型

export type WSEvent =
  | { type: 'agent:start'; data: { sessionId: string } }
  | { type: 'message'; data: { content: string; role: 'user' | 'assistant' } }
  | { type: 'tool:call'; data: { tool: string; params: unknown } }
  | { type: 'tool:result'; data: { tool: string; result: string } }
  | { type: 'iteration:start'; data: { iteration: number } }
  | { type: 'iteration:end'; data: { iteration: number; promptTokens: number; completionTokens: number } }
  | { type: 'agent:complete'; data: { finalMessage: string } }
  | { type: 'error'; data: { message: string } };
```

- [ ] **Step 2: 创建 `web/src/store/index.ts`**

```typescript
import { create } from 'zustand';
import type { WSEvent } from '../types';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface LogEntry {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
}

interface AgentStore {
  // Session
  currentSessionId: string | null;
  sessions: Array<{ id: string; createdAt: string; lastMessage?: string }>;
  setCurrentSession: (id: string | null) => void;
  setSessions: (sessions: Array<{ id: string; createdAt: string; lastMessage?: string }>) => void;

  // Messages
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  // Console logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // Status
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
}

export const useStore = create<AgentStore>((set) => ({
  currentSessionId: null,
  sessions: [],
  setCurrentSession: (id) => set({ currentSessionId: id }),
  setSessions: (sessions) => set({ sessions }),

  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (content) =>
    set((state) => ({
      messages: state.messages.map((m, i) =>
        i === state.messages.length - 1 ? { ...m, content } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),

  logs: [],
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  clearLogs: () => set({ logs: [] }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),
}));
```

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts web/src/store/index.ts
git commit -m "feat(web): add Zustand store and shared types"
```

---

### Task 9: WebSocket Hook

**文件:**
- 创建: `web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: 创建 `web/src/hooks/useWebSocket.ts`**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { WSEvent } from '../types';

const WS_URL = `ws://localhost:3002`;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { addMessage, updateLastMessage, addLog, setIsRunning } = useStore();

  const connect = useCallback(() => {
    if (!sessionId) return;

    const ws = new WebSocket(`${WS_URL}?sessionId=${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const evt = JSON.parse(event.data) as WSEvent;
      const logId = `log-${Date.now()}-${Math.random()}`;
      addLog({ id: logId, type: evt.type, data: evt.data, timestamp: Date.now() });

      switch (evt.type) {
        case 'message':
          if (evt.data.role === 'assistant') {
            addMessage({
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: evt.data.content,
            });
          }
          break;
        case 'agent:start':
          setIsRunning(true);
          break;
        case 'agent:complete':
          setIsRunning(false);
          break;
        case 'error':
          setIsRunning(false);
          break;
      }
    };

    ws.onclose = () => {
      setIsRunning(false);
    };

    return ws;
  }, [sessionId, addMessage, addLog, setIsRunning]);

  useEffect(() => {
    const ws = connect();
    return () => {
      ws?.close();
    };
  }, [connect]);

  return wsRef;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/useWebSocket.ts
git commit -m "feat(web): add WebSocket hook"
```

---

### Task 10: Agent Hook

**文件:**
- 创建: `web/src/hooks/useAgent.ts`

- [ ] **Step 1: 创建 `web/src/hooks/useAgent.ts`**

```typescript
import { useCallback } from 'react';
import { useStore } from '../store';

export function useAgent() {
  const { currentSessionId, addMessage, clearMessages, clearLogs, setIsRunning } = useStore();

  const runAgent = useCallback(
    async (prompt: string, mode: 'loop' | 'step' = 'loop') => {
      if (!prompt.trim()) return;

      clearMessages();
      clearLogs();
      setIsRunning(true);

      addMessage({ id: `msg-${Date.now()}`, role: 'user', content: prompt });

      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          prompt,
          mode,
        }),
      });

      if (!res.ok) {
        setIsRunning(false);
        throw new Error('Failed to start agent');
      }
    },
    [currentSessionId, addMessage, clearMessages, clearLogs, setIsRunning]
  );

  return { runAgent };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/useAgent.ts
git commit -m "feat(web): add Agent hook for running tasks"
```

---

### Task 11: TaskList 组件

**文件:**
- 创建: `web/src/components/TaskList.tsx`

- [ ] **Step 1: 创建 `web/src/components/TaskList.tsx`**

```tsx
import { useEffect } from 'react';
import { useStore } from '../store';
import { Button } from './common/Button';

export function TaskList() {
  const { sessions, currentSessionId, setCurrentSession, setSessions } = useStore();

  useEffect(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []));
  }, [setSessions]);

  const handleNewSession = async () => {
    const res = await fetch('/api/sessions', { method: 'POST' });
    const data = await res.json();
    setCurrentSession(data.sessionId);
  };

  const handleDeleteSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (currentSessionId === id) {
      setCurrentSession(null);
    }
  };

  return (
    <div className="w-[200px] bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <Button onClick={handleNewSession} className="w-full">
          + 新建会话
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setCurrentSession(session.id)}
            className={`p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
              currentSessionId === session.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
            }`}
          >
            <div className="text-sm font-medium text-gray-900 truncate">{session.id}</div>
            <div className="text-xs text-gray-500">{session.createdAt || '新会话'}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSession(session.id);
              }}
              className="text-xs text-red-500 hover:text-red-700 mt-1"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/TaskList.tsx
git commit -m "feat(web): add TaskList component"
```

---

### Task 12: ChatPanel 组件

**文件:**
- 创建: `web/src/components/ChatPanel.tsx`

- [ ] **Step 1: 创建 `web/src/components/ChatPanel.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useAgent } from '../hooks/useAgent';
import { Button } from './common/Button';
import { Input } from './common/Input';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const { messages, isRunning, currentSessionId } = useStore();
  const { runAgent } = useAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    const prompt = input;
    setInput('');
    await runAgent(prompt);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
        <h1 className="text-lg font-semibold text-white">Simple Agent</h1>
        <p className="text-sm text-primary-100">
          {currentSessionId ? `会话: ${currentSessionId}` : '新会话'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p>开始对话吧</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isRunning && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            disabled={isRunning || !currentSessionId}
            className="flex-1"
          />
          <Button type="submit" disabled={isRunning || !input.trim() || !currentSessionId}>
            发送
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/ChatPanel.tsx
git commit -m "feat(web): add ChatPanel component with streaming"
```

---

### Task 13: ConsolePanel 组件

**文件:**
- 创建: `web/src/components/ConsolePanel.tsx`

- [ ] **Step 1: 创建 `web/src/components/ConsolePanel.tsx`**

```tsx
import { useStore } from '../store';

export function ConsolePanel() {
  const { logs } = useStore();

  return (
    <div className="w-[350px] bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-gray-800">
        <h2 className="text-sm font-semibold">控制台</h2>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {logs.length === 0 && (
          <div className="text-gray-500 text-center mt-4">暂无日志</div>
        )}

        {logs.map((log) => (
          <div key={log.id} className="py-1 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs ${
                  log.type.startsWith('agent')
                    ? 'bg-blue-900 text-blue-300'
                    : log.type.startsWith('tool')
                    ? 'bg-purple-900 text-purple-300'
                    : log.type === 'error'
                    ? 'bg-red-900 text-red-300'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {log.type}
              </span>
            </div>
            <div className="mt-1 text-gray-300 whitespace-pre-wrap break-all">
              {JSON.stringify(log.data, null, 2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/ConsolePanel.tsx
git commit -m "feat(web): add ConsolePanel component"
```

---

### Task 14: App 主组件

**文件:**
- 创建: `web/src/App.tsx`

- [ ] **Step 1: 创建 `web/src/App.tsx`**

```tsx
import { useEffect } from 'react';
import { useStore } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import { TaskList } from './components/TaskList';
import { ChatPanel } from './components/ChatPanel';
import { ConsolePanel } from './components/ConsolePanel';

function App() {
  const { currentSessionId } = useStore();
  useWebSocket(currentSessionId);

  return (
    <div className="h-screen flex overflow-hidden">
      <TaskList />
      <ChatPanel />
      <ConsolePanel />
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat(web): add main App component with three-panel layout"
```

---

## 阶段三：验证

### Task 15: 端到端验证

**文件:**
- 修改: `docs/superpowers/plans/2026-03-26-web-frontend-implementation.md` (更新状态)

- [ ] **Step 1: 安装依赖**

```bash
bun install
cd web && bun install
```

- [ ] **Step 2: 启动 Server**

```bash
bun run dev:server
# 期望: Server running on http://localhost:3001
# 期望: WebSocket running on ws://localhost:3002
```

- [ ] **Step 3: 启动 Web**

```bash
bun run dev:web
# 期望: Vite dev server on http://localhost:5173
```

- [ ] **Step 4: 浏览器测试**

1. 打开 http://localhost:5173
2. 点击"新建会话"
3. 在输入框输入 "你好，列出当前目录文件"
4. 点击发送
5. 验证：
   - 对话区域显示用户消息和助手响应
   - 控制台显示事件日志
   - 无 console error

- [ ] **Step 5: Commit 最终状态**

```bash
git add -A
git commit -m "feat: complete web frontend with three-panel layout"
```

---

## 总结

| 阶段 | 任务数 | 预计时间 |
|------|--------|----------|
| BFF Server | 5 | 25 min |
| Frontend | 9 | 45 min |
| 验证 | 1 | 10 min |
| **总计** | **15** | **~80 min** |
