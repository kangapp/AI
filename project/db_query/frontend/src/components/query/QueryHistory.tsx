/**
 * Query History component displaying past SQL queries.
 */

import { useEffect, useState } from "react";
import {
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Drawer,
  message,
  Tooltip,
} from "antd";
import {
  HistoryOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { QueryHistoryItem } from "../../services/api";
import { api } from "../../services/api";

const { Text } = Typography;

interface QueryHistoryProps {
  databaseName: string;
  onSelectQuery?: (sql: string) => void;
  visible: boolean;
  onClose: () => void;
}

export const QueryHistory: React.FC<QueryHistoryProps> = ({
  databaseName,
  onSelectQuery,
  visible,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedRecord, setSelectedRecord] = useState<QueryHistoryItem | null>(
    null
  );
  const [detailVisible, setDetailVisible] = useState(false);

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

  useEffect(() => {
    if (visible && databaseName) {
      fetchHistory(1, pagination.pageSize);
    }
  }, [visible, databaseName]);

  const handleTableChange = (newPagination: any) => {
    fetchHistory(newPagination.current, newPagination.pageSize);
  };

  const showDetail = (record: QueryHistoryItem) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleUseQuery = () => {
    if (selectedRecord && onSelectQuery) {
      onSelectQuery(selectedRecord.inputText);
      setDetailVisible(false);
      onClose();
      message.success("Query loaded into editor");
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

  const columns: ColumnsType<QueryHistoryItem> = [
    {
      title: "Time",
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
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: string) => {
        if (status === "success") {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Success
            </Tag>
          );
        }
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Error
          </Tag>
        );
      },
    },
    {
      title: "Query",
      dataIndex: "inputText",
      key: "inputText",
      ellipsis: true,
      render: (text: string) => (
        <Text
          ellipsis
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            maxWidth: "400px",
          }}
        >
          {text}
        </Text>
      ),
    },
    {
      title: "Rows",
      dataIndex: "rowCount",
      key: "rowCount",
      width: 80,
      render: (count: number | null) => (
        <Text>{count !== null ? count.toLocaleString() : "-"}</Text>
      ),
    },
    {
      title: "Duration",
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
      title: "Action",
      key: "action",
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <HistoryOutlined />
            Query History
          </Space>
        }
        width={900}
        onClose={onClose}
        open={visible}
      >
        <Table
          columns={columns}
          dataSource={history}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          size="small"
          scroll={{ y: "calc(100vh - 250px)" }}
        />
      </Drawer>

      <Drawer
        title="Query Details"
        width={700}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        extra={
          selectedRecord?.status === "success" && onSelectQuery ? (
            <Button type="primary" onClick={handleUseQuery}>
              Use This Query
            </Button>
          ) : null
        }
      >
        {selectedRecord && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong>Status: </Text>
              {selectedRecord.status === "success" ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  Success
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  Error
                </Tag>
              )}
            </div>

            <div>
              <Text strong>Executed at: </Text>
              <Text>{formatDateTime(selectedRecord.createdAt)}</Text>
            </div>

            {selectedRecord.status === "success" && (
              <>
                <div>
                  <Text strong>Rows returned: </Text>
                  <Text>
                    {selectedRecord.rowCount?.toLocaleString() || "-"}
                  </Text>
                </div>
                <div>
                  <Text strong>Execution time: </Text>
                  <Text>{formatDuration(selectedRecord.executionTimeMs)}</Text>
                </div>
              </>
            )}

            <div>
              <Text strong>Input SQL:</Text>
              <div
                style={{
                  marginTop: "8px",
                  padding: "12px",
                  backgroundColor: "#f6f6f6",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {selectedRecord.inputText}
              </div>
            </div>

            <div>
              <Text strong>Executed SQL:</Text>
              <div
                style={{
                  marginTop: "8px",
                  padding: "12px",
                  backgroundColor: "#f6f6f6",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {selectedRecord.executedSql}
              </div>
            </div>

            {selectedRecord.errorMessage && (
              <div>
                <Text strong>Error Message:</Text>
                <div
                  style={{
                    marginTop: "8px",
                    padding: "12px",
                    backgroundColor: "#fff2f0",
                    border: "1px solid #ffccc7",
                    borderRadius: "4px",
                    color: "#cf1322",
                  }}
                >
                  {selectedRecord.errorMessage}
                </div>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </>
  );
};
