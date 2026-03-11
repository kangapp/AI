import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [settings, setSettings] = useState<WindowSettings>({
    position: null,
    window_size: { width: 440, height: 180 },
    font_size: 14,
    text_color: '#FFFFFF',
    background_color: '#1C1C1E',
    background_opacity: 85,
    hidden: false,
  });
  const [isDragging, setIsDragging] = useState(false);

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
    setSettings(newSettings);
    await invoke('save_window_settings', { settings: newSettings });

    // 当隐藏设置变化时，同步窗口显示状态
    if (key === 'hidden') {
      if (value) {
        await invoke('hide_window');
      } else {
        await invoke('show_window');
      }
    }
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
      className="flex flex-col h-full px-4 py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <span className="text-[13px] text-white">设置</span>
        <div className="w-10" />
      </div>

      {/* Position */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-gray-400">位置</span>
        <button
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
            isDragging
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          拖拽移动
        </button>
      </div>

      {/* Size */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] text-gray-400">大小</span>
          <span className="text-[11px] text-gray-500">
            W: {settings.window_size.width} x H: {settings.window_size.height}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="range"
              min="300"
              max="600"
              value={settings.window_size.width}
              onChange={(e) =>
                updateSetting('window_size', {
                  ...settings.window_size,
                  width: Number(e.target.value),
                })
              }
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div className="flex-1">
            <input
              type="range"
              min="100"
              max="400"
              value={settings.window_size.height}
              onChange={(e) =>
                updateSetting('window_size', {
                  ...settings.window_size,
                  height: Number(e.target.value),
                })
              }
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700/50 my-2" />

      {/* Font Size */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] text-gray-400">字体大小</span>
          <span className="text-[11px] text-gray-500">{settings.font_size}px</span>
        </div>
        <input
          type="range"
          min="10"
          max="24"
          value={settings.font_size}
          onChange={(e) => updateSetting('font_size', Number(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Text Color */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-gray-400">文字颜色</span>
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
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-gray-400">背景颜色</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.background_color}
            onChange={(e) => updateSetting('background_color', e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0"
          />
          <span className="text-[11px] text-gray-500">{settings.background_color}</span>
        </div>
      </div>

      {/* Background Opacity */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] text-gray-400">背景透明度</span>
          <span className="text-[11px] text-gray-500">{settings.background_opacity}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.background_opacity}
          onChange={(e) => updateSetting('background_opacity', Number(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700/50 my-2" />

      {/* Hidden Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-400">隐藏悬浮窗</span>
        <button
          onClick={() => updateSetting('hidden', !settings.hidden)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.hidden ? 'bg-blue-500' : 'bg-gray-700'
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.hidden ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </motion.div>
  );
}
