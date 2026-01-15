/**
 * 性能监控仪表板组件
 * 展示系统性能指标和Web Vitals
 */

import { useEffect, useState } from 'react';
import { Card, Col, Progress, Row, Statistic, Tag, Typography, Alert, Space, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  MemoryOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import type { WebVitalsMetrics } from '../../utils/performance';
import {
  performanceMonitor,
  getPerformanceScore,
  getPerformanceLabel,
  getPerformanceColor,
  formatMetricValue,
  getMetricRating,
} from '../../utils/performance';

const { Title, Text } = Typography;

interface MetricCardProps {
  title: string;
  value: number | undefined;
  unit: string;
  threshold?: { good: number; poor: number };
  icon?: React.ReactNode;
  tooltip?: string;
}

// 性能指标卡片
function MetricCard({ title, value, unit, threshold, icon, tooltip }: MetricCardProps) {
  if (value === undefined) return null;

  let rating: 'good' | 'needs-improvement' | 'poor' = 'good';
  if (threshold) {
    if (value <= threshold.good) rating = 'good';
    else if (value <= threshold.poor) rating = 'needs-improvement';
    else rating = 'poor';
  }

  const ratingConfig = {
    good: { color: '#52c41a', icon: <CheckCircleOutlined />, text: '良好' },
    'needs-improvement': { color: '#faad14', icon: <WarningOutlined />, text: '需改进' },
    poor: { color: '#f5222d', icon: <CloseCircleOutlined />, text: '较差' },
  };

  const config = ratingConfig[rating];

  const content = (
    <Card
      size="small"
      style={{ height: '100%' }}
      styles={{
        body: { padding: '16px' },
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Space>
          {icon}
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {title}
          </Text>
        </Space>
        <Row align="middle" gutter={8}>
          <Col>
            <Title level={3} style={{ margin: 0, color: config.color }}>
              {unit === '%' ? value : formatMetricValue(value, title.toLowerCase() as any)}
            </Title>
          </Col>
          {unit && unit !== '%' && (
            <Col>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {unit}
              </Text>
            </Col>
          )}
        </Row>
        <Tag color={config.color} icon={config.icon} style={{ margin: 0 }}>
          {config.text}
        </Tag>
      </Space>
    </Card>
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{content}</Tooltip>;
  }

  return content;
}

interface PerformanceData {
  metrics: WebVitalsMetrics;
  score: number;
  systemMetrics?: {
    cpu: { percent: number };
    memory: { percent: number; available_mb: number };
    disk: { percent: number };
  };
}

export function PerformanceMonitor() {
  const [data, setData] = useState<PerformanceData>({
    metrics: {},
    score: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 初始化性能监控
    const init = async () => {
      await performanceMonitor.init({
        reportToServer: false,
        collectNavigation: true,
        collectMemory: true,
      });
    };

    init();

    // 监听指标更新
    const unsubscribe = performanceMonitor.onMetricsUpdate((metrics) => {
      if (!mounted) return;

      const score = getPerformanceScore(metrics);
      setData({ metrics, score });
      setLoading(false);
    });

    // 获取系统指标
    const fetchSystemMetrics = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) return;

        const response = await fetch(`${apiUrl}/api/v1/metrics/system`);
        if (response.ok) {
          const systemMetrics = await response.json();
          setData((prev) => ({ ...prev, systemMetrics }));
        }
      } catch (error) {
        console.error('Failed to fetch system metrics:', error);
      }
    };

    fetchSystemMetrics();
    const interval = setInterval(fetchSystemMetrics, 30000); // 每30秒更新

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const performanceColor = getPerformanceColor(data.score);
  const performanceLabel = getPerformanceLabel(data.score);

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题和总分 */}
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <DashboardOutlined /> 性能监控
          </Title>
          <Text type="secondary">实时监控应用和系统性能指标</Text>
        </div>

        {/* 性能总分 */}
        <Card>
          <Row gutter={24} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Statistic
                title="性能评分"
                value={data.score}
                suffix="/ 100"
                valueStyle={{ color: performanceColor, fontSize: '48px', fontWeight: 'bold' }}
                prefix={<ThunderboltOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} md={16}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text strong>评级：</Text>
                  <Tag
                    color={performanceColor}
                    style={{ fontSize: '16px', padding: '4px 12px' }}
                  >
                    {performanceLabel}
                  </Tag>
                </div>
                <Progress
                  percent={data.score}
                  strokeColor={performanceColor}
                  status={data.score >= 80 ? 'success' : data.score >= 60 ? 'normal' : 'exception'}
                  showInfo={false}
                />
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Core Web Vitals */}
        <div>
          <Title level={4}>核心Web指标 (Core Web Vitals)</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="LCP"
                value={data.metrics.lcp}
                unit="ms"
                threshold={{ good: 2500, poor: 4000 }}
                icon={<ClockCircleOutlined />}
                tooltip="Largest Contentful Paint - 最大内容绘制时间，衡量页面主要内容加载速度"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="FID"
                value={data.metrics.fid}
                unit="ms"
                threshold={{ good: 100, poor: 300 }}
                icon={<ThunderboltOutlined />}
                tooltip="First Input Delay - 首次输入延迟，衡量页面交互响应速度"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="CLS"
                value={data.metrics.cls}
                unit=""
                threshold={{ good: 0.1, poor: 0.25 }}
                icon={<DashboardOutlined />}
                tooltip="Cumulative Layout Shift - 累积布局偏移，衡量页面视觉稳定性"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="FCP"
                value={data.metrics.fcp}
                unit="ms"
                threshold={{ good: 1800, poor: 3000 }}
                icon={<ClockCircleOutlined />}
                tooltip="First Contentful Paint - 首次内容绘制时间"
              />
            </Col>
          </Row>
        </div>

        {/* 其他性能指标 */}
        <div>
          <Title level={4}>其他性能指标</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="TTFB"
                value={data.metrics.ttfb}
                unit="ms"
                threshold={{ good: 800, poor: 1800 }}
                icon={<ClockCircleOutlined />}
                tooltip="Time to First Byte - 首字节时间，衡量服务器响应速度"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="页面加载时间"
                value={data.metrics.loadTime}
                unit="ms"
                threshold={{ good: 2000, poor: 4000 }}
                icon={<ClockCircleOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <MetricCard
                title="DOM加载完成"
                value={data.metrics.domContentLoaded}
                unit="ms"
                threshold={{ good: 1500, poor: 3000 }}
                icon={<DashboardOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              {data.metrics.memory && (
                <Card size="small" style={{ height: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <Space>
                      <MemoryOutlined />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        内存使用
                      </Text>
                    </Space>
                    <Title level={3} style={{ margin: 0 }}>
                      {data.metrics.memory.usedJSHeapSize} MB
                    </Title>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      总计: {data.metrics.memory.totalJSHeapSize} MB / 限制:{' '}
                      {data.metrics.memory.jsHeapSizeLimit} MB
                    </Text>
                  </Space>
                </Card>
              )}
            </Col>
          </Row>
        </div>

        {/* 系统指标 */}
        {data.systemMetrics && (
          <div>
            <Title level={4}>系统资源</Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="CPU使用率"
                    value={data.systemMetrics.cpu.percent}
                    suffix="%"
                    valueStyle={{
                      color: data.systemMetrics.cpu.percent > 80 ? '#f5222d' : '#3f8600',
                    }}
                  />
                  <Progress
                    percent={Math.round(data.systemMetrics.cpu.percent)}
                    status={data.systemMetrics.cpu.percent > 80 ? 'exception' : 'normal'}
                    showInfo={false}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="内存使用率"
                    value={data.systemMetrics.memory.percent}
                    suffix="%"
                    valueStyle={{
                      color: data.systemMetrics.memory.percent > 80 ? '#f5222d' : '#3f8600',
                    }}
                  />
                  <Progress
                    percent={Math.round(data.systemMetrics.memory.percent)}
                    status={data.systemMetrics.memory.percent > 80 ? 'exception' : 'normal'}
                    showInfo={false}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    可用: {data.systemMetrics.memory.available_mb} MB
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small}>
                  <Statistic
                    title="磁盘使用率"
                    value={data.systemMetrics.disk.percent}
                    suffix="%"
                    valueStyle={{
                      color: data.systemMetrics.disk.percent > 90 ? '#f5222d' : '#3f8600',
                    }}
                  />
                  <Progress
                    percent={Math.round(data.systemMetrics.disk.percent)}
                    status={data.systemMetrics.disk.percent > 90 ? 'exception' : 'normal'}
                    showInfo={false}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}

        {/* 说明 */}
        <Alert
          message="性能指标说明"
          description={
            <Space direction="vertical" size="small">
              <div>
                <Text strong>LCP (最大内容绘制):</Text> 衡量页面主要内容加载完成的时间，建议{' '}
                <Text type="success">&lt;2.5秒</Text>
              </div>
              <div>
                <Text strong>FID (首次输入延迟):</Text> 衡量用户首次交互到页面响应的时间，建议{' '}
                <Text type="success">&lt;100毫秒</Text>
              </div>
              <div>
                <Text strong>CLS (累积布局偏移):</Text> 衡量页面布局稳定性，建议{' '}
                <Text type="success">&lt;0.1</Text>
              </div>
              <div>
                <Text strong>TTFB (首字节时间):</Text> 衡量服务器响应速度，建议{' '}
                <Text type="success">&lt;800毫秒</Text>
              </div>
            </Space>
          }
          type="info"
          showIcon
        />
      </Space>
    </div>
  );
}

export default PerformanceMonitor;
