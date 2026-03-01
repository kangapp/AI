# Phase 4: 悬浮窗 UI 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现悬浮窗 UI 的四个核心组件：转录显示、波形动画、权限引导、设置面板。

**Architecture:** 组件拆分方案，FloatingWindow 作为容器协调子组件，通过 Zustand store 共享状态，Canvas 实现波形动画。

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, Canvas API

---

## Task 1: 更新 useAppStore 添加 audioLevel

**Files:**
- Modify: `src/stores/useAppStore.ts`

**Step 1: 添加 audioLevel 状态和 setter**

修改 `src/stores/useAppStore.ts`:

```typescript
import { create } from 'zustand';
import type { AppStatus } from '../types';

interface AppState {
  /** Current application status */
  status: AppStatus;
  /** Partial (tentative) transcription text - shown in gray */
  partialText: string;
  /** Committed (final) transcription text - shown in black */
  committedText: string;
  /** Error message if any */
  error: string | null;
  /** Current audio level for waveform visualization (0-1) */
  audioLevel: number;

  // Actions
  /** Set the current status */
  setStatus: (status: AppStatus) => void;
  /** Update partial text */
  setPartialText: (text: string) => void;
  /** Update committed text */
  setCommittedText: (text: string) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Set audio level */
  setAudioLevel: (level: number) => void;
  /** Reset all text */
  resetText: () => void;
  /** Reset entire state */
  reset: () => void;
}

const initialState = {
  status: 'idle' as AppStatus,
  partialText: '',
  committedText: '',
  error: null,
  audioLevel: 0,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setPartialText: (text) => set({ partialText: text }),
  setCommittedText: (text) => set({ committedText: text }),
  setError: (error) => set({ error }),
  setAudioLevel: (level) => set({ audioLevel: Math.max(0, Math.min(1, level)) }),
  resetText: () => set({ partialText: '', committedText: '' }),
  reset: () => set(initialState),
}));
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/stores/useAppStore.ts
git commit -m "feat(store): add audioLevel state for waveform visualization"
```

---

## Task 2: 创建 TranscriptDisplay 组件

**Files:**
- Create: `src/components/TranscriptDisplay.tsx`

**Step 1: 创建 TranscriptDisplay 组件**

创建 `src/components/TranscriptDisplay.tsx`:

```typescript
import type { AppStatus } from '../types';

interface TranscriptDisplayProps {
  status: AppStatus;
  partialText: string;
  committedText: string;
  error: string | null;
}

/**
 * Displays transcription text with status-aware styling
 * - error: red
 * - committed: black
 * - partial: gray
 * - default: hint gray
 */
function TranscriptDisplay({
  status,
  partialText,
  committedText,
  error,
}: TranscriptDisplayProps) {
  // Determine display text and color
  let displayText: string;
  let textColorClass: string;

  if (error) {
    displayText = error;
    textColorClass = 'text-red-500';
  } else if (committedText) {
    displayText = committedText;
    textColorClass = 'text-gray-900';
  } else if (partialText) {
    displayText = partialText;
    textColorClass = 'text-gray-400';
  } else {
    // Default hint based on status
    displayText = status === 'connecting'
      ? 'Connecting...'
      : 'Press Cmd+Shift+H to start recording...';
    textColorClass = 'text-gray-500';
  }

  return (
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${textColorClass}`}>
        {displayText}
      </p>
    </div>
  );
}

