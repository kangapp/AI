import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useAgent } from '../hooks/useAgent';
import { Button } from './common/Button';
import { Input } from './common/Input';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const { messages, isRunning, currentSessionId } = useStore();
  const { runAgent } = useAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    const prompt = input;
    setInput('');
    await runAgent(prompt);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
        <h1 className="text-lg font-semibold text-white">Simple Agent</h1>
        <p className="text-sm text-primary-100">
          {currentSessionId ? `会话: ${currentSessionId}` : '新会话'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p>开始对话吧</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isRunning && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            disabled={isRunning || !currentSessionId}
            className="flex-1"
          />
          <Button type="submit" disabled={isRunning || !input.trim() || !currentSessionId}>
            发送
          </Button>
        </div>
      </form>
    </div>
  );
}
