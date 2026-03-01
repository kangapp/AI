# UI/UX 优化设计文档

## 概述

优化 RaFlow 实时转录应用的显示界面，提升用户体验。

## 需求总结

| 模块 | 需求 |
|------|------|
| 波形图 | 频谱柱状图，多根动态柱条 |
| 状态切换 | Processing 动画、过渡效果、错误显示、状态颜色主题 |
| 文字动画 | 打字机、滚动、渐变、弹跳 |
| 清除策略 | 新录音立即清空旧内容 |

## 实现方案

**方案：渐进增强**

在现有组件基础上逐步增强，保持代码结构稳定。

优点：
- 风险低，可增量测试
- 复用现有 Framer Motion 依赖
- 改动范围可控

---

## 详细设计

### 1. 波形可视化 (WaveformVisualizer)

**当前**：5 条简单柱状图

**改进后**：
- 20 条频谱柱
- 高度根据 `audioLevel` 动态计算，添加随机偏移模拟真实频谱
- 颜色渐变：根据录音状态变化

| 状态 | 波形颜色 |
|------|----------|
| idle | 灰色 (`gray-500`) |
| recording | 蓝紫渐变 (`blue-400` → `purple-500`) |
| processing | 黄色脉冲 (`yellow-400`) |
| error | 红色 (`red-500`) |

**核心逻辑**：
```tsx
const bars = 20;
const heights = Array.from({ length: bars }, (_, i) => {
  const baseHeight = audioLevel * 0.8;
  const randomOffset = Math.random() * 0.3;
  return Math.min(1, baseHeight + randomOffset);
});
```

---

### 2. 状态系统

**状态定义**：
```typescript
type RecordingStatus =
  | "idle"        // 空闲 - 灰色调
  | "recording"   // 录音中 - 蓝紫色调
  | "processing"  // 处理中 - 黄色脉冲
  | "error"       // 错误 - 红色
```

**状态颜色映射**：

| 状态 | 背景 | 波形 | 文字 | 指示器 |
|------|------|------|------|--------|
| idle | 透明 | 灰色 | 灰色 | 灰色圆点 |
| recording | 微蓝 | 蓝紫渐变 | 白色 | 蓝色脉冲 |
| processing | 微黄 | 黄色脉冲 | 黄色 | 旋转加载 |
| error | 微红 | 红色 | 红色 | 红色警告 |

---

### 3. 转录文字动画 (TranscriptDisplay)

**打字机效果**：
- 新文字逐字符淡入显示
- 使用 `useTypewriter` hook 控制
- 速度：每 30ms 显示一个字符

**滚动过渡**：
- committed 文字向上淡出
- partial 文字从下方淡入
- 使用 Framer Motion 的 `AnimatePresence`

**弹跳动画**：
- 新字符出现时 `scale(1.1) → scale(1)`
- 使用 spring 弹簧动画

**动画配置**：
```tsx
const textVariants = {
  enter: { opacity: 0, y: 10, scale: 1.1 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 }
};

const transition = { type: "spring", stiffness: 300, damping: 20 };
```

**Partial 渐变**：
- partial 文字变化时平滑过渡
- 透明度 0.6，带闪烁光标

---

### 4. 清除逻辑

**触发时机**：监听 `recording-state-changed` 事件，当 `true`（开始新录音）时

**清除内容**：
- `committedText` → `""`
- `partialText` → `""`

**修改位置**：`useTranscription.ts`

```typescript
listen<boolean>("recording-state-changed", (event) => {
  const isRecording = event.payload;
  setState((prev) => ({
    ...prev,
    status: isRecording ? "recording" : "idle",
    committedText: isRecording ? "" : prev.committedText,
    partialText: isRecording ? "" : prev.partialText,
  }));
});
```

---

### 5. 错误状态处理

**错误类型**：
```typescript
type TranscriptionError =
  | { type: "auth"; message: "API 密钥无效" }
  | { type: "network"; message: "网络连接失败" }
  | { type: "server"; message: "服务器错误" };
```

**错误显示**：
- 波形变红色
- 状态指示器显示红色警告图标
- 底部显示错误提示文字，3 秒后自动消失

**错误恢复**：
- 用户重新按快捷键时清除错误状态
- 自动重置为 idle

---

## 文件改动清单

| 文件 | 改动类型 | 主要内容 |
|------|----------|----------|
| `WaveformVisualizer.tsx` | 重写 | 20 条频谱柱 + 状态颜色渐变 |
| `TranscriptDisplay.tsx` | 重写 | 打字机 + 滚动 + 弹跳动画 |
| `useTranscription.ts` | 修改 | 新增 error 状态 + 清除逻辑 |
| `App.tsx` | 修改 | 状态颜色主题 + 错误显示 |
| `hooks/useTypewriter.ts` | 新增 | 打字机效果 hook |

---

## 组件结构

```
App.tsx
├── StatusIndicator (状态圆点 + 文字)
├── WaveformVisualizer (频谱波形)
├── TranscriptDisplay
│   ├── CommittedText (已确认文字 + 滚动动画)
│   └── PartialText (部分识别 + 打字机 + 光标)
└── ErrorToast (错误提示，条件渲染)
```

---

## 依赖

- React 18
- Framer Motion (已有)
- Tailwind CSS (已有)

无需新增依赖。
