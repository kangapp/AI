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
