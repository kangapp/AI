// 权限引导组件 - 引导用户授予必要的系统权限
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useAppStore } from '../stores/useAppStore';

interface PermissionGuideProps {
  /**
   * 是否显示
   */
  isOpen: boolean;
  /**
   * 关闭回调
   */
  onClose: () => void;
}

/**
 * 权限引导组件
 * 引导用户授予麦克风和辅助功能权限
 */
export function PermissionGuide({
  isOpen,
  onClose,
}: PermissionGuideProps) {
  const { permissionStatus, requestMicrophonePermission, requestAccessibilityPermission } =
    usePermissions();
  const { apiKey, setApiKey } = useAppStore();
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'welcome',
      title: '欢迎使用 RaFlow',
      description:
        '在开始使用之前，我们需要一些权限和配置来确保应用正常运行。',
    },
    {
      id: 'apiKey',
      title: '配置 API 密钥',
      description:
        '请输入您的 ElevenLabs API 密钥以启用语音转文字功能。',
    },
    {
      id: 'microphone',
      title: '麦克风权限',
      description:
        'RaFlow 需要访问您的麦克风来录制音频并进行转录。',
    },
    {
      id: 'accessibility',
      title: '辅助功能权限',
      description:
        '为了实现智能文本注入，RaFlow 需要辅助功能权限来检测可编辑元素。（仅 macOS）',
    },
    {
      id: 'complete',
      title: '设置完成',
      description: '所有必要的权限和配置已完成。您可以开始使用 RaFlow 了！',
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = async () => {
    switch (currentStepData.id) {
      case 'apiKey':
        if (!localApiKey.trim()) {
          return;
        }
        setApiKey(localApiKey.trim());
        setCurrentStep((prev) => prev + 1);
        break;

      case 'microphone':
        if (permissionStatus.microphone !== 'granted') {
          const granted = await requestMicrophonePermission();
          if (!granted) {
            return;
          }
        }
        setCurrentStep((prev) => prev + 1);
        break;

      case 'accessibility':
        // 非 macOS 平台跳过此步骤
        if (process.platform !== 'darwin') {
          setCurrentStep((prev) => prev + 1);
          return;
        }

        if (permissionStatus.accessibility !== 'granted') {
          const granted = await requestAccessibilityPermission();
          if (!granted) {
            return;
          }
        }
        setCurrentStep((prev) => prev + 1);
        break;

      default:
        setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    // 允许跳过非关键步骤
    if (currentStepData.id === 'accessibility' || currentStepData.id === 'microphone') {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  const canSkip =
    currentStepData.id === 'accessibility' || currentStepData.id === 'microphone';

  const canProceed =
    (currentStepData.id === 'apiKey' && localApiKey.trim()) ||
    currentStepData.id === 'welcome' ||
    currentStepData.id === 'complete' ||
    (currentStepData.id === 'microphone' && permissionStatus.microphone === 'granted') ||
    (currentStepData.id === 'accessibility' &&
      (process.platform !== 'darwin' || permissionStatus.accessibility === 'granted'));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* 对话框 */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
            >
              {/* 进度指示器 */}
              <div className="px-6 pt-6">
                <div className="flex gap-2">
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      className={`h-1 flex-1 rounded-full ${
                        index <= currentStep
                          ? 'bg-primary-500'
                          : 'bg-gray-700'
                      }`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: index * 0.1 }}
                    />
                  ))}
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-6 space-y-4">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-xl font-bold text-white mb-2">
                    {currentStepData.title}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {currentStepData.description}
                  </p>

                  {/* API 密钥输入 */}
                  {currentStepData.id === 'apiKey' && (
                    <div className="mt-4 space-y-2">
                      <input
                        type="password"
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        placeholder="sk_..."
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-500">
                        您的 API 密钥将被安全存储在本地，不会上传到我们的服务器。
                      </p>
                    </div>
                  )}

                  {/* 权限状态显示 */}
                  {currentStepData.id === 'microphone' && (
                    <div className="mt-4">
                      <div
                        className={`flex items-center gap-2 text-sm ${
                          permissionStatus.microphone === 'granted'
                            ? 'text-green-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {permissionStatus.microphone === 'granted' ? (
                          <>
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            已授予
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {permissionStatus.microphone === 'not-determined'
                              ? '未授予'
                              : '已拒绝'}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {currentStepData.id === 'accessibility' &&
                    process.platform === 'darwin' && (
                      <div className="mt-4">
                        <div
                          className={`flex items-center gap-2 text-sm ${
                            permissionStatus.accessibility === 'granted'
                              ? 'text-green-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {permissionStatus.accessibility === 'granted' ? (
                            <>
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              已授予
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {permissionStatus.accessibility ===
                              'not-determined'
                                ? '未授予'
                                : '已拒绝'}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                </motion.div>
              </div>

              {/* 操作按钮 */}
              <div className="px-6 pb-6 flex gap-3">
                {canSkip && (
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    跳过
                  </button>
                )}
                <div className="flex-1" />
                {currentStepData.id === 'complete' ? (
                  <button
                    onClick={handleFinish}
                    className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    开始使用
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className={`px-6 py-2 rounded-lg transition-colors text-sm font-medium ${
                      canProceed
                        ? 'bg-primary-500 hover:bg-primary-600 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {currentStep === steps.length - 1 ? '完成' : '继续'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
