import { motion, AnimatePresence } from "framer-motion";
import { useTypewriter } from "../hooks/useTypewriter";
import { RecordingStatus } from "../hooks/useTranscription";
import { useEffect, useRef } from "react";

interface TranscriptDisplayProps {
  partial: string;
  committed: string;
  status: RecordingStatus;
  fontSize?: number;
  textColor?: string;
  compact?: boolean;
}

// Apple-style animation variants
const textVariants = {
  enter: { opacity: 0, y: 4 },
  center: { opacity: 1, y: 0 },
};

const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

/**
 * Get text color based on status
 */
function getTextColor(status: RecordingStatus): string {
  switch (status) {
    case "error": return "text-red-400";
    case "processing": return "text-purple-400";
    case "connecting": return "text-orange-400";
    case "recording": return "text-white";
    default: return "text-gray-300";
  }
}

/**
 * Get secondary text color for partial text
 */
function getPartialColor(status: RecordingStatus): string {
  switch (status) {
    case "recording": return "text-blue-300/80";
    default: return "text-gray-500";
  }
}

export function TranscriptDisplay({
  partial,
  committed,
  status,
  fontSize = 14,
  textColor,
  compact = false,
}: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Typewriter effect
  const { displayText } = useTypewriter(partial, {
    charDelay: 15,
    enabled: status === "recording",
  });

  // committed text: 使用用户自定义颜色或状态颜色
  const mainColor = textColor || getTextColor(status);
  // partial text: 使用更淡的颜色来区分（如果是自定义颜色则降低透明度）
  const partialColor = textColor
    ? `${textColor}80` // 自定义颜色 + 50% 透明度
    : getPartialColor(status);

  // Always scroll to bottom when content changes
  useEffect(() => {
    if (containerRef.current && contentRef.current) {
      const container = containerRef.current;
      const content = contentRef.current;
      // Calculate the required scroll position
      const scrollTarget = content.scrollHeight - container.clientHeight;
      // Direct scroll without animation to avoid bounce
      container.scrollTop = Math.max(0, scrollTarget);
    }
  }, [committed, displayText, partial]);

  // 只有在非 idle 状态或者有 committed 内容时才显示内容
  const hasContent = committed || (status !== "idle" && (displayText || partial));

  // Dynamic style based on settings
  const textStyle = {
    fontSize: compact ? `${Math.max(12, fontSize - 1)}px` : `${fontSize}px`,
    color: textColor || undefined,
    lineHeight: 1.65,
  };

  // 紧凑模式下隐藏空闲提示
  const showIdleHint = !compact && status === "idle";

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden"
      style={{
        overscrollBehavior: "none",
        WebkitOverflowScrolling: "auto",
      }}
    >
      {/* Content wrapper - 左对齐，更适合阅读 */}
      <div
        ref={contentRef}
        className="text-left px-1 pb-2 pt-0.5"
        style={{
          wordWrap: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        <AnimatePresence mode="wait">
          {hasContent ? (
            <motion.div
              key="text-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Committed text */}
              {committed && (
                <motion.span
                  variants={textVariants}
                  initial="enter"
                  animate="center"
                  transition={springTransition}
                  className="font-normal leading-relaxed"
                  style={{ ...textStyle, color: mainColor }}
                >
                  {committed}
                </motion.span>
              )}

              {/* Partial text - 只有在 recording 或 connecting 状态才显示 */}
              {(displayText || partial) && (status === "recording" || status === "connecting") && (
                <motion.span
                  variants={textVariants}
                  initial="enter"
                  animate="center"
                  transition={springTransition}
                  className="leading-relaxed"
                  style={{ ...textStyle, color: partialColor }}
                >
                  {committed && " "}
                  {displayText || partial}
                  {/* Blinking cursor - 只有在 recording 状态才显示光标 */}
                  {status === "recording" && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="inline-block ml-0.5 font-light align-middle"
                      style={{ color: mainColor }}
                    >
                      |
                    </motion.span>
                  )}
                </motion.span>
              )}
            </motion.div>
          ) : (
            /* Empty state - 重新设计 */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="flex flex-col items-start gap-1"
            >
              <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} text-gray-500 font-normal`}>
                {status === "connecting"
                  ? "正在连接..."
                  : status === "recording"
                  ? "正在聆听..."
                  : status === "error"
                  ? "发生错误"
                  : "按 ⌘⇧H 开始录音"}
              </span>
              {showIdleHint && (
                <span className="text-gray-600 text-[11px]">
                  语音将自动转录为文字
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
