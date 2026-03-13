import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { RecordingStatus } from "../../hooks/useTranscription";

interface PulseVisualizerProps {
  level: number;
  status: RecordingStatus;
  compact?: boolean;
}

function getPulseColor(status: RecordingStatus): string {
  switch (status) {
    case "connecting":
      return "#FF9F0A";
    case "recording":
      return "#0A84FF";
    case "processing":
      return "#BF5AF2";
    case "error":
      return "#FF453A";
    default:
      return "#636366";
  }
}

export function PulseVisualizer({ level, status, compact = false }: PulseVisualizerProps) {
  const color = getPulseColor(status);
  const isActive = status === "recording" || status === "connecting" || status === "processing";
  const size = compact ? 24 : 36;

  // 使用时间实现动态脉动效果
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!isActive) {
      setTime(0);
      return;
    }
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 50);
    return () => clearInterval(interval);
  }, [isActive]);

  const t = time / 1000;

  // 使用对数映射放大音量效果，因为 RMS 值通常很小
  const logLevel = level > 0 ? Math.log10(1 + level * 100) / Math.log10(101) : 0;
  const effectiveLevel = isActive ? Math.max(0.05, logLevel) : 0.05;

  // 音量越大，脉动越明显
  const pulseWave = Math.sin(t * 6) * 0.08 * effectiveLevel;
  const volumeScale = effectiveLevel * 0.5;
  const scale = 0.5 + volumeScale + pulseWave;
  const glowIntensity = effectiveLevel * 60;

  return (
    <div className="flex items-center justify-center w-full h-full">
      <motion.div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: `0 0 ${glowIntensity}px ${glowIntensity / 2}px ${color}80`,
        }}
        animate={{
          scale,
          opacity: 0.5 + effectiveLevel * 0.5,
        }}
        transition={{
          duration: 0.08,
          ease: [0.4, 0, 0.2, 1],
        }}
      />
    </div>
  );
}
