import { useCallback } from 'react';
import { useStore } from '../store';

export function useAgent() {
  const { currentSessionId, agentType, addMessage, clearMessages, clearLogs, setIsRunning } = useStore();

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
          agentType: agentType !== 'simple' ? agentType : undefined,
        }),
      });

      if (!res.ok) {
        setIsRunning(false);
        throw new Error('Failed to start agent');
      }
    },
    [currentSessionId, agentType, addMessage, clearMessages, clearLogs, setIsRunning]
  );

  return { runAgent };
}
