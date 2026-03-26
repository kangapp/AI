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
