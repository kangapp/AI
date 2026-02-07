// 设置面板组件
import React from 'react';
import { motion } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { APIKeyInput } from './APIKeyInput';

interface SettingsPanelProps {
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-6">
          {/* API 配置部分 */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">API 配置</h3>
            <APIKeyInput />
          </div>

          {/* 其他设置占位 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300">其他设置</h3>
            <p className="text-xs text-gray-500">更多设置即将推出...</p>
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 bg-white/5 border-t border-white/10">
          <p className="text-xs text-center text-gray-500">
            RaFlow v0.1.0 - 实时语音转文字
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
