import { useRef, useEffect } from 'react';
import { useStore } from '../store';

function formatLogData(type: string, data: unknown): React.ReactNode {
  if (type === 'tool:call' && typeof data === 'object' && data !== null) {
    const { tool, params } = data as { tool: string; params: unknown };
    return (
      <div>
        <span className="text-purple-400">Tool: </span>
        <span className="text-yellow-300">{tool}</span>
        {params && Object.keys(params).length > 0 && (
          <>
            <div className="text-purple-400 mt-1">Params:</div>
            <pre className="text-gray-400 mt-1 ml-2 whitespace-pre-wrap">
              {JSON.stringify(params, null, 2)}
            </pre>
          </>
        )}
      </div>
    );
  }

  if (type === 'tool:result' && typeof data === 'object' && data !== null) {
    const { tool, result } = data as { tool: string; result: string };
    return (
      <div>
        <span className="text-purple-400">Result ({tool}):</span>
        <pre className="text-gray-400 mt-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {result.length > 500 ? result.substring(0, 500) + '...' : result}
        </pre>
      </div>
    );
  }

  return (
    <pre className="text-gray-300 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function ConsolePanel() {
  const { logs } = useStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
            <div className="mt-1">
              {formatLogData(log.type, log.data)}
            </div>
          </div>
        ))}

        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
