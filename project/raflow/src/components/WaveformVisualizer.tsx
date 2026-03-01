import { useRef, useEffect, useCallback } from 'react';

interface WaveformVisualizerProps {
  audioLevel: number;  // 0-1
  isRecording: boolean;
}

/**
 * Canvas-based waveform visualization with smooth sine waves
 * Only renders when recording
 */
function WaveformVisualizer({
  audioLevel,
  isRecording,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const baseAmplitude = 2;
    const maxBoost = (height / 2) - 4;
    const amplitude = baseAmplitude + audioLevel * maxBoost;

    // Draw 3 sine waves with different phases and opacity
    const waves = [
      { phaseOffset: 0, opacity: 0.6, frequency: 0.08 },
      { phaseOffset: Math.PI / 3, opacity: 0.4, frequency: 0.1 },
      { phaseOffset: Math.PI / 1.5, opacity: 0.2, frequency: 0.12 },
    ];

    waves.forEach(({ phaseOffset, opacity, frequency }) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`; // blue-500
      ctx.lineWidth = 1.5;

      for (let x = 0; x < width; x++) {
        const y = centerY + Math.sin((x * frequency) + phaseRef.current + phaseOffset) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // Increment phase for animation
    phaseRef.current += 0.05;
  }, [audioLevel]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    draw(ctx, canvas.width, canvas.height);

    if (isRecording) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [draw, isRecording]);

  useEffect(() => {
    if (isRecording) {
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, animate]);

  if (!isRecording) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={60}
      height={24}
      className="flex-shrink-0"
    />
  );
}

export default WaveformVisualizer;
