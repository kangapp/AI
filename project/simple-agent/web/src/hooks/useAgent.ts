import { useCallback } from 'react';
import { useStore } from '../store';

export function useAgent() {
  const { currentSessionId, addMessage, clearMessages, clearLogs, setIsRunning } = useStore();

  const runAgent = useCallback(
    async (prompt: string, mode: 'loop' | 'step' = 'loop', agentType: 'simple' | 'code-review' = 'simple') => {
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
          agentType: agentType !== 'simple' ? agentType : undefined, // Only send if not 'simple'
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
