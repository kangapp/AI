import { useEffect } from 'react';
import { FloatingWindow, PermissionGuide } from './components';
import { useAppStore } from './stores/useAppStore';
import { usePermissions } from './hooks';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

/**
 * RaFlow 主应用组件
 *
 * 功能：
 * - 显示悬浮窗界面（录音控制、波形可视化、转录结果显示）
 * - 权限引导流程（麦克风、辅助功能、API 密钥配置）
 * - 窗口状态管理（最小化、关闭到托盘）
 */
function App() {
  const { isPermissionGuideOpen, setPermissionGuideOpen } = useAppStore();
  const { needsPermissionGuide } = usePermissions();

  // 初始化时检查是否需要显示权限引导
  useEffect(() => {
    if (needsPermissionGuide()) {
      setPermissionGuideOpen(true);
    }
  }, [needsPermissionGuide, setPermissionGuideOpen]);

  // 监听窗口关闭请求事件 - 隐藏窗口而非退出
  useEffect(() => {
    const unlisten = listen('tauri://close-requested', async () => {
      await getCurrentWindow().hide();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 监听全局快捷键切换录音事件
  useEffect(() => {
    const unlisten = listen('toggle-recording', () => {
      console.log('Toggle recording shortcut triggered');
      // TODO: 实现切换录音逻辑
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = async () => {
    await getCurrentWindow().hide();
  };

  return (
    <>
      {/* 主悬浮窗 */}
      <FloatingWindow onMinimize={handleMinimize} />

      {/* 权限引导对话框 */}
      <PermissionGuide
        isOpen={isPermissionGuideOpen}
        onClose={() => setPermissionGuideOpen(false)}
      />
    </>
  );
}

export default App;
