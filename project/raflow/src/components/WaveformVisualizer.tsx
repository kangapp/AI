import { motion } from "framer-motion";
import { RecordingStatus } from "../hooks/useTranscription";

interface WaveformVisualizerProps {
  level: number; // 0-1
  status: RecordingStatus;
  compact?: boolean;
}

/**
 * Apple-style waveform colors
 */
function getBarGradient(status: RecordingStatus): string {
  switch (status) {
    case "connecting":
      return "linear-gradient(180deg, #FF9F0A 0%, #FFD60A 100%)"; // Orange to Yellow
    case "recording":
      return "linear-gradient(180deg, #0A84FF 0%, #5AC8FA 100%)"; // Blue to Light Blue
    case "processing":
      return "linear-gradient(180deg, #BF5AF2 0%, #5E5CE6 100%)"; // Purple to Indigo
    case "error":
      return "linear-gradient(180deg, #FF453A 0%, #FF6961 100%)"; // Red
    default:
      return "linear-gradient(180deg, #636366 0%, #8E8E93 100%)"; // Gray
  }
}

export function WaveformVisualizer({ level, status, compact = false }: WaveformVisualizerProps) {
  const isActive = status === "recording";
  const gradient = getBarGradient(status);
  const barCount = compact ? 12 : 24;

  // 使用百分比计算高度
  return (
    <div className="flex items-end justify-center gap-px h-full w-full px-1">
      {Array.from({ length: barCount }).map((_, i) => {
        // 动态计算高度
        let normalizedHeight: number;
        const t = Date.now() / 1000;

        if (status === "idle" || status === "error") {
          normalizedHeight = 0.15 + Math.sin(t * 2 + i * 0.4) * 0.08;
        } else if (status === "connecting" || status === "processing") {
          normalizedHeight = Math.sin(t * 3 + i * 0.5) * 0.35 + 0.4;
        } else {
          const centerBias = 1 - Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
          const amplifiedLevel = Math.pow(level, 0.4);
          normalizedHeight = amplifiedLevel * 0.9 * centerBias + Math.sin(t * 8 + i * 0.6) * 0.1;
        }
        normalizedHeight = Math.min(1, Math.max(0.1, normalizedHeight));

        return (
          <motion.div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{
              background: gradient,
              width: '3%',
              maxWidth: '4px',
              boxShadow: isActive ? "0 0 8px rgba(10, 132, 255, 0.3)" : "none",
            }}
            animate={{
              height: `${normalizedHeight * 100}%`,
              opacity: isActive ? 1 : 0.5,
            }}
            transition={{
              duration: 0.1,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        );
      })}
    </div>
  );
}
