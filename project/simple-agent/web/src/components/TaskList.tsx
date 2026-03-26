import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Button } from './common/Button';

export function TaskList() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sessions, currentSessionId, setCurrentSession, setSessions } = useStore();

  useEffect(() => {
    setLoading(true);
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setError('加载会话失败'))
      .finally(() => setLoading(false));
  }, [setSessions]);

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = await res.json();
      setCurrentSession(data.sessionId);
    } catch {
      setError('创建会话失败');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (currentSessionId === id) {
        setCurrentSession(null);
      }
    } catch {
      setError('删除会话失败');
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
        {loading && <div className="p-4 text-sm text-gray-500 text-center">加载中...</div>}
        {error && <div className="p-4 text-sm text-red-500 text-center">{error}</div>}
        {!loading && !error && sessions.length === 0 && (
          <div className="p-4 text-sm text-gray-500 text-center">暂无会话</div>
        )}
        {!loading && sessions.map((session) => (
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
