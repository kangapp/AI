// API 密钥输入组件
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApiConfigStore } from '../stores/useApiConfigStore';
import { Check, X, Eye, EyeOff, Loader2 } from 'lucide-react';

export const APIKeyInput: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const {
    configStatus,
    isValidating,
    isSaving,
    validationError,
    saveError,
    loadConfigStatus,
    saveApiKey,
    validateApiKey,
    clearErrors,
  } = useApiConfigStore();

  useEffect(() => {
    loadConfigStatus();
  }, [loadConfigStatus]);

  const handleSave = async () => {
    clearErrors();

    // 验证格式
    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return;
    }

    // 保存
    try {
      await saveApiKey(apiKey);
      setIsEditing(false);
      setApiKey('');
    } catch (error) {
      // 错误已在 store 中处理
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setApiKey('');
    clearErrors();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setApiKey('');
  };

  const hasKey = configStatus?.has_api_key ?? false;
  const keyPreview = configStatus?.key_preview ?? '';

  return (
    <div className="space-y-4">
      {/* 当前状态显示 */}
      {!isEditing && (
        <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur rounded-lg border border-white/10">
          <div className="flex items-center space-x-3">
            {hasKey ? (
              <>
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-300">已配置 API 密钥</p>
                  <p className="text-xs text-gray-500 font-mono">{keyPreview}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <X className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-sm text-gray-300">未配置 API 密钥</p>
              </>
            )}
          </div>
          <button
            onClick={handleEdit}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            {hasKey ? '更改' : '添加'}
          </button>
        </div>
      )}

      {/* 编辑表单 */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ElevenLabs API 密钥
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 pr-24"
                  disabled={isSaving || isValidating}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {(isSaving || isValidating) && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                获取 API 密钥:{' '}
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ElevenLabs 控制台
                </a>
              </p>
            </div>

            {/* 错误信息 */}
            <AnimatePresence>
              {(validationError || saveError) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <p className="text-sm text-red-400">{validationError || saveError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 操作按钮 */}
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={isSaving || isValidating || !apiKey.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {(isSaving || isValidating) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <span>保存</span>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving || isValidating}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
