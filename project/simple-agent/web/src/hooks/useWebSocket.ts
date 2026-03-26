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