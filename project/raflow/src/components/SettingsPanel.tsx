import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { motion } from 'framer-motion';

interface WindowSettings {
  position: { x: number; y: number } | null;
  window_size: { width: number; height: number };
  font_size: number;
  text_color: string;
  background_color: string;
  background_opacity: number;
  hidden: boolean;
}

interface SettingsPanelProps {
  onBack: () => void;
}

// 预设主题 - 精致美观的配色方案
const THEMES = [
  {
    id: 'midnight',
    name: '暗夜黑',
    background_color: '#1C1C1E',
    background_opacity: 90,
    text_color: '#FFFFFF',
  },
  {
    id: 'sunrise',
    name: '晨曦金',
    background_color: '#2D2520',
    background_opacity: 85,
    text_color: '#FFD699',
  },
  {
    id: 'ocean',
    name: '深海蓝',
    background_color: '#0A1929',
    background_opacity: 85,
    text_color: '#64B5F6',
  },
  {
    id: 'mint',
    name: '薄荷绿',
    background_color: '#1A2E2A',
    background_opacity: 85,
    text_color: '#81D4BC',
  },
  {
    id: 'lavender',
    name: '薰衣草',
    background_color: '#2A2438',
    background_opacity: 85,
    text_color: '#D4C4E8',
  },
];

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [settings, setSettings] = useState<WindowSettings>({
    position: null,
    window_size: { width: 380, height: 160 },
    font_size: 14,
    text_color: '#FFFFFF',
    background_color: '#1C1C1E',
    background_opacity: 85,
    hidden: false,
  });
  // 预览窗口大小（拖动时实时更新，不立即生效）
  const [sizePreview, setSizePreview] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridCols, setGridCols] = useState(3);

  // 自适应网格列数 - 基于容器实际宽度
  useEffect(() => {
    const updateGridCols = () => {
      if (!gridRef.current) {
        // 如果 gridRef 还没挂载，延迟重试
        setTimeout(updateGridCols, 50);
        return;
      }
      const width = gridRef.current.offsetWidth;
      console.log('Grid width:', width); // 调试
      // 根据容器宽度动态计算列数 (调整阈值以适应 padding)
      if (width >= 350) setGridCols(5);
      else if (width >= 250) setGridCols(4);
      else setGridCols(3);
    };

    // 延迟执行确保 DOM 已挂载
    const timer = setTimeout(updateGridCols, 50);

    const resizeObserver = new ResizeObserver(updateGridCols);
    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, []);

  // Load settings on mount
  useEffect(() => {
    invoke<WindowSettings>('get_window_settings').then(setSettings).catch(console.error);
  }, []);

  // Save position when drag ends
  useEffect(() => {
    const handleDragEnd = async () => {
      if (isDragging) {
        setIsDragging(false);
        await invoke('save_window_position');
        // Reload settings to get new position
        const newSettings = await invoke<WindowSettings>('get_window_settings');
        setSettings(newSettings);
      }
    };

    window.addEventListener('mouseup', handleDragEnd);
    return () => window.removeEventListener('mouseup', handleDragEnd);
  }, [isDragging]);

  const updateSetting = async <K extends keyof WindowSettings>(key: K, value: WindowSettings[K]) => {
    const newSettings = { ...settings, [key]: value };

    // 先保存到后端，成功后再更新本地状态
    try {
      await invoke('save_window_settings', { settings: newSettings });

      // 当窗口大小变化时，实时调整窗口
      if (key === 'window_size') {
        await invoke('set_window_size', {
          width: newSettings.window_size.width,
          height: newSettings.window_size.height,
        });
      }

      // 当隐藏设置变化时，同步窗口显示状态
      if (key === 'hidden') {
        if (value) {
          await invoke('hide_window');
        } else {
          await invoke('show_window');
        }
      }

      setSettings(newSettings);
      // Emit event to notify App of settings change
      await emit('settings-changed', newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Apply theme preset - 一次性更新所有设置
  const applyTheme = async (theme: typeof THEMES[0]) => {
    const newSettings: WindowSettings = {
      ...settings,
      background_color: theme.background_color,
      background_opacity: theme.background_opacity,
      text_color: theme.text_color,
    };

    try {
      // 保存到后端
      await invoke('save_window_settings', { settings: newSettings });
      // 更新本地状态
      setSettings(newSettings);
      // 发送事件通知 App
      await emit('settings-changed', newSettings);
    } catch (error) {
      console.error('Failed to apply theme:', error);
    }
  };

  // Check if a theme is currently active
  const isThemeActive = (theme: typeof THEMES[0]) => {
    return (
      settings.background_color.toLowerCase() === theme.background_color.toLowerCase() &&
      settings.background_opacity === theme.background_opacity &&
      settings.text_color.toLowerCase() === theme.text_color.toLowerCase()
    );
  };

  const handleDragStart = async () => {
    setIsDragging(true);
    await invoke('start_dragging');
  };

  const handleDragEnd = async () => {
    setIsDragging(false);
    // Position will be saved by the drag end handler in Rust
  };

  return (
    <motion.div
      className="flex flex-col h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[var(--panel-bg)] backdrop-blur-xl pb-3 pt-2 px-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
          <span className="text-[13px] text-white font-medium">设置</span>
          <div className="w-8" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="flex-1 overflow-y-auto px-2 py-3"
      >
        {/* Theme Presets */}
        <div className="mb-6">
          <span className="text-[13px] text-gray-400 block mb-3">主题</span>
          <div
            ref={gridRef}
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme)}
                className={`relative group rounded-xl p-3 transition-all duration-200 ${
                  isThemeActive(theme)
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#1C1C1E]'
                    : 'hover:scale-105 hover:bg-white/5'
                }`}
                style={{
                  backgroundColor: theme.background_color,
                }}
                title={theme.name}
              >
                {/* Theme preview */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-full h-8 rounded-md"
                    style={{ backgroundColor: theme.background_color }}
                  />
                  <span
                    className="text-[10px] font-medium truncate w-full text-center"
                    style={{ color: theme.text_color }}
                  >
                    {theme.name}
                  </span>
                </div>
                {/* Active indicator */}
                {isThemeActive(theme) && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Position */}
        <div className="flex items-center justify-between mb-5 py-2">
          <span className="text-[13px] text-gray-400">位置</span>
          <button
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
              isDragging
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            拖拽移动
          </button>
        </div>

        {/* Size - 更合理的范围 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-gray-400">大小</span>
            <span className="text-[12px] text-gray-500">
              {(sizePreview?.width || settings.window_size.width)} × {(sizePreview?.height || settings.window_size.height)}
            </span>
          </div>
          <div className="space-y-3">
            {/* Width slider */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-8">宽</span>
              <input
                type="range"
                min="260"
                max="1000"
                value={sizePreview?.width || settings.window_size.width}
                onChange={(e) => {
                  const newWidth = Number(e.target.value);
                  setSizePreview({
                    width: newWidth,
                    height: sizePreview?.height || settings.window_size.height,
                  });
                }}
                onMouseUp={(e) => {
                  // 释放滑块时保存并调整窗口
                  const finalWidth = Number((e.target as HTMLInputElement).value);
                  const finalHeight = sizePreview?.height || settings.window_size.height;
                  setSizePreview(null);
                  updateSetting('window_size', {
                    width: finalWidth,
                    height: finalHeight,
                  });
                }}
                onTouchEnd={(e) => {
                  // 移动端释放时保存
                  const finalWidth = Number((e.target as HTMLInputElement).value);
                  const finalHeight = sizePreview?.height || settings.window_size.height;
                  setSizePreview(null);
                  updateSetting('window_size', {
                    width: finalWidth,
                    height: finalHeight,
                  });
                }}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            {/* Height slider */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-8">高</span>
              <input
                type="range"
                min="100"
                max="800"
                value={sizePreview?.height || settings.window_size.height}
                onChange={(e) => {
                  const newHeight = Number(e.target.value);
                  setSizePreview({
                    width: sizePreview?.width || settings.window_size.width,
                    height: newHeight,
                  });
                }}
                onMouseUp={(e) => {
                  const finalHeight = Number((e.target as HTMLInputElement).value);
                  const finalWidth = sizePreview?.width || settings.window_size.width;
                  setSizePreview(null);
                  updateSetting('window_size', {
                    width: finalWidth,
                    height: finalHeight,
                  });
                }}
                onTouchEnd={(e) => {
                  const finalHeight = Number((e.target as HTMLInputElement).value);
                  const finalWidth = sizePreview?.width || settings.window_size.width;
                  setSizePreview(null);
                  updateSetting('window_size', {
                    width: finalWidth,
                    height: finalHeight,
                  });
                }}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 my-4" />

        {/* Font Size */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-gray-400">字体大小</span>
            <span className="text-[12px] text-gray-500">{settings.font_size}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="22"
            value={settings.font_size}
            onChange={(e) => updateSetting('font_size', Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Text Color */}
        <div className="flex items-center justify-between mb-4 py-1">
          <span className="text-[13px] text-gray-400">文字颜色</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.text_color}
              onChange={(e) => updateSetting('text_color', e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0"
            />
            <span className="text-[11px] text-gray-500">{settings.text_color}</span>
          </div>
        </div>

        {/* Background Color */}
        <div className="flex items-center justify-between mb-4 py-1">
          <span className="text-[13px] text-gray-400">背景颜色</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.background_color}
              onChange={(e) => updateSetting('background_color', e.target.value)}
              className="w-7 h-7 rounded-lg cursor-pointer border-0 shadow-md"
            />
            <span className="text-[12px] text-gray-500">{settings.background_color}</span>
          </div>
        </div>

        {/* Background Opacity */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-gray-400">背景透明度</span>
            <span className="text-[12px] text-gray-500">{settings.background_opacity}%</span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            value={settings.background_opacity}
            onChange={(e) => updateSetting('background_opacity', Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 my-4" />

        {/* Hidden Toggle */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[13px] text-gray-400">隐藏悬浮窗</span>
          <button
            onClick={() => updateSetting('hidden', !settings.hidden)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.hidden ? 'bg-blue-500' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                settings.hidden ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
