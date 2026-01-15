/**
 * Web性能监控工具
 * 使用web-vitals库收集核心Web指标
 */

// 定义性能指标类型
export interface WebVitalsMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint - 最大内容绘制
  fid?: number; // First Input Delay - 首次输入延迟
  cls?: number; // Cumulative Layout Shift - 累积布局偏移
  fcp?: number; // First Contentful Paint - 首次内容绘制
  ttfb?: number; // Time to First Byte - 首字节时间

  // Additional metrics
  loadTime?: number; // 页面加载总时间
  domContentLoaded?: number; // DOM内容加载完成时间
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

// 性能评级
export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

// 性能阈值配置
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 }, // ms
  fid: { good: 100, poor: 300 }, // ms
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 }, // ms
  ttfb: { good: 800, poor: 1800 }, // ms
};

// 评估性能等级
function getRating(value: number, metric: keyof typeof THRESHOLDS): PerformanceRating {
  const threshold = THRESHOLDS[metric];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// 动态导入web-vitals（支持按需加载）
let webVitals: typeof import('web-vitals') | null = null;

async function loadWebVitals() {
  if (webVitals) return webVitals;
  try {
    webVitals = await import('web-vitals');
    return webVitals;
  } catch (error) {
    console.warn('Failed to load web-vitals:', error);
    return null;
  }
}

// 存储性能指标
let storedMetrics: WebVitalsMetrics = {};
let metricsCallbacks: Set<(metrics: WebVitalsMetrics) => void> = new Set();

/**
 * 注册性能指标回调函数
 */
export function onMetricsUpdate(callback: (metrics: WebVitalsMetrics) => void): () => void {
  metricsCallbacks.add(callback);

  // 如果已有指标，立即触发回调
  if (Object.keys(storedMetrics).length > 0) {
    callback(storedMetrics);
  }

  // 返回取消注册函数
  return () => {
    metricsCallbacks.delete(callback);
  };
}

/**
 * 通知所有回调函数
 */
function notifyCallbacks(metrics: WebVitalsMetrics) {
  metricsCallbacks.forEach(callback => {
    try {
      callback(metrics);
    } catch (error) {
      console.error('Error in metrics callback:', error);
    }
  });
}

/**
 * 更新性能指标
 */
function updateMetrics(newMetrics: Partial<WebVitalsMetrics>) {
  storedMetrics = { ...storedMetrics, ...newMetrics };
  notifyCallbacks(storedMetrics);
}

/**
 * 收集导航时序指标
 */
function collectNavigationTimings(): void {
  if (typeof window === 'undefined' || !window.performance) return;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (navigation) {
    updateMetrics({
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      ttfb: navigation.responseStart - navigation.requestStart,
    });
  }
}

/**
 * 收集内存使用情况
 */
function collectMemoryMetrics(): void {
  if (typeof window === 'undefined' || !(performance as any).memory) return;

  const memory = (performance as any).memory;
  updateMetrics({
    memory: {
      usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
    },
  });
}

/**
 * 获取当前性能指标
 */
export function getCurrentMetrics(): WebVitalsMetrics {
  return { ...storedMetrics };
}

/**
 * 计算性能评分
 */
export function getPerformanceScore(metrics: WebVitalsMetrics): number {
  if (!metrics) return 0;

  let score = 0;
  let count = 0;

  const metricsToScore: Array<{ value: number | undefined; metric: keyof typeof THRESHOLDS }> = [
    { value: metrics.lcp, metric: 'lcp' },
    { value: metrics.fid, metric: 'fid' },
    { value: metrics.cls, metric: 'cls' },
    { value: metrics.fcp, metric: 'fcp' },
    { value: metrics.ttfb, metric: 'ttfb' },
  ];

  metricsToScore.forEach(({ value, metric }) => {
    if (value !== undefined) {
      const rating = getRating(value, metric);
      if (rating === 'good') score += 100;
      else if (rating === 'needs-improvement') score += 50;
      else score += 0;
      count++;
    }
  });

  return count > 0 ? Math.round(score / count) : 0;
}

/**
 * 获取性能等级描述
 */
export function getPerformanceLabel(score: number): string {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '较差';
}

/**
 * 获取性能颜色
 */
export function getPerformanceColor(score: number): string {
  if (score >= 80) return '#52c41a'; // green
  if (score >= 60) return '#faad14'; // orange
  if (score >= 40) return '#fa8c16'; // dark orange
  return '#f5222d'; // red
}

/**
 * 格式化性能指标值
 */
export function formatMetricValue(value: number, metric: keyof typeof THRESHOLDS): string {
  if (metric === 'cls') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

/**
 * 获取性能指标评级
 */
export function getMetricRating(value: number, metric: keyof typeof THRESHOLDS): PerformanceRating {
  return getRating(value, metric);
}

/**
 * 上报性能指标到服务器（可选）
 */
async function reportMetricsToServer(metrics: WebVitalsMetrics) {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl) return;

  try {
    await fetch(`${apiUrl}/api/v1/web-vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics,
      }),
      // 使用 keepalive 确保页面卸载时也能发送
      keepalive: true,
    });
  } catch (error) {
    console.error('Failed to report metrics:', error);
  }
}

/**
 * 初始化性能监控
 */
export async function initPerformanceMonitoring(options: {
  reportToServer?: boolean;
  collectNavigation?: boolean;
  collectMemory?: boolean;
} = {}): Promise<void> {
  const {
    reportToServer = false,
    collectNavigation = true,
    collectMemory = true,
  } = options;

  // 收集导航时序指标
  if (collectNavigation) {
    // 等待页面加载完成
    if (document.readyState === 'complete') {
      collectNavigationTimings();
    } else {
      window.addEventListener('load', collectNavigationTimings);
    }
  }

  // 收集内存指标
  if (collectMemory) {
    // 定期收集内存指标
    const memoryInterval = setInterval(() => {
      collectMemoryMetrics();
    }, 5000); // 每5秒收集一次

    // 清理定时器
    window.addEventListener('beforeunload', () => {
      clearInterval(memoryInterval);
    });
  }

  // 加载web-vitals并收集核心指标
  const vitals = await loadWebVitals();
  if (!vitals) {
    console.warn('Web vitals monitoring not available');
    return;
  }

  // 收集LCP (Largest Contentful Paint)
  vitals.onLCP((metric) => {
    updateMetrics({ lcp: metric.value });
    console.log(`LCP: ${metric.value}ms [${getRating(metric.value, 'lcp')}]`);
  });

  // 收集FID (First Input Delay)
  vitals.onFID((metric) => {
    updateMetrics({ fid: metric.value });
    console.log(`FID: ${metric.value}ms [${getRating(metric.value, 'fid')}]`);
  });

  // 收集CLS (Cumulative Layout Shift)
  vitals.onCLS((metric) => {
    updateMetrics({ cls: metric.value });
    console.log(`CLS: ${metric.value} [${getRating(metric.value, 'cls')}]`);
  });

  // 收集FCP (First Contentful Paint)
  vitals.onFCP((metric) => {
    updateMetrics({ fcp: metric.value });
    console.log(`FCP: ${metric.value}ms [${getRating(metric.value, 'fcp')}]`);
  });

  // 收集TTFB (Time to First Byte)
  vitals.onTTFB((metric) => {
    updateMetrics({ ttfb: metric.value });
    console.log(`TTFB: ${metric.value}ms [${getRating(metric.value, 'ttfb')}]`);
  });

  // 如果需要，上报到服务器
  if (reportToServer) {
    onMetricsUpdate((metrics) => {
      reportMetricsToServer(metrics);
    });
  }

  console.log('Performance monitoring initialized');
}

/**
 * 创建性能监控Hook的工具函数
 */
export function createPerformanceMonitor() {
  return {
    init: initPerformanceMonitoring,
    getCurrentMetrics,
    getPerformanceScore,
    getPerformanceLabel,
    getPerformanceColor,
    formatMetricValue,
    getMetricRating,
    onMetricsUpdate,
  };
}

// 导出默认实例
export const performanceMonitor = createPerformanceMonitor();
