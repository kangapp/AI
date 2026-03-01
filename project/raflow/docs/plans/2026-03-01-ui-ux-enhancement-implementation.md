# UI/UX 优化实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 优化 RaFlow 实时转录应用的 UI/UX，包括频谱波形、状态动画、打字机效果和清除逻辑。

**Architecture:** 在现有 React + Framer Motion 组件基础上渐进增强，新增 useTypewriter hook，扩展现有状态系统。

**Tech Stack:** React 18, Framer Motion, Tailwind CSS, Tauri

---

## Task 1: 扩展状态类型和清除逻辑

**Files:**
- Modify: `src/hooks/useTranscription.ts`

**Step 1: 添加新状态类型和错误类型**

在 `useTranscription.ts` 中，修改类型定义：

```typescript
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * 录音状态枚举
 * - idle: 空闲状态
 * - recording: 录音中
 * - processing: 处理中
 * - error: 错误状态
 */
export type RecordingStatus = "idle" | "recording" | "processing" | "error";

/**
 * 错误类型
 */
export type TranscriptionErrorType = "auth" | "network" | "server";

/**
 * 错误信息接口
 */
export interface TranscriptionError {
  type: TranscriptionErrorType;
  message: string;
}

/**
 * 转录状态接口
 */
export interface TranscriptionState {
  /** 当前录音状态 */
  status: RecordingStatus;
  /** 部分转录文本 (实时更新) */
  partialText: string;
  /** 已确认的转录文本 */
  committedText: string;
  /** 音频电平 (0-1) */
  audioLevel: number;
  /** 错误信息 (仅当 status 为 error 时) */
  error: TranscriptionError | null;
}
```

**Step 2: 修改 Hook 实现，添加清除逻辑和错误处理**

```typescript
export function useTranscription(): TranscriptionState {
  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    partialText: "",
    committedText: "",
    audioLevel: 0,
    error: null,
  });

  useEffect(() => {
    console.log("[useTranscription] Setting up event listeners...");

    // 监听录音状态变化事件
    const unlistenRecordingState = listen<boolean>(
      "recording-state-changed",
      (event) => {
        console.log("[useTranscription] recording-state-changed:", event.payload);
        const isRecording = event.payload;
        setState((prev) => ({
          ...prev,
          status: isRecording ? "recording" : "idle",
          // 新录音开始时清空所有文字和错误
          committedText: isRecording ? "" : prev.committedText,
          partialText: isRecording ? "" : prev.partialText,
          error: isRecording ? null : prev.error,
        }));
      }
    );

    // 监听部分转录事件
    const unlistenPartialTranscript = listen<string>(
      "partial-transcript",
      (event) => {
        setState((prev) => ({
          ...prev,
          partialText: event.payload,
        }));
      }
    );

    // 监听已确认转录事件
    const unlistenCommittedTranscript = listen<string>(
      "committed-transcript",
      (event) => {
        setState((prev) => ({
          ...prev,
          committedText: event.payload,
          partialText: "",
        }));
      }
    );

    // 监听音频电平事件
    const unlistenAudioLevel = listen<number>("audio-level", (event) => {
      setState((prev) => ({
        ...prev,
        audioLevel: event.payload,
      }));
    });

    // 监听错误事件
    const unlistenError = listen<TranscriptionError>("transcription-error", (event) => {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: event.payload,
      }));
    });

    // 清理函数：取消所有事件监听
    return () => {
      unlistenRecordingState.then((f) => f());
      unlistenPartialTranscript.then((f) => f());
      unlistenCommittedTranscript.then((f) => f());
      unlistenAudioLevel.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  return state;
}
```

**Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/hooks/useTranscription.ts
git commit -m "feat(transcription): add error state and clear logic on new recording"
```

---

## Task 2: 创建 useTypewriter Hook

**Files:**
- Create: `src/hooks/useTypewriter.ts`

**Step 1: 创建打字机效果 Hook**

```typescript
import { useEffect, useState, useRef } from "react";

/**
 * 打字机效果 Hook 配置
 */
interface UseTypewriterOptions {
  /** 每个字符的延迟时间 (ms)，默认 30 */
  charDelay?: number;
  /** 是否启用打字机效果，默认 true */
  enabled?: boolean;
}

/**
 * 打字机效果 Hook 返回值
 */
interface UseTypewriterReturn {
  /** 当前显示的文本 */
  displayText: string;
  /** 是否正在打字 */
  isTyping: boolean;
}

