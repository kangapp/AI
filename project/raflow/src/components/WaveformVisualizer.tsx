import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { RecordingStatus } from "../hooks/useTranscription";

interface WaveformVisualizerProps {
  level: number; // 0-1
  status: RecordingStatus;
}

/**
 * Apple-style glow colors for active states
 */
function getGlowColor(status: RecordingStatus): string {
  switch (status) {
    case "connecting":
      return "0 0 8px rgba(255, 159, 10, 0.4)"; // Orange glow
    case "recording":
      return "0 0 8px rgba(10, 132, 255, 0.3)"; // Blue glow
    case "processing":
      return "0 0 8px rgba(191, 90, 242, 0.3)"; // Purple glow
    default:
      return "none";
  }
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

/**
 * Calculate bar heights based on status and audio level
 */
function calculateHeights(
  status: RecordingStatus,
  level: number,
  time: number
): number[] {
  const bars = 24;

  return Array.from({ length: bars }, (_, i) => {
    // Idle or error: subtle breathing animation
    if (status === "idle" || status === "error") {
      return 0.12 + Math.sin(time / 1000 + i * 0.3) * 0.05;
    }

    // Processing: gentle wave (waiting for final transcript)
    if (status === "processing") {
      const wave = Math.sin(time / 300 + i * 0.4) * 0.3 + 0.35;
      return Math.max(0.15, wave);
    }

    // Connecting/Recording: responsive to audio level
    // This gives users immediate feedback that the microphone is working
    const centerBias = 1 - Math.abs(i - bars / 2) / (bars / 2);
    const amplifiedLevel = Math.pow(level, 0.4); // More sensitive
    const baseHeight = amplifiedLevel * 0.85 * centerBias;
    const organicOffset = Math.sin(time / 100 + i * 0.5) * 0.08;
    return Math.min(1, Math.max(0.1, baseHeight + organicOffset));
  });
}

export function WaveformVisualizer({ level, status }: WaveformVisualizerProps) {
  // Active states: show glow effect and respond to audio
  const isActive = status === "recording" || status === "connecting";

  // Use time state to ensure continuous animation updates
  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    // Only animate when in an active state
    if (status === "idle" || status === "error") {
      // Slow animation for idle/error
      const interval = setInterval(() => {
        setTime(Date.now());
      }, 100); // 10 FPS for breathing animation
      return () => clearInterval(interval);
    }

    if (status === "processing") {
      // Medium animation for processing
      const interval = setInterval(() => {
        setTime(Date.now());
      }, 50); // 20 FPS for wave animation
      return () => clearInterval(interval);
    }

    // Fast animation for connecting/recording
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 16); // ~60 FPS for responsive audio visualization
    return () => clearInterval(interval);
  }, [status]);

  // Calculate heights with current time
  const heights = calculateHeights(status, level, time);

  const gradient = getBarGradient(status);
  const glowColor = getGlowColor(status);

  return (
    <div className="flex items-end justify-center gap-[3px] h-12 mb-3 px-2">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            background: gradient,
            width: "3px",
            boxShadow: glowColor,
          }}
          animate={{
            height: `${Math.max(6, h * 44)}px`,
            opacity: isActive ? 1 : 0.6,
          }}
          transition={{
            duration: 0.05,
            ease: [0.4, 0, 0.2, 1], // Apple-style easing
          }}
        />
      ))}
    </div>
  );
}
