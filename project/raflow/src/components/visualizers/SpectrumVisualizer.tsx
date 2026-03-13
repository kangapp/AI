import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { RecordingStatus } from "../../hooks/useTranscription";

interface SpectrumVisualizerProps {
  level: number;
  status: RecordingStatus;
  compact?: boolean;
}

function getRingColor(status: RecordingStatus): string {
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

export function SpectrumVisualizer({ level, status, compact = false }: SpectrumVisualizerProps) {
  const color = getRingColor(status);
  const isActive = status === "recording" || status === "connecting" || status === "processing";
  const ringCount = compact ? 3 : 5;
  const baseSize = compact ? 16 : 28;
  const ringGap = compact ? 4 : 6;

  // 使用时间实现动态效果
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

  // 使用对数映射放大音量效果
  const logLevel = level > 0 ? Math.log10(1 + level * 100) / Math.log10(101) : 0;
  const effectiveLevel = isActive ? Math.max(0.05, logLevel) : 0.05;

  const rings = useMemo(() => {
    return Array.from({ length: ringCount }).map((_, i) => {
      const ringIndex = ringCount - 1 - i;
      const baseRadius = baseSize + ringIndex * ringGap;

      // 每个环有自己的频率响应特征
      const freqOffset = (i + 1) * 0.5;
      const timeWave = Math.sin(t * 5 + freqOffset) * 0.15 * effectiveLevel;

      // 内圈受音量影响更大
      const ringVolumeScale = effectiveLevel * (1 - ringIndex * 0.15);
      const ringLevel = Math.max(0.05, ringVolumeScale + timeWave);

      const strokeWidth = 1 + ringLevel * 3;
      const opacity = 0.15 + ringLevel * 0.85;
      const scale = 1 + ringLevel * 0.1;
      const glow = ringLevel > 0.2 ? `0 0 ${ringLevel * 15}px ${color}60` : "none";

      return { baseRadius, strokeWidth, opacity, scale, glow, ringLevel };
    });
  }, [ringCount, baseSize, ringGap, effectiveLevel, t, color]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      {rings.map((ring, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: ring.baseRadius * 2,
            height: ring.baseRadius * 2,
            border: `${ring.strokeWidth}px solid ${color}`,
            opacity: Math.min(1, Math.max(0.1, ring.opacity)),
            boxShadow: ring.glow,
          }}
          animate={{
            scale: ring.scale,
          }}
          transition={{
            duration: 0.08,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      ))}
    </div>
  );
}
