import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../store';
import { useAgent } from '../hooks/useAgent';
import { Button } from './common/Button';
import { Input } from './common/Input';

interface ImageAttachment {
  id: string;
  url: string;
  name: string;
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, isRunning, currentSessionId, agentType, setAgentType } = useStore();
  const { runAgent } = useAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!input.trim() && images.length === 0 || isRunning) return;

    // Build prompt with image references
    let prompt = input;
    if (images.length > 0) {
      const imageUrls = images.map(img => img.url).join('\n');
      prompt = `${prompt}\n\n[图片链接]\n${imageUrls}`;
    }

    setInput('');
    setImages([]);
    try {
      await runAgent(prompt, 'loop');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setImages(prev => [...prev, {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Simple Agent</h1>
            <p className="text-sm text-primary-100">
              {currentSessionId ? `会话: ${currentSessionId}` : '新会话'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAgentType('simple')}
              className={`px-3 py-1 text-sm rounded ${
                agentType === 'simple'
                  ? 'bg-white text-primary-600'
                  : 'bg-primary-700 text-white hover:bg-primary-600'
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setAgentType('code-review')}
              className={`px-3 py-1 text-sm rounded ${
                agentType === 'code-review'
                  ? 'bg-white text-primary-600'
                  : 'bg-primary-700 text-white hover:bg-primary-600'
              }`}
            >
              Review
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

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
              {msg.role === 'user' ? (
                <>
                  {msg.content.includes('[图片链接]') && (
                    <div className="mb-2">
                      {msg.content.split('\n').filter(line => line.startsWith('data:') || line.startsWith('http')).map((url, i) => (
                        <img key={i} src={url} alt="用户上传" className="max-w-full rounded mb-1" style={{maxHeight: '200px'}} />
                      ))}
                    </div>
                  )}
                  <span className="whitespace-pre-wrap">{msg.content.replace(/\[图片链接\]\s*\n*/g, '')}</span>
                </>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
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
        {/* Image attachments preview */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {images.map(img => (
              <div key={img.id} className="relative group">
                <img src={img.url} alt={img.name} className="h-16 w-16 object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRunning || !currentSessionId}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            📷
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            disabled={isRunning || !currentSessionId}
            className="flex-1"
          />
          <Button type="submit" disabled={isRunning || (!input.trim() && images.length === 0) || !currentSessionId}>
            发送
          </Button>
        </div>
      </form>
    </div>
  );
}
