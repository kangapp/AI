// 权限管理 Hook - 处理麦克风和辅助功能权限
import { useCallback, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { permissionCommands } from '../lib/tauri';

/**
 * 权限管理 Hook
 * 检查和请求麦克风、辅助功能权限
 */
export function usePermissions() {
  const { permissionStatus, setPermissionStatus, setPermissionGuideOpen } =
    useAppStore();

  /**
   * 检查所有权限
   */
  const checkAllPermissions = useCallback(async () => {
    try {
      // 检查麦克风权限
      const micStatus = await permissionCommands.checkMicrophonePermission();
      setPermissionStatus({ microphone: micStatus as any });

      // 检查辅助功能权限（仅 macOS）
      if (process.platform === 'darwin') {
        const a11yStatus =
          await permissionCommands.checkAccessibilityPermission();
        setPermissionStatus({ accessibility: a11yStatus as any });
      }
    } catch (error) {
      console.error('Check permissions error:', error);
    }
  }, [setPermissionStatus]);

  /**
   * 请求麦克风权限
   */
  const requestMicrophonePermission = useCallback(async () => {
    try {
      const status =
        await permissionCommands.requestMicrophonePermission();
      setPermissionStatus({ microphone: status as any });
      return status === 'granted';
    } catch (error) {
      console.error('Request microphone permission error:', error);
      return false;
    }
  }, [setPermissionStatus]);

  /**
   * 请求辅助功能权限（macOS）
   */
  const requestAccessibilityPermission = useCallback(async () => {
    if (process.platform !== 'darwin') {
      return true; // 非 macOS 平台不需要
    }

    try {
      const status =
        await permissionCommands.requestAccessibilityPermission();
      setPermissionStatus({ accessibility: status as any });
      return status === 'granted';
    } catch (error) {
      console.error('Request accessibility permission error:', error);
      return false;
    }
  }, [setPermissionStatus]);

  /**
   * 打开权限引导
   */
  const openPermissionGuide = useCallback(() => {
    setPermissionGuideOpen(true);
  }, [setPermissionGuideOpen]);

  /**
   * 关闭权限引导
   */
  const closePermissionGuide = useCallback(() => {
    setPermissionGuideOpen(false);
  }, [setPermissionGuideOpen]);

  /**
   * 检查是否需要显示权限引导
   */
  const needsPermissionGuide = useCallback(() => {
    return (
      permissionStatus.microphone !== 'granted' ||
      (process.platform === 'darwin' &&
        permissionStatus.accessibility !== 'granted')
    );
  }, [permissionStatus]);

  // 初始化时检查权限
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  return {
    permissionStatus,
    checkAllPermissions,
    requestMicrophonePermission,
    requestAccessibilityPermission,
    openPermissionGuide,
    closePermissionGuide,
    needsPermissionGuide,
  };
}