/**
 * 打字机效果 Hook
 *
 * 逐字符显示文本，模拟打字机效果
 *
 * @param text - 要显示的完整文本
 * @param options - 配置选项
 * @returns 当前显示的文本和打字状态
 *
 * @example
 * ```tsx
 * function TypewriterText({ text }: { text: string }) {
 *   const { displayText, isTyping } = useTypewriter(text);
 *   return <span>{displayText}{isTyping && "|"}</span>;
 * }
 * ```
 */
export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
): UseTypewriterReturn {
  const { charDelay = 30, enabled = true } = options;
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const previousTextRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text);
      setIsTyping(false);
      return;
    }

    // 如果文本变短或完全不同，立即重置
    if (!text.startsWith(previousTextRef.current)) {
      setDisplayText("");
      previousTextRef.current = "";
    }

    // 如果文本相同，不做任何事
    if (text === displayText) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);

    // 计算需要添加的字符
    const charsToAdd = text.slice(displayText.length);
    if (charsToAdd.length === 0) {
      setIsTyping(false);
      previousTextRef.current = text;
      return;
    }

    // 添加下一个字符
    const timeoutId = setTimeout(() => {
      setDisplayText((prev) => prev + charsToAdd[0]);
    }, charDelay);

    return () => clearTimeout(timeoutId);
  }, [text, displayText, charDelay, enabled]);

  // 当 displayText 追上 text 时，更新状态
  useEffect(() => {
    if (displayText === text && isTyping) {
      setIsTyping(false);
      previousTextRef.current = text;
    }
  }, [displayText, text, isTyping]);

  return { displayText, isTyping };
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useTypewriter.ts
git commit -m "feat(hooks): add useTypewriter hook for typewriter effect"
```

---

## Task 3: 重写 WaveformVisualizer 组件

**Files:**
- Modify: `src/components/WaveformVisualizer.tsx`

**Step 1: 重写波形可视化组件**

```typescript
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
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/WaveformVisualizer.tsx
git commit -m "feat(ui): enhance WaveformVisualizer with 20-bar spectrum and status colors"
```

---

## Task 4: 重写 TranscriptDisplay 组件

**Files:**
- Modify: `src/components/TranscriptDisplay.tsx`

**Step 1: 重写转录显示组件**

```typescript
import { motion, AnimatePresence } from "framer-motion";
import { useTypewriter } from "../hooks/useTypewriter";
import { RecordingStatus } from "../hooks/useTranscription";

interface TranscriptDisplayProps {
  partial: string;
  committed: string;
  status: RecordingStatus;
}

