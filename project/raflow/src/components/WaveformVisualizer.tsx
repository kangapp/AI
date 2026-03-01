import { motion } from "framer-motion";
import { useMemo } from "react";
import { RecordingStatus } from "../hooks/useTranscription";

interface WaveformVisualizerProps {
  level: number; // 0-1
  status: RecordingStatus;
}

/**
 * 获取波形颜色
 */
function getBarColors(status: RecordingStatus): { from: string; to: string } {
  switch (status) {
    case "recording":
      return { from: "rgb(96, 165, 250)", to: "rgb(168, 85, 247)" }; // blue-400 -> purple-500
    case "processing":
      return { from: "rgb(250, 204, 21)", to: "rgb(251, 191, 36)" }; // yellow-400 -> yellow-300
    case "error":
      return { from: "rgb(239, 68, 68)", to: "rgb(220, 38, 38)" }; // red-500 -> red-600
    default:
      return { from: "rgb(107, 114, 128)", to: "rgb(156, 163, 175)" }; // gray-500 -> gray-400
  }
}

export function WaveformVisualizer({ level, status }: WaveformVisualizerProps) {
  const bars = 20;
  const isActive = status === "recording";

  // 计算每个柱的高度
  const heights = useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      if (status === "idle" || status === "error") {
        // 空闲或错误状态：固定低高度
        return 0.15 + Math.random() * 0.1;
      }

      if (status === "processing") {
        // 处理中：脉冲效果
        const pulse = 0.3 + Math.sin(Date.now() / 200 + i * 0.5) * 0.2;
        return Math.max(0.1, pulse);
      }

      // 录音中：基于音频电平
      const centerBias = 1 - Math.abs(i - bars / 2) / (bars / 2);
      const baseHeight = level * 0.7 * centerBias;
      const randomOffset = Math.random() * 0.3;
      return Math.min(1, Math.max(0.1, baseHeight + randomOffset));
    });
  }, [level, status, bars]);

  const colors = getBarColors(status);

  return (
    <div className="flex items-center justify-center gap-[2px] h-10 mb-2">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{
            background: `linear-gradient(to top, ${colors.from}, ${colors.to})`,
          }}
          animate={{
            height: `${Math.max(4, h * 40)}px`,
            opacity: isActive ? 1 : 0.6,
          }}
          transition={{
            duration: status === "processing" ? 0.3 : 0.05,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
