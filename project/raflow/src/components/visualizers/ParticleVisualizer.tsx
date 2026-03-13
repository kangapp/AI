import { useEffect, useState, useRef } from "react";
import { RecordingStatus } from "../../hooks/useTranscription";

interface ParticleVisualizerProps {
  level: number;
  status: RecordingStatus;
  compact?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

function getParticleColor(status: RecordingStatus): string {
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

export function ParticleVisualizer({ level, status, compact = false }: ParticleVisualizerProps) {
  const color = getParticleColor(status);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const levelRef = useRef(level);

  // 更新 levelRef
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  // 简化版：使用单个 setInterval 处理所有逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      const currentLevel = levelRef.current;
      const logLevel = currentLevel > 0 ? Math.log10(1 + currentLevel * 100) / Math.log10(101) : 0;
      const effectiveLevel = Math.max(0.1, logLevel);

      setParticles((prev) => {
        // 更新现有粒子位置
        const updated = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.02,
            opacity: p.opacity - 0.015,
          }))
          .filter((p) => p.opacity > 0);

        // 生成新粒子
        if (Math.random() < effectiveLevel * 0.5) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.5 + effectiveLevel * 2;
          const newParticle: Particle = {
            id: particleIdRef.current++,
            x: 50 + (Math.random() - 0.5) * 10,
            y: 50 + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.5,
            size: 3 + effectiveLevel * 5,
            opacity: 0.8,
          };
          return [...updated.slice(-15), newParticle];
        }

        return updated;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const containerSize = compact ? 32 : 48;

  return (
    <div
      className="flex items-center justify-center w-full h-full relative"
      style={{ width: containerSize, height: containerSize, overflow: "visible" }}
    >
      {/* 中心点 */}
      <div
        style={{
          position: "absolute",
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: color,
          opacity: 0.8,
        }}
      />

      {/* 粒子 - 使用原生 div，不用 Framer Motion */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: color,
            opacity: p.opacity,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}
