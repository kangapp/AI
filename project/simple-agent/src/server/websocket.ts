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
