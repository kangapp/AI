/**
 * 性能监控相关的 API 接口和类型定义
 */

import { api } from './api';

// 系统指标类型
export interface SystemMetrics {
  timestamp: string;
  cpu: {
    percent: number;
    count: number;
  };
  memory: {
    percent: number;
    total_mb: number;
    available_mb: number;
    used_mb: number;
    swap_percent: number;
    swap_total_mb: number;
    swap_used_mb: number;
  };
  disk: {
    percent: number;
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  process: {
    pid: number;
    memory_mb: number;
    cpu_percent: number;
    num_threads: number;
    num_fds: number;
  };
}

// 慢查询类型
export interface SlowQuery {
  timestamp: string;
  databaseName: string;
  queryType: string;
  sql: string;
  executionTimeMs: number;
  rowCount: number | null;
}

// 查询性能统计类型
export interface QueryPerformanceStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: number;
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  totalRows: number;
  slowQueries: number;
  slowQueryRate: number;
}

// 健康状态类型
export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  issues: Array<{
    type: string;
    message: string;
  }>;
  systemMetrics: SystemMetrics | null;
  slowQueryCount: number;
}

// 性能阈值类型
export interface PerformanceThresholds {
  slow_query: {
    threshold_ms: number;
    very_slow_threshold_ms: number;
    critical_threshold_ms: number;
  };
  request: {
    fast_threshold_ms: number;
    normal_threshold_ms: number;
    slow_threshold_ms: number;
  };
  memory: {
    warning_threshold_percent: number;
    critical_threshold_percent: number;
  };
  retention: {
    metrics_retention_days: number;
    performance_history_limit: number;
  };
}

// HTTP请求性能统计类型
export interface PerformanceMetrics {
  totalRequests: number;
  requestsByPath: Record<string, {
    count: number;
    total_latency_ms: number;
    avg_latency_ms: number;
    errors: number;
  }>;
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;
  recentRequests: Array<{
    timestamp: string;
    method: string;
    path: string;
    status_code: number;
    elapsed_ms: number;
    performance_category: string;
  }>;
}

// 扩展 ApiClient 类，添加性能监控方法
class PerformanceApi {
  private async get<T>(path: string): Promise<T> {
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1${path}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  private async post<T>(path: string, body?: any): Promise<T> {
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  /**
   * 获取当前系统指标
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    return this.get<SystemMetrics>('/system');
  }

  /**
   * 获取系统指标历史
   */
  async getSystemMetricsHistory(limit = 100): Promise<SystemMetrics[]> {
    return this.get<SystemMetrics[]>(`/system/history?limit=${limit}`);
  }

  /**
   * 获取慢查询列表
   */
  async getSlowQueries(params?: {
    min_execution_time_ms?: number;
    limit?: number;
  }): Promise<SlowQuery[]> {
    const searchParams = new URLSearchParams();
    if (params?.min_execution_time_ms) {
      searchParams.append('min_execution_time_ms', params.min_execution_time_ms.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    const query = searchParams.toString();
    return this.get<SlowQuery[]>(`/slow-queries${query ? `?${query}` : ''}`);
  }

  /**
   * 获取查询性能统计
   */
  async getQueryPerformanceStats(params?: {
    database_name?: string;
    hours?: number;
  }): Promise<QueryPerformanceStats> {
    const searchParams = new URLSearchParams();
    if (params?.database_name) {
      searchParams.append('database_name', params.database_name);
    }
    if (params?.hours) {
      searchParams.append('hours', params.hours.toString());
    }
    const query = searchParams.toString();
    return this.get<QueryPerformanceStats>(`/query-performance${query ? `?${query}` : ''}`);
  }

  /**
   * 获取详细健康状态
   */
  async getHealthDetailed(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/health-detailed');
  }

  /**
   * 获取性能阈值配置
   */
  async getPerformanceThresholds(): Promise<PerformanceThresholds> {
    return this.get<PerformanceThresholds>('/thresholds');
  }

  /**
   * 获取HTTP请求性能统计
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.get<PerformanceMetrics>('/performance');
  }

  /**
   * 清理历史数据
   */
  async cleanupMetrics(days?: number): Promise<{ deleted_count: number; days_retained: number }> {
    return this.post<{ deleted_count: number; days_retained: number }>('/cleanup', { days });
  }
}

// 导出单例实例
export const performanceApi = new PerformanceApi();

// 为了向后兼容，导出函数
export const getSystemMetrics = () => performanceApi.getSystemMetrics();
export const getSystemMetricsHistory = (limit?: number) => performanceApi.getSystemMetricsHistory(limit);
export const getSlowQueries = (params?: { min_execution_time_ms?: number; limit?: number }) => performanceApi.getSlowQueries(params);
export const getQueryPerformanceStats = (params?: { database_name?: string; hours?: number }) => performanceApi.getQueryPerformanceStats(params);
export const getHealthDetailed = () => performanceApi.getHealthDetailed();
export const getPerformanceThresholds = () => performanceApi.getPerformanceThresholds();
export const getPerformanceMetrics = () => performanceApi.getPerformanceMetrics();
export const cleanupMetrics = (days?: number) => performanceApi.cleanupMetrics(days);

