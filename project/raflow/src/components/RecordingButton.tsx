// 录音按钮组件 - 带动画效果的录音控制按钮
import { motion } from 'framer-motion';

interface RecordingButtonProps {
  /**
   * 是否正在录音
   */
  isRecording: boolean;
  /**
   * 点击回调
   */
  onClick: () => void;
  /**
   * 是否禁用
   */
  disabled?: boolean;
}

/**
 * 录音按钮组件
 * 带脉冲动画效果的录音控制按钮
 */
export function RecordingButton({
  isRecording,
  onClick,
  disabled = false,
}: RecordingButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-20 h-20 rounded-full flex items-center justify-center
        transition-colors duration-300
        ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-primary-500 hover:bg-primary-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* 录音时的脉冲动画 */}
      <AnimatePresence>
        {isRecording && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              exit={{ scale: 1, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.3, opacity: 0 }}
              exit={{ scale: 1, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.5,
                ease: 'easeOut',
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* 按钮图标 */}
      <motion.div
        animate={
          isRecording
            ? { scale: [1, 0.8, 1], borderRadius: ['50%', '20%', '50%'] }
            : { scale: 1, borderRadius: '50%' }
        }
        transition={{ duration: 0.3 }}
        className="w-8 h-8 bg-white rounded-full"
      />
    </motion.button>
  );
}

// 导出 AnimatePresence 用于组件内部
import { AnimatePresence } from 'framer-motion';