export default TranscriptDisplay;
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/TranscriptDisplay.tsx
git commit -m "feat(ui): add TranscriptDisplay component"
```

---

## Task 3: 创建 WaveformVisualizer 组件

**Files:**
- Create: `src/components/WaveformVisualizer.tsx`

**Step 1: 创建 WaveformVisualizer 组件**

创建 `src/components/WaveformVisualizer.tsx`:

```typescript
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
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/WaveformVisualizer.tsx
git commit -m "feat(ui): add WaveformVisualizer component with canvas animation"
```

---

## Task 4: 创建语言常量文件

**Files:**
- Create: `src/constants/languages.ts`

**Step 1: 创建语言列表常量**

创建 `src/constants/languages.ts`:

```typescript
/** Supported transcription languages for ElevenLabs Scribe v2 */
export const LANGUAGES = [
  { code: 'auto', name: 'Auto Detect', nativeName: '自动检测' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

/** Get language name by code */
export function getLanguageName(code: string): string {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang?.nativeName || lang?.name || code;
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/constants/languages.ts
git commit -m "feat(constants): add supported languages list"
```

---

## Task 5: 创建 PermissionGuide 组件

**Files:**
- Create: `src/components/PermissionGuide.tsx`

**Step 1: 创建 PermissionGuide 组件**

创建 `src/components/PermissionGuide.tsx`:

```typescript
import { invoke } from '@tauri-apps/api/core';

interface PermissionGuideProps {
  isOpen: boolean;
  permissionType: 'microphone' | 'accessibility';
  onClose: () => void;
}

const PERMISSION_INFO = {
  microphone: {
    icon: '🎤',
    title: '需要麦克风权限',
    description: 'RaFlow 需要访问麦克风来进行语音转文字输入。',
  },
  accessibility: {
    icon: '⌨️',
    title: '需要辅助功能权限',
    description: 'RaFlow 需要辅助功能权限来在光标位置插入文本。',
  },
};

/**
 * Modal dialog for guiding users to enable permissions
 */
function PermissionGuide({
  isOpen,
  permissionType,
  onClose,
}: PermissionGuideProps) {
  if (!isOpen) return null;

  const info = PERMISSION_INFO[permissionType];

  const handleOpenSettings = async () => {
    try {
      await invoke('request_accessibility_permission');
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  const handleDismiss = () => {
    // Remember dismissal to avoid repeated prompts
    localStorage.setItem(`permission_dismissed_${permissionType}`, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{info.icon}</span>
          <h2 className="text-lg font-semibold text-gray-900">{info.title}</h2>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-6">{info.description}</p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            稍后提醒
          </button>
          <button
            onClick={handleOpenSettings}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            打开系统设置
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermissionGuide;
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PermissionGuide.tsx
git commit -m "feat(ui): add PermissionGuide modal component"
```

---

## Task 6: 创建 SettingsPanel 组件

**Files:**
- Create: `src/components/SettingsPanel.tsx`

**Step 1: 创建 SettingsPanel 组件**

创建 `src/components/SettingsPanel.tsx`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { LANGUAGES } from '../constants/languages';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings modal for language and hotkey configuration
 */
function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { language, hotkey, setLanguage, setHotkey } = useSettingsStore();
  const [localHotkey, setLocalHotkey] = useState(hotkey);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalHotkey(hotkey);
    }
  }, [isOpen, hotkey]);

  // Handle hotkey recording
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecordingHotkey) return;

    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.metaKey) parts.push('Cmd');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Add the main key if it's not a modifier
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
      parts.push(e.key.toUpperCase());
    }

    if (parts.length > 1) {
      setLocalHotkey(parts.join('+'));
      setIsRecordingHotkey(false);
    }
  }, [isRecordingHotkey]);

  useEffect(() => {
    if (isRecordingHotkey) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isRecordingHotkey, handleKeyDown]);

  const handleSave = () => {
    setLanguage(language);
    setHotkey(localHotkey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">⚙️ 设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Language Select */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            转录语言
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>

        {/* Hotkey Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            快捷键
          </label>
          <div
            ref={inputRef as React.RefObject<HTMLDivElement>}
            onClick={() => setIsRecordingHotkey(true)}
            className={`w-full px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between ${
              isRecordingHotkey
                ? 'border-blue-500 ring-2 ring-blue-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <span className={isRecordingHotkey ? 'text-blue-500' : 'text-gray-900'}>
              {isRecordingHotkey ? '按下新的快捷键...' : localHotkey}
            </span>
            <span className="text-gray-400">🎹</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat(ui): add SettingsPanel modal component"
```

---

## Task 7: 重构 FloatingWindow 组件

**Files:**
- Modify: `src/components/FloatingWindow.tsx`

**Step 1: 重构 FloatingWindow 为容器组件**

修改 `src/components/FloatingWindow.tsx`:

```typescript
import { useAppStore } from '../stores/useAppStore';
import TranscriptDisplay from './TranscriptDisplay';
import WaveformVisualizer from './WaveformVisualizer';

/**
 * Floating window container that coordinates child components
 * Layout: [Status Indicator] [Transcript Text] [Waveform]
 */
function FloatingWindow() {
  const { status, partialText, committedText, error, audioLevel } = useAppStore();

  // Status indicator color
  const statusColorClass = {
    idle: 'bg-gray-400',
    connecting: 'bg-yellow-400 animate-pulse',
    recording: 'bg-red-500 animate-pulse',
    injecting: 'bg-green-500',
  }[status];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50">
      {/* Status indicator */}
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColorClass}`} />

      {/* Transcription text */}
      <TranscriptDisplay
        status={status}
        partialText={partialText}
        committedText={committedText}
        error={error}
      />

      {/* Waveform visualization - only when recording */}
      <WaveformVisualizer
        audioLevel={audioLevel}
        isRecording={status === 'recording'}
      />
    </div>
  );
}

export default FloatingWindow;
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/FloatingWindow.tsx
git commit -m "refactor(ui): restructure FloatingWindow as container component"
```

---

## Task 8: 更新 App.tsx 集成所有组件

**Files:**
- Modify: `src/App.tsx`

**Step 1: 集成 PermissionGuide 和 SettingsPanel**

修改 `src/App.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import FloatingWindow from './components/FloatingWindow';
import PermissionGuide from './components/PermissionGuide';
import SettingsPanel from './components/SettingsPanel';
import { useHotkey } from './hooks/useHotkey';
import { useAppStore } from './stores/useAppStore';

function App() {
  // Initialize hotkey listener
  useHotkey();

  const { setError } = useAppStore();

  // Permission guide state
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [permissionType, setPermissionType] = useState<'microphone' | 'accessibility'>('accessibility');

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Check permissions on startup
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const hasAccessibility = await invoke<boolean>('check_accessibility_permission');
        if (!hasAccessibility) {
          // Check if user previously dismissed
          const dismissed = localStorage.getItem('permission_dismissed_accessibility');
          if (!dismissed) {
            setPermissionType('accessibility');
            setShowPermissionGuide(true);
          }
        }
      } catch (error) {
        console.error('Failed to check permissions:', error);
      }
    };

    checkPermissions();
  }, []);

  // Listen for permission-required events from backend
  useEffect(() => {
    const unlisten = listen<{ type: string; message: string; action?: string }>(
      'permission-required',
      (event) => {
        console.log('Permission required:', event.payload);
        setError(event.payload.message);
        if (event.payload.type === 'accessibility') {
          setPermissionType('accessibility');
          setShowPermissionGuide(true);
        }
      }
    );

    // Listen for open-settings event from tray
    const unlistenSettings = listen('open-settings', () => {
      setShowSettings(true);
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
    };
  }, [setError]);

  return (
    <div className="min-h-screen bg-transparent">
      <FloatingWindow />

      <PermissionGuide
        isOpen={showPermissionGuide}
        permissionType={permissionType}
        onClose={() => setShowPermissionGuide(false)}
      />

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default App;
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): integrate PermissionGuide and SettingsPanel"
```

---

## Task 9: 更新 useTranscription 计算 audioLevel

**Files:**
- Modify: `src/hooks/useTranscription.ts`

**Step 1: 在音频处理中计算 RMS 音量**

修改 `src/hooks/useTranscription.ts`，在处理音频 chunk 时计算 audioLevel：

找到处理音频数据的部分，添加 RMS 计算逻辑：

```typescript
// In the audio processing section, add:
import { useAppStore } from '../stores/useAppStore';

// Inside the audio chunk processing:
const calculateRMS = (pcmData: Int16Array): number => {
  let sum = 0;
  for (let i = 0; i < pcmData.length; i++) {
    sum += pcmData[i] * pcmData[i];
  }
  const rms = Math.sqrt(sum / pcmData.length);
  // Normalize to 0-1 range (max Int16 value is 32767)
  return Math.min(1, rms / 32767);
};

// When processing audio chunks:
const { setAudioLevel } = useAppStore.getState();
// After getting pcmData:
const level = calculateRMS(pcmData);
setAudioLevel(level);
```

**Step 2: 验证 TypeScript 编译**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useTranscription.ts
git commit -m "feat(transcription): add audio level calculation for waveform"
```

---

## Task 10: 验证整体功能

**Files:**
- None (verification only)

**Step 1: 运行完整类型检查**

Run: `npm run type-check`
Expected: No errors

**Step 2: 运行开发服务器验证 UI**

Run: `npm run tauri dev`
Expected: App launches with floating window visible

**Step 3: 手动测试清单**

- [ ] 悬浮窗显示默认提示文字
- [ ] 状态指示灯为灰色（idle）
- [ ] 按 Cmd+Shift+H 开始录音
- [ ] 状态指示灯变红色并脉动
- [ ] 波形动画显示
- [ ] 转录文本实时更新（灰色）
- [ ] 松开热键后文本变黑
- [ ] 文本被注入到光标位置

**Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat(ui): complete Phase 4 floating window UI implementation"
```

---

## Summary

| Task | Component | Files Changed |
|------|-----------|---------------|
| 1 | useAppStore | 1 modified |
| 2 | TranscriptDisplay | 1 created |
| 3 | WaveformVisualizer | 1 created |
| 4 | languages constant | 1 created |
| 5 | PermissionGuide | 1 created |
| 6 | SettingsPanel | 1 created |
| 7 | FloatingWindow | 1 modified |
| 8 | App | 1 modified |
| 9 | useTranscription | 1 modified |
| 10 | Verification | 0 |

**Total:** 6 new files, 4 modified files

---

*Plan created: 2026-03-01*
