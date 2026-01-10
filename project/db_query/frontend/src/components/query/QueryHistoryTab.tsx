/**
 * Query History Tab component - displays query history within a tab.
 */

import { useEffect, useState } from "react";
import {
  Table,
  Tag,
  Space,
  Typography,
  Button,
  message,
  Tooltip,
  Card,
  Popconfirm,
  Select,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  HistoryOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { QueryHistoryItem } from "../../services/api";
import { api } from "../../services/api";

const { Text } = Typography;

interface QueryHistoryTabProps {
  databaseName: string;
  onSelectQuery?: (sql: string) => void;
  onReExecuteQuery?: (sql: string) => void;
}

export const QueryHistoryTab: React.FC<QueryHistoryTabProps> = ({
  databaseName,
  onSelectQuery,
  onReExecuteQuery,
}) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [queryTypeFilter, setQueryTypeFilter] = useState<string | undefined>(
    undefined
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [summary, setSummary] = useState<{
    total_count: number;
    recent_success_count: number;
    recent_error_count: number;
  } | null>(null);

  const fetchHistory = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await api.getQueryHistory(databaseName, page, pageSize);
      setHistory(response.items);
      setPagination({
        current: page,
        pageSize,
        total: response.totalCount,
      });
    } catch (error) {
      message.error(`Failed to load query history: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await api.getHistorySummary(databaseName);
      setSummary(data);
    } catch (error) {
      console.error("Failed to load history summary:", error);
    }
  };

  useEffect(() => {
    if (databaseName) {
      fetchHistory(1, 100); // Load up to 100 records by default
      fetchSummary();
    }
  }, [databaseName]);

  const handleTableChange = (newPagination: any) => {
    fetchHistory(newPagination.current, newPagination.pageSize);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteQueryHistory(databaseName, [id]);
      message.success("历史记录已删除");
      fetchHistory(pagination.current, pagination.pageSize);
      fetchSummary();
    } catch (error) {
      message.error(`删除失败: ${error}`);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择要删除的记录");
      return;
    }

    try {
      await api.deleteQueryHistory(
        databaseName,
        selectedRowKeys as number[]
      );
      message.success(`已删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      fetchHistory(pagination.current, pagination.pageSize);
      fetchSummary();
    } catch (error) {
      message.error(`删除失败: ${error}`);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.deleteQueryHistory(databaseName);
      message.success("所有历史记录已清空");
      fetchHistory(1, pagination.pageSize);
      fetchSummary();
    } catch (error) {
      message.error(`清空失败: ${error}`);
    }
  };

  const handleReExecute = (record: QueryHistoryItem) => {
    if (record.status === "success" && onReExecuteQuery) {
      onReExecuteQuery(record.executedSql);
      message.success("查询已加载，准备执行");
    }
  };

  const handleUseQuery = (record: QueryHistoryItem) => {
    if (onSelectQuery) {
      onSelectQuery(record.queryType === "natural" ? record.inputText : record.executedSql);
      message.success("查询已加载到编辑器");
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "-";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  // Filter history based on query type and status
  const filteredHistory = history.filter((item) => {
    if (queryTypeFilter && item.queryType !== queryTypeFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    return true;
  });

  const columns: ColumnsType<QueryHistoryItem> = [
    {
      title: "时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (dateStr: string) => (
        <Tooltip title={dateStr}>
          <Text style={{ fontSize: "12px" }}>{formatDateTime(dateStr)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "类型",
      dataIndex: "queryType",
      key: "queryType",
      width: 80,
      render: (type: string) => {
        if (type === "natural") {
          return (
            <Tag icon={<ThunderboltOutlined />} color="purple">
              AI
            </Tag>
          );
        }
        return (
          <Tag icon={<CodeOutlined />} color="blue">
            SQL
          </Tag>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (status: string) => {
        if (status === "success") {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              成功
            </Tag>
          );
        }
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
              失败
            </Tag>
        );
      },
    },
    {
      title: "查询内容",
      dataIndex: "inputText",
      key: "inputText",
      ellipsis: true,
      render: (text: string, record: QueryHistoryItem) => (
        <Tooltip title={text}>
          <Text
            ellipsis
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              maxWidth: "300px",
            }}
          >
            {record.queryType === "natural" ? `AI: ${text}` : text}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "行数",
      dataIndex: "rowCount",
      key: "rowCount",
      width: 70,
      render: (count: number | null) => (
        <Text>{count !== null ? count.toLocaleString() : "-"}</Text>
      ),
    },
    {
      title: "耗时",
      dataIndex: "executionTimeMs",
      key: "executionTimeMs",
      width: 90,
      render: (ms: number | null) => (
        <Space>
          <ClockCircleOutlined style={{ fontSize: "12px" }} />
          <Text>{formatDuration(ms)}</Text>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      fixed: "right" as const,
      render: (_, record) => (
        <Space size="small">
          {record.status === "success" && onSelectQuery && (
            <Button
              type="link"
              size="small"
              onClick={() => handleUseQuery(record)}
            >
              编辑
            </Button>
          )}
          {record.status === "success" && onReExecuteQuery && (
            <Button
              type="link"
              size="small"
              onClick={() => handleReExecute(record)}
            >
              运行
            </Button>
          )}
          <Popconfirm
            title="确定删除此记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      {/* Summary Cards */}
      {summary && (
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总查询数"
                value={summary.total_count}
                prefix={<HistoryOutlined />}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="成功（最近100条）"
                value={summary.recent_success_count}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="失败（最近100条）"
                value={summary.recent_error_count}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: "#ff4d4f" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Toolbar */}
      <Card size="small">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Text strong>筛选:</Text>
              <Select
                placeholder="查询类型"
                allowClear
                style={{ width: 120 }}
                value={queryTypeFilter}
                onChange={setQueryTypeFilter}
              >
                <Select.Option value="sql">SQL</Select.Option>
                <Select.Option value="natural">AI</Select.Option>
              </Select>
              <Select
                placeholder="状态"
                allowClear
                style={{ width: 100 }}
                value={statusFilter}
                onChange={setStatusFilter}
              >
                <Select.Option value="success">成功</Select.Option>
                <Select.Option value="error">失败</Select.Option>
              </Select>
            </Space>
          </Col>
          <Col>
            <Space>
              {selectedRowKeys.length > 0 && (
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                  onConfirm={handleBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />}>
                    批量删除
                  </Button>
                </Popconfirm>
              )}
              <Popconfirm
                title="确定清空所有历史记录吗？此操作无法撤销。"
                onConfirm={handleClearAll}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  清空全部
                </Button>
              </Popconfirm>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchHistory(pagination.current, pagination.pageSize)}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredHistory}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          total: filteredHistory.length,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        size="small"
        scroll={{ x: 1200, y: "calc(100vh - 450px)" }}
      />
    </Space>
  );
};
