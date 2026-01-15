/**
 * 性能监控相关的 React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  performanceApi,
} from '../../../services/performanceApi';

/**
 * 获取当前系统指标
 */
export function useSystemMetrics(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['performance', 'system-metrics'],
    queryFn: () => performanceApi.getSystemMetrics(),
    refetchInterval,
    staleTime: 1000,
  });
}

/**
 * 获取系统指标历史
 */
export function useSystemMetricsHistory(limit = 100) {
  return useQuery({
    queryKey: ['performance', 'system-metrics-history', limit],
    queryFn: () => performanceApi.getSystemMetricsHistory(limit),
    refetchInterval: 30000, // 每30秒刷新
    staleTime: 10000,
  });
}

/**
 * 获取慢查询列表
 */
export function useSlowQueries(params?: {
  min_execution_time_ms?: number;
  limit?: number;
}, refetchInterval = 10000) {
  return useQuery({
    queryKey: ['performance', 'slow-queries', params],
    queryFn: () => performanceApi.getSlowQueries(params),
    refetchInterval,
    staleTime: 5000,
  });
}

/**
 * 获取查询性能统计
 */
export function useQueryPerformanceStats(params?: {
  database_name?: string;
  hours?: number;
}, refetchInterval = 15000) {
  return useQuery({
    queryKey: ['performance', 'query-stats', params],
    queryFn: () => performanceApi.getQueryPerformanceStats(params),
    refetchInterval,
    staleTime: 10000,
  });
}

/**
 * 获取详细健康状态
 */
export function useHealthDetailed(refetchInterval = 10000) {
  return useQuery({
    queryKey: ['performance', 'health-detailed'],
    queryFn: () => performanceApi.getHealthDetailed(),
    refetchInterval,
    staleTime: 5000,
  });
}

/**
 * 获取性能阈值配置
 */
export function usePerformanceThresholds() {
  return useQuery({
    queryKey: ['performance', 'thresholds'],
    queryFn: () => performanceApi.getPerformanceThresholds(),
    staleTime: Infinity, // 阈值配置很少变化
  });
}

/**
 * 获取HTTP请求性能统计
 */
export function usePerformanceMetrics(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['performance', 'metrics'],
    queryFn: () => performanceApi.getPerformanceMetrics(),
    refetchInterval,
    staleTime: 2000,
  });
}

/**
 * 清理历史数据
 */
export function useCleanupMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days?: number) => performanceApi.cleanupMetrics(days),
    onSuccess: () => {
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}

/**
 * 组合 hook: 获取所有性能监控数据
 */
export function usePerformanceDashboard() {
  const systemMetrics = useSystemMetrics();
  const healthStatus = useHealthDetailed();
  const slowQueries = useSlowQueries();
  const queryStats = useQueryPerformanceStats();
  const performanceMetrics = usePerformanceMetrics();
  const thresholds = usePerformanceThresholds();

  const isLoading =
    systemMetrics.isLoading ||
    healthStatus.isLoading ||
    slowQueries.isLoading ||
    queryStats.isLoading ||
    performanceMetrics.isLoading ||
    thresholds.isLoading;

  const isError =
    systemMetrics.isError ||
    healthStatus.isError ||
    slowQueries.isError ||
    queryStats.isError ||
    performanceMetrics.isError ||
    thresholds.isError;

  const error =
    systemMetrics.error ||
    healthStatus.error ||
    slowQueries.error ||
    queryStats.error ||
    performanceMetrics.error ||
    thresholds.error;

  return {
    data: {
      systemMetrics: systemMetrics.data,
      healthStatus: healthStatus.data,
      slowQueries: slowQueries.data || [],
      queryStats: queryStats.data,
      performanceMetrics: performanceMetrics.data,
      thresholds: thresholds.data,
    },
    isLoading,
    isError,
    error,
    refetch: () => {
      systemMetrics.refetch();
      healthStatus.refetch();
      slowQueries.refetch();
      queryStats.refetch();
      performanceMetrics.refetch();
    },
  };
}
