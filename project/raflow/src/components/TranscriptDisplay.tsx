// 转录结果显示组件 - 显示实时转录和确认转录
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptDisplayProps {
  /**
   * 实时转录文本（灰色，中间结果）
   */
  partialTranscript: string;
  /**
   * 确认转录文本（白色，最终结果）
   */
  committedTranscript: string;
  /**
   * 最大显示高度（超过则滚动）
   */
  maxHeight?: string;
}

/**
 * 转录结果显示组件
 * 显示实时转录（灰色）和确认转录（白色）文本
 */
export function TranscriptDisplay({
  partialTranscript,
  committedTranscript,
  maxHeight = '200px',
}: TranscriptDisplayProps) {
  const hasContent = committedTranscript || partialTranscript;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden ${
        hasContent ? 'border border-gray-700' : ''
      }`}
      style={{ maxHeight }}
    >
      {hasContent ? (
        <div className="p-4 space-y-2">
          {/* 确认转录（白色） */}
          <AnimatePresence>
            {committedTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words"
              >
                {committedTranscript}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 实时转录（灰色） */}
          <AnimatePresence>
            {partialTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap break-words"
              >
                {partialTranscript}
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block w-1 h-4 bg-primary-500 ml-1 align-middle"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500 text-sm">
          开始录音后，转录内容将显示在这里...
        </div>
      )}
    </motion.div>
  );
}
