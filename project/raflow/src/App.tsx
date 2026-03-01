import { useEffect, useState } from "react";
import { useTranscription, RecordingStatus } from "./hooks/useTranscription";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { WaveformVisualizer } from "./components/WaveformVisualizer";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 状态指示器组件
 */
function StatusIndicator({ status }: { status: RecordingStatus }) {
  const getStatusConfig = () => {
    switch (status) {
      case "connecting":
        return {
          color: "bg-yellow-500",
          text: "Connecting",
          textColor: "text-yellow-400",
          animate: { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] },
        };
      case "recording":
        return {
          color: "bg-blue-500",
          text: "Recording",
          textColor: "text-blue-400",
          animate: { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] },
        };
      case "processing":
        return {
          color: "bg-yellow-500",
          text: "Processing",
          textColor: "text-yellow-400",
          animate: { rotate: 360 },
        };
      case "error":
        return {
          color: "bg-red-500",
          text: "Error",
          textColor: "text-red-400",
          animate: {},
        };
      default:
        return {
          color: "bg-gray-500",
          text: "Idle",
          textColor: "text-gray-500",
          animate: {},
        };
    }
  };

  const config = getStatusConfig();
  const isRecording = status === "recording";
  const isConnecting = status === "connecting";
  const isProcessing = status === "processing";

  return (
    <div className={`flex items-center justify-center gap-1.5 mb-1 ${config.textColor}`}>
      <motion.div
        className={`w-2 h-2 rounded-full ${config.color}`}
        animate={config.animate}
        transition={
          isRecording || isConnecting
            ? { duration: 0.8, repeat: Infinity }
            : isProcessing
            ? { duration: 1, repeat: Infinity, ease: "linear" }
            : {}
        }
      />
      <span className="text-xs">{config.text}</span>
    </div>
  );
}

/**
 * 错误提示组件
 */
function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="text-red-400 text-xs bg-red-500/10 px-2 py-1 rounded mt-2"
    >
      {message}
    </motion.div>
  );
}

function App() {
  const { status, partialText, committedText, audioLevel, error } = useTranscription();
  const isRecording = status === "recording";
  const [showError, setShowError] = useState(false);

  console.log("[App] status:", status, "isRecording:", isRecording);

  // 显示错误时自动显示 toast
  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  useEffect(() => {
    const win = getCurrentWindow();

    // Show window when recording starts
    if (isRecording) {
      win.show();
      win.setFocus();
    }
  }, [isRecording]);

  // 获取背景颜色
  const getBgClass = () => {
    switch (status) {
      case "connecting":
        return "rgba(59, 50, 30, 0.9)"; // 微黄 (连接中)
      case "recording":
        return "rgba(30, 58, 95, 0.9)"; // 微蓝
      case "processing":
        return "rgba(59, 50, 30, 0.9)"; // 微黄
      case "error":
        return "rgba(59, 30, 30, 0.9)"; // 微红
      default:
        return "rgba(30, 30, 30, 0.9)";
    }
  };

  return (
    <div
      className="window-container"
      style={{ background: getBgClass() }}
    >
      <StatusIndicator status={status} />
      <WaveformVisualizer level={audioLevel} status={status} />
      <TranscriptDisplay
        partial={partialText}
        committed={committedText}
        status={status}
      />

      <AnimatePresence>
        {showError && error && (
          <ErrorToast message={error.message} onDismiss={() => setShowError(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
