# 进度日志 - RaFlow

> 记录会话活动、测试结果、文件变更

---

## 会话记录

### 2026-03-12 - Phase 16 UI 优化迭代 ✅

**目标**: 修复状态流转 bug，优化布局和交互

**完成的工作**:

| 功能 | 描述 |
|------|------|
| 动态布局 | 根据窗口高度自适应 compact/normal/expanded 三种模式 |
| 主题网格 | 基于容器宽度自适应列数 (ResizeObserver) |
| 状态修复 | idle 状态不接收转录事件和显示光标 |
| 文字颜色 | committed 用主色，partial 用半透明色区分 |
| 尺寸范围 | 扩大为 260x100 ~ 1000x800 |
| 滑块 UX | 拖动时预览，释放时保存，消除抖动 |

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 居中布局，动态高度监听 |
| `src/components/SettingsPanel.tsx` | 尺寸范围调整，滑块优化 |
| `src/components/TranscriptDisplay.tsx` | 状态保护，颜色区分 |
| `src/components/WaveformVisualizer.tsx` | 紧凑模式支持 |
| `src/hooks/useTranscription.ts` | 事件状态检查 |
| `src/styles.css` | 滚动条样式 |
| `src-tauri/tauri.conf.json` | 窗口尺寸限制 |
| `src-tauri/src/config/mod.rs` | 默认窗口大小 |

**Git Commit**: `9f0e822` - feat(ui): improve floating window experience

---

### 2026-03-12 - Phase 15 UI/UX 优化迭代 ✅

**目标**: 完善设置面板，提升用户体验

**完成的工作**:

| 功能 | 描述 |
|------|------|
| 预设主题 | 5 个精美主题 (暗夜黑/晨曦金/深海蓝/薄荷绿/薰衣草) |
| 固定顶部 | 设置页面滚动时标题栏固定 |
| 尺寸范围 | 宽: 300-800, 高: 150-600 |
| 动态布局 | vmin 单位 padding + 百分比计算高度 |
| 实时生效 | 字体大小、文字颜色实时应用 |
| 滚动条 | Safari WebView 限制，接受系统样式 |

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src/components/SettingsPanel.tsx` | 主题预设、粘性头部、尺寸滑块 |
| `src/components/WaveformVisualizer.tsx` | 百分比计算高度 |
| `src/styles.css` | vmin padding |
| `src-tauri/tauri.conf.json` | 窗口尺寸限制 |

**验证结果**: ✅ 构建成功，布局动态适配

---

### 2026-03-11 - Phase 15 Bug 修复 ✅

**目标**: 修复快捷键和复制问题

**问题 1 - 快捷键重复触发**:
- 现象: 按一次 Cmd+Shift+H 后，状态变为 "Connecting"，然后又立即回到 "Ready"
- 原因: 全局快捷键在按下 (Pressed) 和释放 (Released) 时都触发回调
- 解决: 添加 `ShortcutState::Pressed` 检查，只在按下时处理

**问题 2 - 复制文字不完整**:
- 现象: 转录过程中部分文字已确认，但停止时复制的文字不完整
- 原因: commit 信号发送后等待时间太短 (500ms)
- 解决: 增加等待时间到 2 秒

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/lib.rs` | 添加快捷键事件状态检查 |
| `src-tauri/src/session/recording.rs` | 增加 commit 等待时间到 2s |

**测试结果**: ✅ 转录功能恢复正常，等待测试复制功能

---

### 2026-03-01 深夜 - Phase 14 图标优化 ✅

**目标**: 修复托盘图标全蓝问题，创建专业的麦克风图标

**问题分析**:
- 原托盘图标是全蓝色方块
- 应用图标也需要更新为更专业的麦克风图案

**解决方案**:

| 图标类型 | 尺寸 | 描述 |
|----------|------|------|
| 应用图标 | 512x512 | 蓝色圆角背景 + 白色麦克风 |
| 托盘图标 | 16x16 | 黑色麦克风剪影 (模板) |
| 托盘图标 @2x | 32x32 | 黑色麦克风剪影 (Retina) |

**创建流程**:
1. 创建麦克风 SVG 源图标 (microphone.svg)
2. 使用 `pnpm tauri icon` 生成多平台图标
3. 使用 ImageMagick 创建托盘模板图标

