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
