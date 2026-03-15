# 音频显示样式实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在设置面板新增音频显示样式选择，支持 4 种可视化样式：波形条形、圆形脉动、频谱圆环、粒子爆炸

**Architecture:** 在后端 FloatingWindowSettings 添加 audio_style 字段，前端创建 AudioVisualizer 包装组件，根据设置渲染不同样式

**Tech Stack:** Tauri + React + TypeScript + Framer Motion

---

## Task 1: 修改后端 - 添加 audio_style 字段

**Files:**
- Modify: `src-tauri/src/config/mod.rs:117-146`
- Modify: `src-tauri/src/config/mod.rs:155-169`

**Step 1: 添加 audio_style 字段到 FloatingWindowSettings 结构体**

```rust
/// 悬浮窗设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloatingWindowSettings {
    // ... existing fields ...

    /// 音频显示样式
    #[serde(default = "default_audio_style")]
    pub audio_style: String,
}

// 添加默认值函数
fn default_audio_style() -> String {
    "waveform".to_string()
}
```

**Step 2: 在 Default impl 中添加 audio_style 字段**

```rust
impl Default for FloatingWindowSettings {
    fn default() -> Self {
        Self {
            // ... existing fields ...
            audio_style: default_audio_style(),
        }
    }
}
```

---

## Task 2: 更新前端 WindowSettings 接口

**Files:**
- Modify: `src/components/SettingsPanel.tsx:6-14`
- Modify: `src/App.tsx:11-19`

**Step 1: 在 SettingsPanel.tsx 中添加 audio_style 字段**

```typescript
interface WindowSettings {
  // ... existing fields ...
  audio_style: string;
}
```

**Step 2: 在 App.tsx 中添加 audio_style 字段**

```typescript
interface WindowSettings {
  // ... existing fields ...
  audio_style: string;
}
```

---

## Task 3: 创建圆形脉动组件

**Files:**
- Create: `src/components/visualizers/PulseVisualizer.tsx`

**Step 1: 创建 PulseVisualizer 组件**

```typescript
import { motion } from "framer-motion";
import { RecordingStatus } from "../hooks/useTranscription";

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

  // 音量映射到缩放 (0.6 - 1.0)
  const scale = 0.6 + Math.pow(level, 0.5) * 0.4;
  const glowIntensity = level * 30;

  return (
    <div className="flex items-center justify-center w-full h-full">
      <motion.div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: isActive
            ? `0 0 ${glowIntensity}px ${glowIntensity / 2}px ${color}80`
            : "none",
        }}
        animate={{
          scale: isActive ? scale : 0.8,
          opacity: isActive ? 0.8 + level * 0.2 : 0.4,
        }}
        transition={{
          duration: 0.15,
          ease: [0.4, 0, 0.2, 1],
        }}
      />
    </div>
  );
}
```

---

## Task 4: 创建频谱圆环组件

**Files:**
- Create: `src/components/visualizers/SpectrumVisualizer.tsx`

**Step 1: 创建 SpectrumVisualizer 组件**

```typescript
import { motion } from "framer-motion";
import { RecordingStatus } from "../hooks/useTranscription";

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

  return (
    <div className="flex items-center justify-center w-full h-full">
      {Array.from({ length: ringCount }).map((_, i) => {
        const ringIndex = ringCount - 1 - i; // 从外到内
        const baseRadius = baseSize + ringIndex * ringGap;
        // 不同环在不同频率上有不同响应
        const freqBias = Math.sin((i + 1) * 0.8) * 0.3 + 0.7;
        const ringLevel = isActive ? Math.pow(level, 0.6) * freqBias : 0.15;
        const strokeWidth = 1 + ringLevel * 2;
        const opacity = 0.3 + ringLevel * 0.7;

        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: baseRadius * 2,
              height: baseRadius * 2,
              border: `${strokeWidth}px solid ${color}`,
              opacity,
              boxShadow: isActive && ringLevel > 0.5 ? `0 0 ${ringLevel * 10}px ${color}40` : "none",
            }}
            animate={{
              scale: isActive ? 1 + ringLevel * 0.1 : 1,
            }}
            transition={{
              duration: 0.2,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        );
      })}
    </div>
  );
}
```

---

## Task 5: 创建粒子爆炸组件

**Files:**
- Create: `src/components/visualizers/ParticleVisualizer.tsx`

**Step 1: 创建 ParticleVisualizer 组件**