**代码变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/icons/microphone.svg` | 新增 SVG 源图标 |
| `src-tauri/icons/icon.png` | 更新为蓝色+麦克风 |
| `src-tauri/icons/icon.icns` | macOS 应用图标 |
| `src-tauri/icons/icon.ico` | Windows 应用图标 |
| `src-tauri/icons/trayTemplate.png` | 托盘模板图标 (16x16) |
| `src-tauri/icons/trayTemplate@2x.png` | 托盘模板图标 (32x32) |
| `src-tauri/tauri.conf.json` | 配置托盘图标路径 |

**验证结果**:
| 检查项 | 结果 |
|--------|------|
| 应用启动 | ✅ 正常 |
| 托盘图标显示 | ✅ 黑色麦克风剪影 |

---

### 2026-03-01 晚 - Phase 13 长句显示优化 ✅

**目标**: 解决长句显示不全和滚动问题

**问题分析**:
- 长句被截断无法完整显示
- 滚动到底部会回弹
- 实时转录不会自动滚动

**解决方案**:

| 问题 | 解决方案 |
|------|----------|
| 窗口太小 | 增加到 440×180px |
| 长句截断 | `overflow-wrap: anywhere` + 自动换行 |
| 弹性滚动 | `overscroll-behavior: none` |
| 不自动滚动 | 移除用户滚动检测，每次更新都滚动 |
| 底部截断 | 添加 `pb-4` 底部留白 |

**提交**: `db1bdfc feat(ui): Apple 风格 UI 重设计 + 长句显示优化`

---

### 2026-03-01 晚 - Phase 12 Apple 风格 UI 重设计 ✅

**目标**: 将 UI 改造为 Apple 设计风格

**设计特点**:
- SF Pro 字体风格 (-apple-system)
- Apple 系统颜色 (Blue #007AFF, Orange #FF9500, Purple #AF52DE, Red #FF3B30)
- 毛玻璃效果 (blur 50px + saturate 180%)
- 16-18px 大圆角
- 精致阴影和边框

**状态颜色**:
| 状态 | 颜色 | 用途 |
|------|------|------|
| idle | Gray | 空闲 |
| connecting | Orange | 连接中 |
| recording | Blue | 录音中 |
| processing | Purple | 处理中 |
| error | Red | 错误 |

---

### 2026-03-01 晚 - Phase 11 Bug 修复 ✅

**目标**: 修复会话恢复后发现的 bug

| Bug | 原因 | 解决方案 |
|-----|------|----------|
| 错误信息不显示 | WebSocket 失败时未发送事件 | 添加 transcription-error 事件 |
| invalid uri character | URL 中的 `["zh"]` 未编码 | 改为 `%5B%22zh%22%5D` |

---

### 2026-03-01 - Phase 10 转录识别率优化 ✅

**VAD 参数优化**:
| 参数 | 默认值 | 新值 | 调整理由 |
|------|--------|------|----------|
| `language_hints` | - | `["zh"]` | 明确中文优先 |
| `vad_threshold` | 0.4 | 0.55 | 提高检测门槛过滤噪音 |
| `vad_silence_threshold_secs` | 1.5 | 1.0 | 语速快时更快提交 |
| `min_speech_duration_ms` | 100 | 80 | 适应快语速短音节 |
| `min_silence_duration_ms` | 100 | 150 | 避免自然停顿被切断 |

---

### 2026-03-01 - Phase 9 UI/UX 优化 ✅

**目标**: 优化应用显示 UI/UX
- 频谱柱状图 (20 条动态柱)
- 状态切换动画
- 打字机效果 + 滚动动画

---

### 2026-03-01 - Phase 8 端到端集成 ✅

**活动**: 创建 session 模块，实现录音状态机，WebSocket 双向通信

**架构**:
```
src-tauri/src/session/
├── mod.rs              # 模块入口
├── recording.rs        # RecordingSession 状态机
└── websocket_task.rs   # WebSocket 双向通信
```

---

### 2026-03-01 - Phase 1-7 MVP 核心 ✅

- Phase 1: 项目初始化
- Phase 2: 音频管道 (cpal + rubato)
- Phase 3: WebSocket 转录 (tokio-tungstenite)
- Phase 4: 全局热键 (Cmd+Shift+H)
- Phase 5: 剪贴板输出 (arboard)
- Phase 6: 前端 UI (React + Framer Motion)
- Phase 7: 验证测试

---

## 测试结果

| 日期 | 测试项 | 结果 |
|------|--------|------|
| 2026-03-01 | cargo test | ✅ 43 passed |
| 2026-03-01 | cargo clippy | ✅ 无警告 |
| 2026-03-01 | npx tsc --noEmit | ✅ 通过 |
| 2026-03-01 | pnpm build | ✅ 通过 |

---

## ✅ MVP 功能验证

- ✅ 全局热键 (Cmd+Shift+H) 正常触发
- ✅ WebSocket 连接成功
- ✅ 实时转录功能正常
- ✅ 剪贴板输出功能正常
- ✅ Apple 风格 UI 显示
- ✅ 长句自动换行和滚动
- ✅ 专业麦克风图标
