import { useEffect, useState } from "react";
import { useTranscription, RecordingStatus } from "./hooks/useTranscription";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { WaveformVisualizer } from "./components/WaveformVisualizer";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Apple-style status configuration
 */
function getStatusConfig(status: RecordingStatus) {
  switch (status) {
    case "connecting":
      return {
        dotColor: "bg-orange-500",
        glowColor: "shadow-orange-500/50",
        text: "Connecting",
        textColor: "text-orange-400",
      };
    case "recording":
      return {
        dotColor: "bg-blue-500",
        glowColor: "shadow-blue-500/50",
        text: "Recording",
        textColor: "text-blue-400",
      };
    case "processing":
      return {
        dotColor: "bg-purple-500",
        glowColor: "shadow-purple-500/50",
        text: "Processing",
        textColor: "text-purple-400",
      };
    case "error":
      return {
        dotColor: "bg-red-500",
        glowColor: "shadow-red-500/50",
        text: "Error",
        textColor: "text-red-400",
      };
    default:
      return {
        dotColor: "bg-gray-500",
        glowColor: "shadow-gray-500/30",
        text: "Ready",
        textColor: "text-gray-400",
      };
  }
}

/**
 * Apple-style Status Indicator
 */
function StatusIndicator({ status }: { status: RecordingStatus }) {
  const config = getStatusConfig(status);
  const isActive = status === "recording" || status === "connecting" || status === "processing";

  return (
    <motion.div
      className={`flex items-center justify-center gap-2 ${config.textColor}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {/* Status dot with glow */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={isActive ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Glow effect */}
        <motion.div
          className={`absolute w-3.5 h-3.5 rounded-full ${config.dotColor} opacity-20 blur-md`}
          animate={isActive ? { scale: [1, 1.8, 1], opacity: [0.2, 0.4, 0.2] } : {}}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Main dot */}
        <div className={`w-2 h-2 rounded-full ${config.dotColor} shadow-lg ${config.glowColor}`} />
      </motion.div>

      {/* Status text */}
      <span className="text-[11px] font-semibold tracking-widest uppercase">
        {config.text}
      </span>
    </motion.div>
  );
}

/**
 * Apple-style Error Toast
 */
function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 backdrop-blur-sm mt-3"
    >
      {/* SF Symbols style warning icon */}
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM8 3.5c.414 0 .75.336.75.75v3.5a.75.75 0 01-1.5 0v-3.5c0-.414.336-.75.75-.75z" />
      </svg>
      <span className="text-red-400 text-[13px] font-medium">{message}</span>
    </motion.div>
  );
}

// Version from package.json (injected by Vite)
const APP_VERSION = "0.2.5";

function App() {
  const { status, partialText, committedText, audioLevel, error, debugEventCount, sessionStarting, audioThreadStarted, audioPipelineCreated, audioTimerStarted } = useTranscription();
  const isActive = status === "recording" || status === "connecting" || status === "processing";
  const [showError, setShowError] = useState(false);

  // Auto-show error toast
  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  // Show window when recording starts
  useEffect(() => {
    const win = getCurrentWindow();
    if (isActive) {
      win.show();
      win.setFocus();
    }
  }, [isActive]);

  return (
    <motion.div
      className="window-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Header: Status indicator */}
      <div className="flex-shrink-0 mb-1.5">
        <StatusIndicator status={status} />
      </div>

      {/* Waveform visualizer */}
      <div className="flex-shrink-0">
        <WaveformVisualizer level={audioLevel} status={status} />
      </div>

      {/* Transcript display - flexible height with scroll */}
      <div className="flex-1 min-h-0 w-full flex items-start justify-center overflow-hidden">
        <TranscriptDisplay
          partial={partialText}
          committed={committedText}
          status={status}
        />
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {showError && error && (
          <ErrorToast message={error.message} onDismiss={() => setShowError(false)} />
        )}
      </AnimatePresence>

      {/* Version number and debug info */}
      <div className="absolute bottom-1 right-2 text-[9px] text-gray-500/50 font-mono">
        v{APP_VERSION} | s:{sessionStarting ? "1" : "0"} t:{audioThreadStarted ? "1" : "0"} p:{audioPipelineCreated ? "1" : "0"} m:{audioTimerStarted ? "1" : "0"} | cnt:{debugEventCount} | rms:{audioLevel.toFixed(6)}
      </div>
    </motion.div>
  );
}

export default App;
