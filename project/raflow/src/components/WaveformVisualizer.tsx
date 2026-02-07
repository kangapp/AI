// 波形可视化组件 - 使用 Framer Motion 实现音频波形动画
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface WaveformVisualizerProps {
  /**
   * 音频电平 (0-1)
   */
  audioLevel: number;
  /**
   * 是否正在录音
   */
  isRecording: boolean;
  /**
   * 波形条数量
   */
  barCount?: number;
}

/**
 * 波形可视化组件
 * 显示音频录制的实时波形动画
 */
export function WaveformVisualizer({
  audioLevel,
  isRecording,
  barCount = 20,
}: WaveformVisualizerProps) {
  // 生成波形条高度
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      // 使用正弦函数生成平滑的波形效果
      const normalizedIndex = (i / barCount) * Math.PI * 2;
      const baseHeight = Math.sin(normalizedIndex) * 0.5 + 0.5; // 0-1
      // 添加音频电平影响和随机波动
      const variation = Math.random() * 0.3;
      return Math.max(0.1, baseHeight * audioLevel + variation);
    });
  }, [audioLevel, barCount]);

  return (
    <div className="flex items-center justify-center gap-1 h-16">
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className="w-1 bg-primary-500 rounded-full"
          initial={{ height: '4px' }}
          animate={{
            height: isRecording ? `${height * 60}px` : '4px',
            opacity: isRecording ? 1 : 0.3,
          }}
          transition={{
            duration: 0.15,
            ease: 'easeOut',
          }}
          style={{
            minHeight: '4px',
          }}
        />
      ))}
    </div>
  );
}
