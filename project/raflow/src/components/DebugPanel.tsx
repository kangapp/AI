// Debug Panel Component - 调试面板组件
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebug } from '../hooks/useDebug';
import type { LogLevel } from '../types';

const LOG_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 调试面板组件
 *
 * 显示调试模式状态、日志级别配置和目标模块过滤
 */
export function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const {
    isEnabled,
    logLevel,
    includeTargets,
    excludeTargets,
    toggle,
    setLogLevel,
    addIncludeTarget,
    removeIncludeTarget,
    addExcludeTarget,
    removeExcludeTarget,
    isLoading,
  } = useDebug();

  const [newIncludeTarget, setNewIncludeTarget] = useState('');
  const [newExcludeTarget, setNewExcludeTarget] = useState('');

  const handleToggleDebug = () => {
    toggle();
  };

  const handleLogLevelChange = (level: LogLevel) => {
    setLogLevel(level);
  };

  const handleAddIncludeTarget = () => {
    if (newIncludeTarget.trim()) {
      addIncludeTarget(newIncludeTarget.trim());
      setNewIncludeTarget('');
    }
  };

  const handleAddExcludeTarget = () => {
    if (newExcludeTarget.trim()) {
      addExcludeTarget(newExcludeTarget.trim());
      setNewExcludeTarget('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">调试面板</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容 */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
              {/* 调试模式开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">调试模式</h3>
                  <p className="text-sm text-gray-400">启用详细的日志输出</p>
                </div>
                <button
                  onClick={handleToggleDebug}
                  disabled={isLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isEnabled ? 'bg-blue-600' : 'bg-gray-600'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 日志级别 */}
              <div>
                <h3 className="text-white font-medium mb-2">日志级别</h3>
                <div className="flex flex-wrap gap-2">
                  {LOG_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => handleLogLevelChange(level)}
                      disabled={!isEnabled || isLoading}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        logLevel === level
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {level.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 包含的目标模块（白名单） */}
              <div>
                <h3 className="text-white font-medium mb-2">包含的目标模块（白名单）</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newIncludeTarget}
                    onChange={(e) => setNewIncludeTarget(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIncludeTarget()}
                    placeholder="例如: raflow::audio"
                    disabled={!isEnabled || isLoading}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleAddIncludeTarget}
                    disabled={!isEnabled || isLoading || !newIncludeTarget.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {includeTargets.map((target: string) => (
                    <span
                      key={target}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/50 text-green-300 rounded text-sm"
                    >
                      {target}
                      <button
                        onClick={() => removeIncludeTarget(target)}
                        disabled={!isEnabled || isLoading}
                        className="hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* 排除的目标模块（黑名单） */}
              <div>
                <h3 className="text-white font-medium mb-2">排除的目标模块（黑名单）</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newExcludeTarget}
                    onChange={(e) => setNewExcludeTarget(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddExcludeTarget()}
                    placeholder="例如: raflow::perf"
                    disabled={!isEnabled || isLoading}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleAddExcludeTarget}
                    disabled={!isEnabled || isLoading || !newExcludeTarget.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {excludeTargets.map((target: string) => (
                    <span
                      key={target}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/50 text-red-300 rounded text-sm"
                    >
                      {target}
                      <button
                        onClick={() => removeExcludeTarget(target)}
                        disabled={!isEnabled || isLoading}
                        className="hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* 信息提示 */}
              <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                <p className="text-sm text-blue-300">
                  💡 提示：日志配置将在下次应用启动时生效。目标模块使用 Rust 模块路径格式（例如：
                  <code className="px-1 bg-gray-800 rounded">raflow::audio</code>）
                </p>
              </div>
            </div>

            {/* 底部 */}
            <div className="flex justify-end p-4 border-t border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DebugPanel;
