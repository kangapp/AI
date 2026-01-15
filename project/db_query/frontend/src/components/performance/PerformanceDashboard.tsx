/**
 * 性能监控仪表盘组件（简化版）
 * 在Dashboard中显示实时性能指标
 */

import { Card, Col, Row, Statistic, Typography, Space, Alert, Tag, Spin } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { usePerformanceDashboard as usePerformanceData } from '../../pages/Dashboard/hooks/usePerformance';

const { Title, Text } = Typography;

export function PerformanceDashboard() {
  const { data, isLoading, isError, error, refetch } = usePerformanceData();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>加载性能指标...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert
        message="加载失败"
        description={error?.message || '无法加载性能监控数据'}
        type="error"
        showIcon
        action={
          <a onClick={() => refetch()}>重试</a>
        }
      />
    );
  }

  const { systemMetrics, healthStatus, slowQueries, queryStats, thresholds } = data!;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* 头部状态栏 */}
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space>
            <DashboardOutlined style={{ fontSize: '20px' }} />
            <Title level={4} style={{ margin: 0 }}>
              性能监控
            </Title>
            {healthStatus && (
              <Tag
                color={
                  healthStatus.status === 'healthy'
                    ? 'success'
                    : healthStatus.status === 'warning'
                    ? 'warning'
                    : 'error'
                }
                icon={
                  healthStatus.status === 'healthy' ? (
                    <CheckCircleOutlined />
                  ) : healthStatus.status === 'warning' ? (
                    <WarningOutlined />
                  ) : (
                    <CloseCircleOutlined />
                  )
                }
              >
                {healthStatus.status === 'healthy'
                  ? '系统正常'
                  : healthStatus.status === 'warning'
                  ? '需要关注'
                  : '系统异常'}
              </Tag>
            )}
          </Space>
        </Col>
        <Col>
          <Text type="secondary">{new Date().toLocaleString('zh-CN')}</Text>
          <a
            onClick={() => refetch()}
            style={{ marginLeft: '16px' }}
          >
            刷新
          </a>
        </Col>
      </Row>

      {/* 系统资源指标 */}
      <Card title="系统资源" size="small">
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="CPU使用率"
              value={systemMetrics?.cpu.percent || 0}
              suffix="%"
              valueStyle={{
                color: (systemMetrics?.cpu.percent || 0) > 80 ? '#f5222d' : (systemMetrics?.cpu.percent || 0) > 60 ? '#faad14' : '#52c41a'
              }}
              precision={1}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="内存使用率"
              value={systemMetrics?.memory.percent || 0}
              suffix="%"
              valueStyle={{
                color: (systemMetrics?.memory.percent || 0) > 80 ? '#f5222d' : '#52c41a'
              }}
              precision={1}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {(systemMetrics?.memory.used_mb || 0).toFixed(0)} MB / {(systemMetrics?.memory.total_mb || 0).toFixed(0)} MB
            </Text>
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="磁盘使用率"
              value={systemMetrics?.disk.percent || 0}
              suffix="%"
              valueStyle={{
                color: (systemMetrics?.disk.percent || 0) > 90 ? '#f5222d' : '#52c41a'
              }}
              precision={1}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {(systemMetrics?.disk.used_gb || 0).toFixed(2)} GB / {(systemMetrics?.disk.total_gb || 0).toFixed(2)} GB
            </Text>
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="进程内存"
              value={systemMetrics?.process.memory_mb || 0}
              suffix="MB"
              valueStyle={{ color: '#1890ff' }}
              precision={1}
            />
          </Col>
        </Row>
      </Card>

      {/* 查询性能统计 */}
      {queryStats && (
        <Card title="查询性能统计" size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="总查询数"
                value={queryStats.totalQueries}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="成功率"
                value={queryStats.successRate}
                suffix="%"
                valueStyle={{
                  color: queryStats.successRate >= 95 ? '#52c41a' : queryStats.successRate >= 80 ? '#faad14' : '#f5222d'
                }}
                precision={1}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="平均执行时间"
                value={queryStats.avgExecutionTimeMs}
                suffix="ms"
                valueStyle={{
                  color: queryStats.avgExecutionTimeMs < 100 ? '#52c41a' : '#faad14'
                }}
                precision={1}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="慢查询数"
                value={queryStats.slowQueries}
                valueStyle={{
                  color: queryStats.slowQueries > 0 ? '#f5222d' : '#52c41a'
                }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 慢查询列表 */}
      <Card title="慢查询记录" size="small">
        {slowQueries && slowQueries.length > 0 ? (
          <div>
            {slowQueries.map((query, index) => (
              <div
                key={index}
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Space>
                    <Text strong>{query.executionTimeMs}ms</Text>
                    <Tag color={query.queryType === 'natural' ? 'blue' : 'green'}>
                      {query.queryType === 'natural' ? 'AI查询' : 'SQL'}
                    </Tag>
                    <Text type="secondary">{query.databaseName}</Text>
                  </Space>
                  <Text
                    ellipsis
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#8c8c8c',
                    }}
                  >
                    {query.sql}
                  </Text>
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: '#8c8c8c' }}>
            <CheckCircleOutlined style={{ fontSize: '32px', marginBottom: '8px', color: '#52c41a' }} />
            <div>暂无慢查询</div>
          </div>
        )}
      </Card>

      {/* 性能阈值说明 */}
      {thresholds && (
        <Card title="性能阈值配置" size="small">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Text strong>慢查询阈值：</Text>
              <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '12px' }}>
                <li>慢: ≥ {thresholds.slow_query.threshold_ms}ms</li>
                <li>很慢: ≥ {thresholds.slow_query.very_slow_threshold_ms}ms</li>
                <li>严重: ≥ {thresholds.slow_query.critical_threshold_ms}ms</li>
              </ul>
            </Col>
            <Col xs={24} sm={8}>
              <Text strong>请求阈值：</Text>
              <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '12px' }}>
                <li>快速: &lt; {thresholds.request.fast_threshold_ms}ms</li>
                <li>正常: &lt; {thresholds.request.normal_threshold_ms}ms</li>
                <li>慢: ≥ {thresholds.request.slow_threshold_ms}ms</li>
              </ul>
            </Col>
            <Col xs={24} sm={8}>
              <Text strong>内存告警：</Text>
              <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '12px' }}>
                <li>警告: ≥ {thresholds.memory.warning_threshold_percent}%</li>
                <li>危急: ≥ {thresholds.memory.critical_threshold_percent}%</li>
              </ul>
            </Col>
          </Row>
        </Card>
      )}
    </Space>
  );
}

export default PerformanceDashboard;
