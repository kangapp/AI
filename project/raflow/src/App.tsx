import { useState } from "react";

function App() {
  const [recording, setRecording] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black">
      <div className="text-center space-y-8">
        {/* Logo */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            RaFlow
          </h1>
          <p className="text-gray-400 text-lg">
            实时语音转文字桌面应用
          </p>
        </div>

        {/* 状态指示 */}
        <div className="flex items-center justify-center gap-3">
          <div
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              recording
                ? "bg-red-500 animate-pulse-slow"
                : "bg-gray-600"
            }`}
          />
          <span className="text-sm text-gray-400">
            {recording ? "录音中..." : "准备就绪"}
          </span>
        </div>

        {/* 快捷键提示 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
          <p className="text-sm text-gray-400">
            按 <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘⇧R</kbd> 开始/停止录音
          </p>
        </div>

        {/* 版本信息 */}
        <p className="text-xs text-gray-600">
          v0.1.0 · 基于 Tauri v2 + ElevenLabs
        </p>
      </div>
    </div>
  );
}

export default App;
