import { motion, AnimatePresence } from "framer-motion";
import { useTypewriter } from "../hooks/useTypewriter";
import { RecordingStatus } from "../hooks/useTranscription";

interface TranscriptDisplayProps {
  partial: string;
  committed: string;
  status: RecordingStatus;
}

// 动画配置
const textVariants = {
  enter: { opacity: 0, y: 10, scale: 1.05 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

const transition = { type: "spring", stiffness: 300, damping: 20 };

export function TranscriptDisplay({ partial, committed, status }: TranscriptDisplayProps) {
  // 打字机效果仅对 partial 文本启用
  const { displayText } = useTypewriter(partial, {
    charDelay: 25,
    enabled: status === "recording",
  });

  // 获取文字颜色
  const getTextColor = () => {
    if (status === "error") return "text-red-400";
    if (status === "processing") return "text-yellow-400";
    return "text-white";
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[3rem]">
      {/* 已确认的文字 */}
      <AnimatePresence mode="popLayout">
        {committed && (
          <motion.p
            key="committed"
            variants={textVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className={`${getTextColor()} text-sm font-medium text-center mb-1`}
          >
            {committed}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 部分识别的文字 (带打字机效果) */}
      <AnimatePresence mode="wait">
        {(displayText || partial) && (
          <motion.p
            key="partial"
            variants={textVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="text-gray-400 text-sm text-center"
          >
            {displayText || partial}
            {/* 闪烁光标 */}
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block ml-0.5"
            >
              |
            </motion.span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* 空状态提示 */}
      {!committed && !partial && !displayText && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          className="text-gray-500 text-xs"
        >
          {status === "connecting"
            ? "连接中..."
            : status === "recording"
            ? "正在聆听..."
            : "按 ⌘⇧H 开始录音"}
        </motion.p>
      )}
    </div>
  );
}
