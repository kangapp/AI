# 音频显示样式设计文档

## 概述

在设置面板新增「音频样式」设置项，提供 4 种可视化样式选择，让用户可以自定义悬浮窗的音频显示效果。

## 架构设计

### 数据流
```
设置面板 → save_window_settings → Rust后端 → 存储到配置文件
                                                            ↓
App.tsx ← get_window_settings ← 读取配置文件 ← 加载时
```

### 接口变更

**Rust 后端 (WindowSettings)**
```rust
struct WindowSettings {
    // ... 现有字段
    audio_style: String,  // "waveform" | "pulse" | "spectrum" | "particle"
}
```

### 前端组件结构
- `AudioVisualizer` - 包装组件，根据设置渲染对应样式
- `WaveformVisualizer` - 波形条形（现有，优化）
- `PulseVisualizer` - 圆形脉动
- `SpectrumVisualizer` - 频谱圆环
- `ParticleVisualizer` - 粒子爆炸

## 样式详细设计

### 1. 波形条形 (waveform)
- 当前实现的优化版
- 24/12 个柱状条根据音量动态调整高度
- 中心条高，边缘条低，呈现波浪效果
- 使用渐变色根据状态变化

### 2. 圆形脉动 (pulse)
- 单个圆形根据音量缩放 (0.6 - 1.0)
- 边缘发光效果 (box-shadow)
- 颜色根据状态变化
- 平滑过渡动画

### 3. 频谱圆环 (spectrum)
- 4-5 个同心圆环
- 不同频率对应不同圆环的亮度/粗细
- 音量越大，圆环越亮/越粗
- 从中心向外扩散效果

### 4. 粒子爆炸 (particle)
- 中心发射粒子
- 音量控制粒子数量 (5-20) 和速度
- 粒子向上漂浮并淡出
- 颜色根据状态变化

## UI 设计

### 设置面板样式选择器
- 2x2 网格布局
- 每个样式一个卡片
- 卡片包含：样式预览 + 名称
- 当前选中的样式有边框高亮

### 样式预览
- 使用 CSS/SVG 制作静态预览图
- 或使用小型的实时预览动画

## 实施步骤

1. 修改 Rust 后端 WindowSettings 结构体
2. 前端 WindowSettings 接口添加 audio_style
3. 创建 3 个新的可视化组件
4. 创建 AudioVisualizer 包装组件
5. 修改 App.tsx 使用 AudioVisualizer
6. 设置面板添加样式选择器
7. 测试和优化

## 验收标准

- [ ] 4 种样式都能正常显示
- [ ] 切换样式后能实时生效
- [ ] 设置能正确保存和加载
- [ ] 悬浮窗尺寸变化时样式自适应
- [ ] 各种状态 (recording, idle, error) 下样式颜色正确
