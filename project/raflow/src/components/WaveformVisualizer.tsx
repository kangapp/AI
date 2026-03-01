import { motion } from "framer-motion";

interface WaveformVisualizerProps {
  level: number; // 0-1
  isRecording: boolean;
}

export function WaveformVisualizer({ level, isRecording }: WaveformVisualizerProps) {
  const bars = 5;
  const heights = Array.from({ length: bars }, (_, i) => {
    const centerOffset = Math.abs(i - Math.floor(bars / 2));
    const baseHeight = 0.3 + (1 - centerOffset / Math.floor(bars / 2)) * 0.5;
    return baseHeight * level * (isRecording ? 1 : 0.3);
  });

  return (
    <div className="flex items-center justify-center gap-1 h-8 mb-2">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 bg-blue-400 rounded-full"
          animate={{
            height: `${Math.max(4, h * 32)}px`,
            opacity: isRecording ? 1 : 0.3,
          }}
          transition={{ duration: 0.05 }}
        />
      ))}
    </div>
  );
}
