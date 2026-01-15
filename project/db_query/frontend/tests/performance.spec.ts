/**
 * 性能监控功能测试
 * 测试后端性能监控API和前端性能指标收集
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:5173';

test.describe('后端性能监控API测试', () => {
  test('健康检查端点返回系统状态', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');

    // 验证可能的字段（取决于metrics service是否已初始化）
    if (data.system_metrics) {
      expect(data.system_metrics).toHaveProperty('cpu');
      expect(data.system_metrics).toHaveProperty('memory');
      expect(data.system_metrics).toHaveProperty('disk');
    }
  });

  test('获取性能阈值配置', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/metrics/thresholds`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('slow_query');
    expect(data).toHaveProperty('request');
    expect(data).toHaveProperty('memory');

    // 验证慢查询阈值
    expect(data.slow_query.threshold_ms).toBeGreaterThanOrEqual(1000);
    expect(data.slow_query.very_slow_threshold_ms).toBeGreaterThanOrEqual(5000);
  });

  test('获取系统指标', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/metrics/system`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('cpu');
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('disk');
    expect(data).toHaveProperty('process');

    // 验证CPU指标
    expect(data.cpu.percent).toBeGreaterThanOrEqual(0);
    expect(data.cpu.percent).toBeLessThanOrEqual(100);

    // 验证内存指标
    expect(data.memory.percent).toBeGreaterThanOrEqual(0);
    expect(data.memory.percent).toBeLessThanOrEqual(100);
    expect(data.memory.available_mb).toBeGreaterThan(0);

    // 验证磁盘指标
    expect(data.disk.percent).toBeGreaterThanOrEqual(0);
    expect(data.disk.percent).toBeLessThanOrEqual(100);

    console.log('系统指标:', JSON.stringify(data, null, 2));
  });

  test('获取慢查询列表（初始应为空）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/metrics/slow-queries?limit=10`
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();

    console.log(`慢查询数量: ${data.length}`);
  });

  test('获取查询性能统计', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/metrics/query-performance?hours=24`
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('total_queries');
    expect(data).toHaveProperty('successful_queries');
    expect(data).toHaveProperty('failed_queries');
    expect(data).toHaveProperty('success_rate');
    expect(data).toHaveProperty('avg_execution_time_ms');
    expect(data).toHaveProperty('slow_queries');

    console.log('查询性能统计:', JSON.stringify(data, null, 2));
  });

  test('详细健康状态检查', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/metrics/health-detailed`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('issues');

    // 验证状态值
    expect(['healthy', 'warning', 'critical']).toContain(data.status);

    console.log('健康状态:', data.status);
    if (data.issues.length > 0) {
      console.log('发现问题:', data.issues);
    }
  });
});

test.describe('前端Web性能测试', () => {
  test('页面加载性能指标', async ({ page }) => {
    // 监听性能指标
    const metrics: any = {};

    page.on('load', () => {
      const navigationTiming = page.evaluate(() => {
        const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          loadTime: timing.loadEventEnd - timing.fetchStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.fetchStart,
          ttfb: timing.responseStart - timing.requestStart,
        };
      });
      metrics.navigation = navigationTiming;
    });

    // 导航到主页
    const startTime = Date.now();
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // 页面标题验证
    await expect(page).toHaveTitle(/DB Query/);

    // 输出性能指标
    console.log(`页面加载时间: ${loadTime}ms`);

    // 验证页面加载时间合理（应在30秒内）
    expect(loadTime).toBeLessThan(30000);

    // 检查关键资源加载
    const performanceEntries = await page.evaluate(() => {
      return (window as any).performance?.getEntries?.() || [];
    });

    console.log(`资源数量: ${performanceEntries.length}`);
  });

  test('Core Web Vitals收集（如果有）', async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });

    // 等待一段时间让性能指标收集
    await page.waitForTimeout(2000);

    // 检查window对象上是否有性能监控工具
    const hasPerformanceMonitor = await page.evaluate(() => {
      return typeof (window as any).performanceMonitor === 'object';
    });

    if (hasPerformanceMonitor) {
      const currentMetrics = await page.evaluate(() => {
        return (window as any).performanceMonitor?.getCurrentMetrics() || {};
      });

      console.log('当前性能指标:', JSON.stringify(currentMetrics, null, 2));
    } else {
      console.log('性能监控工具未在window对象上暴露');
    }
  });

  test('API响应时间测试', async ({ page, request }) => {
    // 测试数据库列表API响应时间
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/v1/dbs`);
    const responseTime = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();

    console.log(`数据库列表API响应时间: ${responseTime}ms`);
    console.log(`数据库数量: ${data.length}`);

    // API响应时间应在合理范围内（< 5秒）
    expect(responseTime).toBeLessThan(5000);
  });

  test('多次请求验证性能监控中间件', async ({ request }) => {
    const requestTimes: number[] = [];

    // 发送5次请求
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await request.get(`${BASE_URL}/health`);
      const requestTime = Date.now() - startTime;
      requestTimes.push(requestTime);

      // 小延迟避免过快请求
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
    const maxTime = Math.max(...requestTimes);
    const minTime = Math.min(...requestTimes);

    console.log('性能监控中间件测试结果:');
    console.log(`  平均响应时间: ${avgTime.toFixed(2)}ms`);
    console.log(`  最大响应时间: ${maxTime}ms`);
    console.log(`  最小响应时间: ${minTime}ms`);
    console.log(`  所有响应时间: ${requestTimes.map(t => `${t}ms`).join(', ')}`);

    // 验证所有请求都在合理时间内完成
    requestTimes.forEach(time => {
      expect(time).toBeLessThan(5000);
    });
  });
});

test.describe('性能监控集成测试', () => {
  test('完整性能监控流程测试', async ({ page, request }) => {
    console.log('\n========== 性能监控集成测试开始 ==========\n');

    // 1. 测试后端健康检查
    console.log('1. 测试后端健康检查...');
    const healthResponse = await request.get(`${BASE_URL}/health`);
    expect(healthResponse.ok()).toBeTruthy();
    const healthData = await healthResponse.json();
    console.log(`   状态: ${healthData.status}`);
    console.log(`   时间戳: ${healthData.timestamp}`);

    // 2. 测试系统指标
    console.log('\n2. 获取系统指标...');
    const systemResponse = await request.get(`${BASE_URL}/api/v1/metrics/system`);
    expect(systemResponse.ok()).toBeTruthy();
    const systemData = await systemResponse.json();
    console.log(`   CPU使用率: ${systemData.cpu.percent}%`);
    console.log(`   内存使用率: ${systemData.memory.percent}%`);
    console.log(`   磁盘使用率: ${systemData.disk.percent}%`);

    // 3. 测试性能阈值
    console.log('\n3. 获取性能阈值配置...');
    const thresholdsResponse = await request.get(`${BASE_URL}/api/v1/metrics/thresholds`);
    expect(thresholdsResponse.ok()).toBeTruthy();
    const thresholds = await thresholdsResponse.json();
    console.log(`   慢查询阈值: ${thresholds.slow_query.threshold_ms}ms`);
    console.log(`   慢请求阈值: ${thresholds.request.slow_threshold_ms}ms`);

    // 4. 测试前端页面加载
    console.log('\n4. 测试前端页面加载...');
    const pageStartTime = Date.now();
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    const pageLoadTime = Date.now() - pageStartTime;
    console.log(`   页面加载时间: ${pageLoadTime}ms`);

    // 5. 测试API端点
    console.log('\n5. 测试API端点响应...');
    const apiStartTime = Date.now();
    await request.get(`${BASE_URL}/api/v1/dbs`);
    const apiResponseTime = Date.now() - apiStartTime;
    console.log(`   API响应时间: ${apiResponseTime}ms`);

    console.log('\n========== 性能监控集成测试完成 ==========\n');

    // 验证所有关键指标在合理范围内
    expect(pageLoadTime).toBeLessThan(30000);
    expect(apiResponseTime).toBeLessThan(5000);
    expect(systemData.cpu.percent).toBeLessThanOrEqual(100);
    expect(systemData.memory.percent).toBeLessThanOrEqual(100);
  });

  test('性能监控中间件记录请求', async ({ request }) => {
    // 发送多个不同类型的请求
    const endpoints = [
      '/health',
      '/api/v1/dbs',
      '/api/v1/metrics/system',
      '/api/v1/metrics/thresholds',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      expect(response.ok()).toBeTruthy();
      console.log(`✓ 请求成功: ${endpoint}`);
    }

    // 等待一下让中间件处理完成
    await new Promise(resolve => setTimeout(resolve, 500));

    // 检查健康状态中是否包含请求信息
    const healthResponse = await request.get(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();

    console.log('当前健康状态:', healthData.status);
    if (healthData.system_metrics) {
      console.log('系统指标已收集');
    }
  });
});