// 动画配置
const textVariants = {
  enter: { opacity: 0, y: 10, scale: 1.05 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

const transition = { type: "spring", stiffness: 300, damping: 20 };

export function TranscriptDisplay({ partial, committed, status }: TranscriptDisplayProps) {
  // 打字机效果仅对 partial 文本启用
  const { displayText, isTyping } = useTypewriter(partial, {
    charDelay: 25,
    enabled: status === "recording",
  });

  // 获取文字颜色
  const getTextColor = () => {
    if (status === "error") return "text-red-400";
    if (status === "processing") return "text-yellow-400";
    return "text-white";
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[3rem]">
      {/* 已确认的文字 */}
      <AnimatePresence mode="popLayout">
        {committed && (
          <motion.p
            key="committed"
            variants={textVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className={`${getTextColor()} text-sm font-medium text-center mb-1`}
          >
            {committed}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 部分识别的文字 (带打字机效果) */}
      <AnimatePresence mode="wait">
        {(displayText || partial) && (
          <motion.p
            key="partial"
            variants={textVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="text-gray-400 text-sm text-center"
          >
            {displayText || partial}
            {/* 闪烁光标 */}
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block ml-0.5"
            >
              |
            </motion.span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* 空状态提示 */}
      {!committed && !partial && !displayText && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          className="text-gray-500 text-xs"
        >
          {status === "recording" ? "正在聆听..." : "按 ⌘⇧H 开始录音"}
        </motion.p>
      )}
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/TranscriptDisplay.tsx
git commit -m "feat(ui): add typewriter, scroll and bounce animations to TranscriptDisplay"
```

---

## Task 5: 更新 App 组件

**Files:**
- Modify: `src/App.tsx`

**Step 1: 更新主应用组件**

```typescript
import { useEffect, useState } from "react";
import { useTranscription, RecordingStatus } from "./hooks/useTranscription";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { WaveformVisualizer } from "./components/WaveformVisualizer";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 状态指示器组件
 */
function StatusIndicator({ status }: { status: RecordingStatus }) {
  const getStatusConfig = () => {
    switch (status) {
      case "recording":
        return {
          color: "bg-blue-500",
          text: "Recording",
          textColor: "text-blue-400",
          animate: { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] },
        };
      case "processing":
        return {
          color: "bg-yellow-500",
          text: "Processing",
          textColor: "text-yellow-400",
          animate: { rotate: 360 },
        };
      case "error":
        return {
          color: "bg-red-500",
          text: "Error",
          textColor: "text-red-400",
          animate: {},
        };
      default:
        return {
          color: "bg-gray-500",
          text: "Idle",
          textColor: "text-gray-500",
          animate: {},
        };
    }
  };

  const config = getStatusConfig();
  const isRecording = status === "recording";
  const isProcessing = status === "processing";

  return (
    <div className={`flex items-center justify-center gap-1.5 mb-1 ${config.textColor}`}>
      <motion.div
        className={`w-2 h-2 rounded-full ${config.color}`}
        animate={config.animate}
        transition={
          isRecording
            ? { duration: 0.8, repeat: Infinity }
            : isProcessing
            ? { duration: 1, repeat: Infinity, ease: "linear" }
            : {}
        }
      />
      <span className="text-xs">{config.text}</span>
    </div>
  );
}

/**
 * 错误提示组件
 */
function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="text-red-400 text-xs bg-red-500/10 px-2 py-1 rounded mt-2"
    >
      {message}
    </motion.div>
  );
}

function App() {
  const { status, partialText, committedText, audioLevel, error } = useTranscription();
  const isRecording = status === "recording";
  const [showError, setShowError] = useState(false);

  console.log("[App] status:", status, "isRecording:", isRecording);

  // 显示错误时自动显示 toast
  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  useEffect(() => {
    const win = getCurrentWindow();

    // Show window when recording starts
    if (isRecording) {
      win.show();
      win.setFocus();
    }
  }, [isRecording]);

  // 获取背景颜色
  const getBgClass = () => {
    switch (status) {
      case "recording":
        return "rgba(30, 58, 95, 0.9)"; // 微蓝
      case "processing":
        return "rgba(59, 50, 30, 0.9)"; // 微黄
      case "error":
        return "rgba(59, 30, 30, 0.9)"; // 微红
      default:
        return "rgba(30, 30, 30, 0.9)";
    }
  };

  return (
    <div
      className="window-container"
      style={{ background: getBgClass() }}
    >
      <StatusIndicator status={status} />
      <WaveformVisualizer level={audioLevel} status={status} />
      <TranscriptDisplay
        partial={partialText}
        committed={committedText}
        status={status}
      />

      <AnimatePresence>
        {showError && error && (
          <ErrorToast message={error.message} onDismiss={() => setShowError(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): add status indicator, error toast and status-based theming"
```

---

## Task 6: 集成测试

**Files:**
- None (testing only)

**Step 1: 构建前端**

Run: `npm run build`
Expected: Build successful, no errors

**Step 2: 运行 Tauri 开发模式**

Run: `npm run tauri dev`
Expected: App launches, UI displays correctly

**Step 3: 手动测试清单**

1. 按 `Cmd+Shift+H` 开始录音
   - [ ] 状态指示器变为蓝色 "Recording"
   - [ ] 波形显示 20 条动态柱状图
   - [ ] 背景变为微蓝色
   - [ ] 显示 "正在聆听..." 提示

2. 说话时
   - [ ] 波形随声音大小变化
   - [ ] Partial 文字显示打字机效果
   - [ ] 光标闪烁

3. 再次按 `Cmd+Shift+H` 停止录音
   - [ ] 状态变为 "Idle"
   - [ ] 波形恢复静态

4. 再次开始新录音
   - [ ] 上次的文字被清空
   - [ ] 重新显示 "正在聆听..."

**Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat(ui): complete UI/UX enhancement with spectrum waveform and animations"
```

---

## 文件改动总结

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/hooks/useTranscription.ts` | 修改 | 新增 error/processing 状态，添加清除逻辑 |
| `src/hooks/useTypewriter.ts` | 新增 | 打字机效果 Hook |
| `src/components/WaveformVisualizer.tsx` | 重写 | 20 条频谱柱 + 状态颜色 |
| `src/components/TranscriptDisplay.tsx` | 重写 | 打字机 + 滚动 + 弹跳动画 |
| `src/App.tsx` | 修改 | 状态指示器 + 错误提示 + 状态主题 |

---

## 依赖

无新增依赖，使用现有：
- React 18
- Framer Motion
- Tailwind CSS
- Tauri API
