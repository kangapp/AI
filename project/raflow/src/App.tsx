import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranscription, RecordingStatus } from "./hooks/useTranscription";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { WaveformVisualizer } from "./components/WaveformVisualizer";
import { SettingsPanel } from './components/SettingsPanel';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";

interface WindowSettings {
  position: { x: number; y: number } | null;
  window_size: { width: number; height: number };
  font_size: number;
  text_color: string;
  background_color: string;
  background_opacity: number;
  hidden: boolean;
}

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

function App() {
  const { status, partialText, committedText, audioLevel, error } = useTranscription();
  const isRecording = status === "recording";
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [showError, setShowError] = useState(false);

  // Load window settings on mount and apply
  useEffect(() => {
    invoke<WindowSettings>('get_window_settings').then(async (settings) => {
      // Apply hidden state
      if (settings.hidden) {
        await invoke('hide_window');
      }
      // Restore window position
      if (settings.position) {
        await invoke('set_window_position', {
          x: settings.position.x,
          y: settings.position.y
        });
      }
      // Restore window size
      await invoke('set_window_size', {
        width: settings.window_size.width,
        height: settings.window_size.height
      });
    }).catch(console.error);
  }, []);

  // Auto-show error toast
  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  // Show window when recording starts
  useEffect(() => {
    const win = getCurrentWindow();
    if (isRecording) {
      win.show();
      win.setFocus();
    }
  }, [isRecording]);

  // Listen for open-settings event from tray menu
  useEffect(() => {
    const unlisten = listen('open-settings', () => {
      setView('settings');
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <motion.div
      className="window-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {view === 'main' ? (
        <>
          {/* Header: Status indicator + Settings */}
          <div className="flex items-center justify-between mb-1.5">
            <StatusIndicator status={status} />
            <button
              onClick={() => setView('settings')}
              className="p-1 rounded-md hover:bg-gray-700/50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
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
        </>
      ) : (
        <SettingsPanel onBack={() => setView('main')} />
      )}
    </motion.div>
  );
}

export default App;
