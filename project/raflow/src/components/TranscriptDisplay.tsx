import { motion, AnimatePresence } from "framer-motion";
import { useTypewriter } from "../hooks/useTypewriter";
import { RecordingStatus } from "../hooks/useTranscription";
import { useEffect, useRef } from "react";

interface TranscriptDisplayProps {
  partial: string;
  committed: string;
  status: RecordingStatus;
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
    case "recording": return "text-blue-300/70";
    default: return "text-gray-500";
  }
}

export function TranscriptDisplay({ partial, committed, status }: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Typewriter effect
  const { displayText } = useTypewriter(partial, {
    charDelay: 15,
    enabled: status === "recording",
  });

  const mainColor = getTextColor(status);
  const partialColor = getPartialColor(status);

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

  const hasContent = committed || displayText || partial;

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 overflow-y-auto overflow-x-hidden"
      style={{
        maxHeight: "5rem",
        minHeight: "3rem",
        overscrollBehavior: "none",
        WebkitOverflowScrolling: "auto",
      }}
    >
      {/* Content wrapper with bottom padding to ensure last line is fully visible */}
      <div
        ref={contentRef}
        className="text-center px-3 pb-4 pt-1"
        style={{
          wordWrap: "break-word",
          overflowWrap: "anywhere",
          lineHeight: 1.6,
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
                  className={`${mainColor} text-[15px] font-medium tracking-tight`}
                >
                  {committed}
                </motion.span>
              )}

              {/* Partial text */}
              {(displayText || partial) && (
                <motion.span
                  variants={textVariants}
                  initial="enter"
                  animate="center"
                  transition={springTransition}
                  className={`${partialColor} text-[15px] tracking-tight`}
                >
                  {committed && " "}
                  {displayText || partial}
                  {/* Blinking cursor */}
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="inline-block ml-0.5 text-blue-400 font-light align-middle"
                  >
                    |
                  </motion.span>
                </motion.span>
              )}
            </motion.div>
          ) : (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-gray-500 text-[13px] font-medium">
                {status === "connecting"
                  ? "正在连接..."
                  : status === "recording"
                  ? "正在聆听..."
                  : status === "error"
                  ? "发生错误"
                  : "按 ⌘⇧H 开始录音"}
              </span>
              {status === "idle" && (
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
