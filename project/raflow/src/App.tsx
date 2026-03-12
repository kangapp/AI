import { useEffect, useState, useRef } from "react";
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
        text: "正在连接",
        textColor: "text-orange-400",
        bgAccent: "bg-orange-500/10",
        borderColor: "border-orange-500/20",
      };
    case "recording":
      return {
        dotColor: "bg-blue-500",
        glowColor: "shadow-blue-500/50",
        text: "录音中",
        textColor: "text-blue-400",
        bgAccent: "bg-blue-500/10",
        borderColor: "border-blue-500/20",
      };
    case "processing":
      return {
        dotColor: "bg-purple-500",
        glowColor: "shadow-purple-500/50",
        text: "处理中",
        textColor: "text-purple-400",
        bgAccent: "bg-purple-500/10",
        borderColor: "border-purple-500/20",
      };
    case "error":
      return {
        dotColor: "bg-red-500",
        glowColor: "shadow-red-500/50",
        text: "错误",
        textColor: "text-red-400",
        bgAccent: "bg-red-500/10",
        borderColor: "border-red-500/20",
      };
    default:
      return {
        dotColor: "bg-gray-500",
        glowColor: "shadow-gray-500/30",
        text: "就绪",
        textColor: "text-gray-400",
        bgAccent: "bg-gray-500/5",
        borderColor: "border-gray-500/10",
      };
  }
}

/**
 * Apple-style Status Indicator - 重新设计
 */
function StatusIndicator({ status }: { status: RecordingStatus }) {
  const config = getStatusConfig(status);
  const isActive = status === "recording" || status === "connecting" || status === "processing";

  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgAccent} border ${config.borderColor}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {/* Status dot with glow */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Glow effect */}
        <motion.div
          className={`absolute w-2.5 h-2.5 rounded-full ${config.dotColor} opacity-30 blur-sm`}
          animate={isActive ? { scale: [1, 2, 1], opacity: [0.3, 0.5, 0.3] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Main dot */}
        <div className={`w-2 h-2 rounded-full ${config.dotColor} shadow-lg ${config.glowColor}`} />
      </motion.div>

      {/* Status text */}
      <span className={`text-[12px] font-medium ${config.textColor}`}>
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
      {/* Warning icon */}
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
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [windowHeight, setWindowHeight] = useState(180);

  // 监听窗口尺寸变化以调整布局
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setWindowHeight(containerRef.current.offsetHeight);
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // 计算布局模式
  const layoutMode = windowHeight < 140 ? 'compact' : windowHeight < 200 ? 'normal' : 'expanded';

  const [windowSettings, setWindowSettings] = useState<WindowSettings>({
    position: null,
    window_size: { width: 380, height: 160 },
    font_size: 14,
    text_color: '#FFFFFF',
    background_color: '#1C1C1E',
    background_opacity: 85,
    hidden: false,
  });

  // Load window settings on mount and apply
  useEffect(() => {
    invoke<WindowSettings>('get_window_settings').then(async (settings) => {
      setWindowSettings(settings);
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

  // Listen for settings changes from SettingsPanel
  useEffect(() => {
    const unlisten = listen<WindowSettings>('settings-changed', (event) => {
      setWindowSettings(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Update window background color based on theme
  useEffect(() => {
    const bgColor = windowSettings.background_color;
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const opacity = windowSettings.background_opacity / 100;
    document.documentElement.style.setProperty('--window-bg', `rgba(${r}, ${g}, ${b}, ${opacity})`);
  }, [windowSettings.background_color, windowSettings.background_opacity]);

  return (
    <motion.div
      ref={containerRef}
      className="window-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {view === 'main' ? (
        <div className="flex flex-col h-full w-full">
          {/* Header: Status indicator + Settings */}
          <motion.div
            className="flex items-center justify-between flex-shrink-0"
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{
              marginBottom: layoutMode === 'compact' ? '4px' : layoutMode === 'normal' ? '8px' : '12px'
            }}
          >
            <StatusIndicator status={status} />
            <button
              onClick={() => setView('settings')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all duration-200 ${
                isRecording ? 'hover:bg-white/15' : ''
              }`}
            >
              <motion.svg
                whileHover={{ rotate: 30 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </motion.svg>
            </button>
          </motion.div>

          {/* Main content area - 居中布局，更简洁 */}
          <div ref={contentRef} className="flex-1 flex flex-col items-center justify-center min-h-0">
            {/* Waveform visualizer - 居中显示 */}
            <motion.div
              layout
              className="flex-shrink-0 overflow-hidden w-full max-w-[200px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: layoutMode === 'compact' ? 0.5 : 1 }}
              transition={{ duration: 0.2 }}
              style={{
                height: layoutMode === 'compact' ? '16px' : layoutMode === 'normal' ? '24px' : '32px',
                marginBottom: layoutMode === 'compact' ? '6px' : layoutMode === 'normal' ? '10px' : '14px'
              }}
            >
              <WaveformVisualizer
                level={audioLevel}
                status={status}
                compact={layoutMode === 'compact'}
              />
            </motion.div>

            {/* Transcript display - 居中，更简洁的阅读体验 */}
            <motion.div
              layout
              className="flex-1 min-h-0 w-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <TranscriptDisplay
                partial={partialText}
                committed={committedText}
                status={status}
                fontSize={windowSettings.font_size}
                textColor={windowSettings.text_color}
                compact={layoutMode === 'compact'}
              />
            </motion.div>
          </div>

          {/* Error toast */}
          <AnimatePresence>
            {showError && error && (
              <ErrorToast message={error.message} onDismiss={() => setShowError(false)} />
            )}
          </AnimatePresence>
        </div>
      ) : (
        <SettingsPanel onBack={() => setView('main')} />
      )}
    </motion.div>
  );
}

export default App;
