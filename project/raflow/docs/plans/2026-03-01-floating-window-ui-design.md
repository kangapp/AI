# Phase 4: 悬浮窗 UI 设计

<!--
  WHAT: raflow 悬浮窗 UI 组件设计
  WHY: Phase 4 实现前的设计文档
  WHEN: 2026-03-01
-->

## Overview

基于组件拆分方案，实现悬浮窗 UI 的四个核心组件：转录显示、波形动画、权限引导、设置面板。

## Design Decisions

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 波形动画风格 | 平滑曲线 | 视觉效果优雅，符合现代 UI 趋势 |
| 权限引导时机 | 启动时检测 | 尽早发现问题，避免用户使用时受阻 |
| 设置面板内容 | 基础项 | MVP 阶段保持简洁，语言+热键足够 |
| 实现方案 | 组件拆分 | 职责清晰，符合已定义目录结构 |

## Component Architecture

```
src/components/
├── FloatingWindow.tsx      # 主容器，协调子组件
├── TranscriptDisplay.tsx   # 转录文本显示
├── WaveformVisualizer.tsx  # 音频波形动画
├── PermissionGuide.tsx     # 权限引导弹窗
└── SettingsPanel.tsx       # 设置面板
```

**数据流：**
```
useAppStore ──────► FloatingWindow ──────► TranscriptDisplay
     │                   │
     │                   └────────────────► WaveformVisualizer
     │
     └───────────────────────────────────► PermissionGuide (modal)

useSettingsStore ─────────────────────────► SettingsPanel (modal)
```

## Component Specs

### 1. FloatingWindow (主容器)

**布局：**
```
┌──────────────────────────────────────────────────────────┐
│  ┌──┐  TranscriptDisplay...        ┌────────────────┐   │
│  │● │  (文本区域)                   │  ～～～ (波形)  │   │
│  └──┘                                └────────────────┘   │
└──────────────────────────────────────────────────────────┘
   400px x 80px, 圆角, 毛玻璃背景
```

**状态与显示逻辑：**

| Status | 指示灯 | 文本 | 波形 |
|--------|--------|------|------|
| idle | 灰色静态 | 提示文字 | 隐藏 |
| connecting | 黄色脉动 | "Connecting..." | 隐藏 |
| recording | 红色脉动 | partialText | 显示 |
| injecting | 绿色静态 | committedText | 隐藏 |

### 2. TranscriptDisplay

**API：**
```typescript
interface TranscriptDisplayProps {
  status: AppStatus;
  partialText: string;
  committedText: string;
  error: string | null;
}
```

**视觉规则：**
- 字体：14px, font-medium
- 颜色：
  - error → 红色 (`text-red-500`)
  - committedText → 黑色 (`text-gray-900`)
  - partialText → 灰色 (`text-gray-400`)
  - 默认 → 提示灰 (`text-gray-500`)
- 布局：单行，truncate 溢出

### 3. WaveformVisualizer

**API：**
```typescript
interface WaveformVisualizerProps {
  audioLevel: number;  // 0-1
  isRecording: boolean;
}
```

**技术方案：** Canvas + requestAnimationFrame

**视觉设计：**
- 尺寸：60x24 px
- 风格：平滑正弦波，3 条叠加，相位错开
- 颜色：`#3B82F6` (blue-500)，透明度 0.6/0.4/0.2
- 动画：静默时微弱呼吸，有音频时振幅响应

**实现要点：**
1. 组件内部维护相位状态，每帧递增产生流动效果
2. 音量映射：`amplitude = baseAmplitude + audioLevel * maxBoost`
3. 仅在 `isRecording === true` 时渲染

### 4. PermissionGuide

**API：**
```typescript
interface PermissionGuideProps {
  isOpen: boolean;
  permissionType: 'microphone' | 'accessibility';
  onClose: () => void;
  onOpenSettings: () => void;
}
```

**检测权限：**
1. 麦克风 - NSMicrophoneUsageDescription
2. 辅助功能 - NSAppleEventsUsageDescription

**视觉设计：**
- 模态框居中，320x200 px
- 内容：图标 + 标题 + 说明 + 按钮

```
┌─────────────────────────────────┐
│  🎤  需要麦克风权限              │
│                                 │
│  RaFlow 需要访问麦克风来进行     │
│  语音转文字输入。                │
│                                 │
│  [打开系统设置]    [稍后提醒]    │
└─────────────────────────────────┘
```

**实现要点：**
1. 启动时调用 `check_accessibility_permission` 检测
2. 点击"打开系统设置"调用 `request_accessibility_permission`
3. 关闭后记录到 localStorage，避免重复提醒

### 5. SettingsPanel

**API：**
```typescript
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**设置项：**
1. 语言选择 - 下拉框，90+ 语言，默认 `auto`
2. 热键配置 - 点击录制新组合键

```
┌─────────────────────────────────┐
│  ⚙️  设置                       │
├─────────────────────────────────┤
│                                 │
│  转录语言                       │
│  [ Auto (自动检测)        ▼ ]   │
│                                 │
│  快捷键                         │
│  [ Cmd+Shift+H           🎹 ]   │
│                                 │
│         [取消]    [保存]        │
└─────────────────────────────────┘
```

**实现要点：**
1. 语言列表从常量文件导入
2. 热键录制：点击输入框 → 监听组合键 → 更新
3. 保存时调用 Tauri 命令更新全局热键注册
4. 持久化到 useSettingsStore

## File Changes

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/FloatingWindow.tsx` | 重构 | 改为容器组件 |
| `src/components/TranscriptDisplay.tsx` | 新建 | 转录文本显示 |
| `src/components/WaveformVisualizer.tsx` | 新建 | 波形动画 |
| `src/components/PermissionGuide.tsx` | 新建 | 权限引导弹窗 |
| `src/components/SettingsPanel.tsx` | 新建 | 设置面板 |
| `src/stores/useAppStore.ts` | 修改 | 添加 audioLevel |
| `src/hooks/useTranscription.ts` | 修改 | 计算并更新 audioLevel |
| `src/App.tsx` | 修改 | 集成 PermissionGuide/SettingsPanel |
| `src/constants/languages.ts` | 新建 | 语言列表常量 |

## Dependencies

现有依赖已足够：
- React 18
- Tailwind CSS
- Zustand
- Framer Motion (可用于动画增强)

---

*Approved: 2026-03-01*
