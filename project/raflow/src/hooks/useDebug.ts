// Debug mode hook - 调试模式 Hook
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { DebugStatus } from '../types';

// API 调用封装
const debugApi = {
  // 获取调试状态
  getStatus: async (): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('get_debug_status');
  },

  // 启用调试模式
  enable: async (): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('enable_debug_mode');
  },

  // 禁用调试模式
  disable: async (): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('disable_debug_mode');
  },

  // 切换调试模式
  toggle: async (): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('toggle_debug_mode');
  },

  // 设置日志级别
  setLogLevel: async (level: string): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('set_debug_log_level', { level });
  },

  // 添加包含的目标模块
  addIncludeTarget: async (target: string): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('add_debug_include_target', { target });
  },

  // 移除包含的目标模块
  removeIncludeTarget: async (target: string): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('remove_debug_include_target', { target });
  },

  // 添加排除的目标模块
  addExcludeTarget: async (target: string): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('add_debug_exclude_target', { target });
  },

  // 移除排除的目标模块
  removeExcludeTarget: async (target: string): Promise<DebugStatus> => {
    return await invoke<DebugStatus>('remove_debug_exclude_target', { target });
  },
};

/**
 * 调试模式 Hook
 *
 * 提供调试模式状态管理和操作方法
 */
export function useDebug() {
  const queryClient = useQueryClient();

  // 获取调试状态
  const debugQuery = useQuery({
    queryKey: ['debug'],
    queryFn: debugApi.getStatus,
    refetchInterval: 5000, // 每 5 秒刷新一次
  });

  // 启用调试模式
  const enableMutation = useMutation({
    mutationFn: debugApi.enable,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 禁用调试模式
  const disableMutation = useMutation({
    mutationFn: debugApi.disable,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 切换调试模式
  const toggleMutation = useMutation({
    mutationFn: debugApi.toggle,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 设置日志级别
  const setLogLevelMutation = useMutation({
    mutationFn: debugApi.setLogLevel,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 添加包含的目标模块
  const addIncludeTargetMutation = useMutation({
    mutationFn: debugApi.addIncludeTarget,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 移除包含的目标模块
  const removeIncludeTargetMutation = useMutation({
    mutationFn: debugApi.removeIncludeTarget,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 添加排除的目标模块
  const addExcludeTargetMutation = useMutation({
    mutationFn: debugApi.addExcludeTarget,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  // 移除排除的目标模块
  const removeExcludeTargetMutation = useMutation({
    mutationFn: debugApi.removeExcludeTarget,
    onSuccess: (data: DebugStatus) => {
      queryClient.setQueryData(['debug'], data);
    },
  });

  return {
    // 状态
    status: debugQuery.data,
    isLoading: debugQuery.isLoading,
    error: debugQuery.error,
    isEnabled: debugQuery.data?.enabled ?? false,
    logLevel: debugQuery.data?.log_level ?? 'info',
    includeTargets: debugQuery.data?.include_targets ?? [],
    excludeTargets: debugQuery.data?.exclude_targets ?? [],

    // 操作方法
    enable: enableMutation.mutate,
    disable: disableMutation.mutate,
    toggle: toggleMutation.mutate,
    setLogLevel: setLogLevelMutation.mutate,
    addIncludeTarget: addIncludeTargetMutation.mutate,
    removeIncludeTarget: removeIncludeTargetMutation.mutate,
    addExcludeTarget: addExcludeTargetMutation.mutate,
    removeExcludeTarget: removeExcludeTargetMutation.mutate,

    // 操作状态
    isMutating: enableMutation.isPending ||
                disableMutation.isPending ||
                toggleMutation.isPending ||
                setLogLevelMutation.isPending,

    // 刷新
    refetch: debugQuery.refetch,
  };
}

export default useDebug;