```typescript
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RecordingStatus } from "../hooks/useTranscription";

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
  const isActive = status === "recording" || status === "connecting" || status === "processing";
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    const spawnParticle = () => {
      const now = Date.now();
      const spawnInterval = 80 + (1 - level) * 120; // 音量越大，间隔越短

      if (now - lastSpawnRef.current > spawnInterval) {
        const particleCount = Math.floor(3 + level * 8); // 5-15 个粒子
        const newParticles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.5 + Math.random() * 1.5;
          newParticles.push({
            id: particleIdRef.current++,
            x: 50,
            y: 50,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1, // 稍微向上
            size: 2 + Math.random() * 3,
            opacity: 0.8 + Math.random() * 0.2,
          });
        }

        setParticles((prev) => [...prev.slice(-30), ...newParticles]); // 最多 30 个
        lastSpawnRef.current = now;
      }
    };

    const interval = setInterval(spawnParticle, 16);
    return () => clearInterval(interval);
  }, [isActive, level]);

  // 更新粒子位置
  useEffect(() => {
    if (!isActive) return;

    const updateParticles = () => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.02, // 重力
            opacity: p.opacity - 0.015,
          }))
          .filter((p) => p.opacity > 0)
      );
    };

    const interval = setInterval(updateParticles, 16);
    return () => clearInterval(interval);
  }, [isActive]);

  const containerSize = compact ? 32 : 48;

  return (
    <div className="flex items-center justify-center w-full h-full relative" style={{ width: containerSize, height: containerSize }}>
      {/* 中心点 */}
      <div
        className="absolute rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: color,
          opacity: isActive ? 0.6 + level * 0.4 : 0.3,
        }}
      />

      {/* 粒子 */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: color,
              opacity: p.opacity,
            }}
            initial={{ scale: 0 }}
            exit={{ scale: 0 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

---

## Task 6: 创建 AudioVisualizer 包装组件

**Files:**
- Create: `src/components/AudioVisualizer.tsx`

**Step 1: 创建 AudioVisualizer 包装组件**

```typescript
import { WaveformVisualizer } from "./WaveformVisualizer";
import { PulseVisualizer } from "./visualizers/PulseVisualizer";
import { SpectrumVisualizer } from "./visualizers/SpectrumVisualizer";
import { ParticleVisualizer } from "./visualizers/ParticleVisualizer";
import { RecordingStatus } from "../hooks/useTranscription";

interface AudioVisualizerProps {
  level: number;
  status: RecordingStatus;
  style: "waveform" | "pulse" | "spectrum" | "particle";
  compact?: boolean;
}

export function AudioVisualizer({ level, status, style, compact = false }: AudioVisualizerProps) {
  switch (style) {
    case "pulse":
      return <PulseVisualizer level={level} status={status} compact={compact} />;
    case "spectrum":
      return <SpectrumVisualizer level={level} status={status} compact={compact} />;
    case "particle":
      return <ParticleVisualizer level={level} status={status} compact={compact} />;
    case "waveform":
    default:
      return <WaveformVisualizer level={level} status={status} compact={compact} />;
  }
}
```

---

## Task 7: 修改 App.tsx 使用 AudioVisualizer

**Files:**
- Modify: `src/App.tsx:297-313`

**Step 1: 导入 AudioVisualizer 并替换 WaveformVisualizer**

```typescript
import { AudioVisualizer } from "./components/AudioVisualizer";

// 在渲染部分替换
<AudioVisualizer
  level={audioLevel}
  status={status}
  style={(windowSettings.audio_style as any) || "waveform"}
  compact={layoutMode === "compact"}
/>
```

---

## Task 8: 修改设置面板添加样式选择器

**Files:**
- Modify: `src/components/SettingsPanel.tsx`

**Step 1: 添加音频样式预设常量**

```typescript
// 音频样式预设
const AUDIO_STYLES = [
  { id: "waveform", name: "波形", icon: "📊" },
  { id: "pulse", name: "脉动", icon: "⚪" },
  { id: "spectrum", name: "圆环", icon: "⭕" },
  { id: "particle", name: "粒子", icon: "✨" },
];
```

**Step 2: 在设置面板中添加样式选择器（在主题预设后面）**

```typescript
{/* 音频样式选择 */}
<div className="mb-5">
  <span className="text-[13px] text-gray-400 block mb-3">音频样式</span>
  <div className="grid grid-cols-4 gap-2">
    {AUDIO_STYLES.map((style) => (
      <button
        key={style.id}
        onClick={() => updateSetting("audio_style", style.id)}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
          settings.audio_style === style.id
            ? "bg-blue-500/20 ring-2 ring-blue-500"
            : "bg-white/5 hover:bg-white/10"
        }`}
      >
        <span className="text-lg">{style.icon}</span>
        <span className="text-[10px] text-gray-400">{style.name}</span>
      </button>
    ))}
  </div>
</div>
```

**Step 3: 更新 Settings 初始状态添加 audio_style**

```typescript
const [settings, setSettings] = useState<WindowSettings>({
  // ... existing fields ...
  audio_style: "waveform",
});
```

---

## Task 9: 测试和验证

**Step 1: 启动开发服务器**

```bash
cd /Users/liufukang/workplace/AI/project/raflow
npm run tauri dev
```

**Step 2: 验证功能**

- [ ] 4 种样式都能正常显示
- [ ] 切换样式后能实时生效
- [ ] 设置能正确保存和加载
- [ ] 各种状态下样式颜色正确

---

## 实施顺序

1. Task 1: 修改后端
2. Task 2: 更新前端接口
3. Task 3-5: 创建 3 个新可视化组件
4. Task 6: 创建包装组件
5. Task 7: 修改 App.tsx
6. Task 8: 修改设置面板
7. Task 9: 测试验证
