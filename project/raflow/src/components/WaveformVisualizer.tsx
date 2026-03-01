import { motion } from "framer-motion";
import { useMemo } from "react";
import { RecordingStatus } from "../hooks/useTranscription";

interface WaveformVisualizerProps {
  level: number; // 0-1
  status: RecordingStatus;
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

export function WaveformVisualizer({ level, status }: WaveformVisualizerProps) {
  const bars = 24;
  const isActive = status === "recording";

  // Calculate bar heights with Apple-style animation
  const heights = useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      // Idle or error: subtle breathing animation
      if (status === "idle" || status === "error") {
        return 0.12 + Math.sin(Date.now() / 1000 + i * 0.3) * 0.05;
      }

      // Connecting/Processing: gentle wave
      if (status === "connecting" || status === "processing") {
        const wave = Math.sin(Date.now() / 300 + i * 0.4) * 0.3 + 0.35;
        return Math.max(0.15, wave);
      }

      // Recording: responsive to audio level
      const centerBias = 1 - Math.abs(i - bars / 2) / (bars / 2);
      const amplifiedLevel = Math.pow(level, 0.4); // More sensitive
      const baseHeight = amplifiedLevel * 0.85 * centerBias;
      const organicOffset = Math.sin(Date.now() / 100 + i * 0.5) * 0.08;
      return Math.min(1, Math.max(0.1, baseHeight + organicOffset));
    });
  }, [level, status]);

  const gradient = getBarGradient(status);

  return (
    <div className="flex items-end justify-center gap-[3px] h-12 mb-3 px-2">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            background: gradient,
            width: "3px",
            boxShadow: isActive ? "0 0 8px rgba(10, 132, 255, 0.3)" : "none",
          }}
          animate={{
            height: `${Math.max(6, h * 44)}px`,
            opacity: isActive ? 1 : 0.6,
          }}
          transition={{
            duration: 0.08,
            ease: [0.4, 0, 0.2, 1], // Apple-style easing
          }}
        />
      ))}
    </div>
  );
}
