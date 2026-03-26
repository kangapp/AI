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
