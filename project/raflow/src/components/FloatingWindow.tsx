// 悬浮窗组件 - RaFlow 的主界面
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaveformVisualizer } from './WaveformVisualizer';
import { TranscriptDisplay } from './TranscriptDisplay';
import { RecordingButton } from './RecordingButton';
import { MetricsPanel } from './MetricsPanel';
import { useFloatingWindow } from '../hooks/useFloatingWindow';

interface FloatingWindowProps {
  /**
   * 窗口标题
   */
  title?: string;
  /**
   * 是否显示最小化按钮
   */
  showMinimize?: boolean;
  /**
   * 最小化回调
   */
  onMinimize?: () => void;
}

/**
 * 悬浮窗组件
 * RaFlow 的主界面，包含录音控制、波形可视化和转录结果显示
 */
export function FloatingWindow({
  title = 'RaFlow',
  showMinimize = true,
  onMinimize,
}: FloatingWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const {
    isRecording,
    partialTranscript,
    committedTranscript,
    error,
    toggle,
    injectTranscript,
    clearTranscript,
  } = useFloatingWindow();

  const handleMinimize = () => {
    setIsMinimized(true);
    onMinimize?.();
  };

  if (isMinimized) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-md bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden"
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                {title}
              </h1>
              {/* 状态指示器 */}
              <motion.div
                className={`w-2 h-2 rounded-full ${
                  isRecording ? 'bg-red-500' : 'bg-gray-600'
                }`}
                animate={isRecording ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* 性能指标按钮 */}
              <button
                onClick={() => setIsMetricsOpen(true)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                aria-label="性能指标"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>

              {showMinimize && (
                <button
                  onClick={handleMinimize}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  aria-label="最小化"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6">
          {/* 波形可视化 */}
          <div className="flex justify-center">
            <WaveformVisualizer
              audioLevel={isRecording ? 0.7 : 0}
              isRecording={isRecording}
            />
          </div>

          {/* 录音按钮 */}
          <div className="flex justify-center">
            <RecordingButton isRecording={isRecording} onClick={toggle} />
          </div>

          {/* 状态文本 */}
          <motion.p
            key={isRecording ? 'recording' : 'idle'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm text-gray-400"
          >
            {isRecording ? '录音中...' : '点击按钮开始录音'}
          </motion.p>

          {/* 转录结果显示 */}
          <TranscriptDisplay
            partialTranscript={partialTranscript}
            committedTranscript={committedTranscript}
          />

          {/* 错误提示 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/50 rounded-lg p-3"
              >
                <p className="text-red-400 text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 操作按钮 */}
          <AnimatePresence>
            {committedTranscript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex gap-3"
              >
                <button
                  onClick={injectTranscript}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  注入文本
                </button>
                <button
                  onClick={clearTranscript}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  清空
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 快捷键提示 */}
        <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 text-center">
            按 <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">⌘⇧R</kbd>{' '}
            切换录音
          </p>
        </div>
      </motion.div>

      {/* 性能指标面板 */}
      <MetricsPanel isOpen={isMetricsOpen} onClose={() => setIsMetricsOpen(false)} />
    </>
  );
}
