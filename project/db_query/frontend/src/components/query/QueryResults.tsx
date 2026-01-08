/**
 * Query Results component displaying SQL query results in a table.
 */

import { Table, Tag, Space, Typography, Alert, Descriptions } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, TableOutlined } from "@ant-design/icons";
import type { QueryResponse, ColumnMetadata } from "../../services/api";

const { Text } = Typography;

interface QueryResultsProps {
  result: QueryResponse | null;
  loading?: boolean;
  error?: string | null;
}

// Parse error message to extract structured information
const parseError = (errorMessage: string) => {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(errorMessage);
    if (parsed.detail && typeof parsed.detail === "object") {
      return {
        code: parsed.detail.code || "UNKNOWN_ERROR",
        message: parsed.detail.message || errorMessage,
        details: parsed.detail.details,
      };
    }
  } catch {
    // Not JSON, try to extract error code
    const codeMatch = errorMessage.match(/Error Code:?\s*([A-Z_]+)/i);
    const code = codeMatch ? codeMatch[1] : "QUERY_ERROR";
    return {
      code,
      message: errorMessage,
    };
  }

  return { code: "UNKNOWN_ERROR", message: errorMessage };
};

const getErrorHelp = (code: string): string => {
  const helpMessages: Record<string, string> = {
    SQL_SYNTAX_ERROR: "请检查您的 SQL 语法是否有拼写错误或缺少关键字。",
    INVALID_STATEMENT_TYPE: "仅允许 SELECT 查询。不支持 INSERT、UPDATE、DELETE、DROP 等操作。",
    SQL_VALIDATION_ERROR: "无法验证 SQL 语句。",
    QUERY_EXECUTION_ERROR: "执行查询时发生错误。请检查表名和列名。",
    QUERY_TIMEOUT: "查询执行时间过长。请尝试添加 LIMIT 子句。",
  };
  return helpMessages[code] || "请检查您的查询并重试。";
};

export const QueryResults: React.FC<QueryResultsProps> = ({
  result,
  loading = false,
  error = null,
}) => {
  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <Space direction="vertical" align="center">
          <CheckCircleOutlined spin style={{ fontSize: "32px", color: "#1890ff" }} />
          <Text type="secondary">正在执行查询...</Text>
        </Space>
      </div>
    );
  }

  if (error) {
    const parsedError = parseError(error);
    const helpText = getErrorHelp(parsedError.code);

    return (
      <Alert
        message="查询执行失败"
        description={
          <div>
            <Descriptions
              column={1}
              size="small"
              bordered
              style={{ marginBottom: "12px" }}
            >
              <Descriptions.Item label="错误代码">
                <Tag color="red">{parsedError.code}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="错误消息">
                <Text type="danger" strong>{parsedError.message}</Text>
              </Descriptions.Item>
              {parsedError.details && (
                <Descriptions.Item label="详细信息">
                  <Text type="secondary">{parsedError.details}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Alert
              message="建议"
              description={helpText}
              type="info"
              showIcon
              style={{ marginTop: "8px" }}
            />
          </div>
        }
        type="error"
        showIcon={<CloseCircleOutlined />}
        style={{ margin: "16px 0" }}
      />
    );
  }

  if (!result) {
    return (
      <div
        style={{
          padding: "48px",
          textAlign: "center",
          backgroundColor: "#fafafa",
          borderRadius: "6px",
          border: "1px dashed #d9d9d9",
        }}
      >
        <Space direction="vertical" align="center">
          <TableOutlined style={{ fontSize: "32px", color: "#bfbfbf" }} />
          <Text type="secondary">执行查询以查看结果</Text>
        </Space>
      </div>
    );
  }

  // Build table columns from query result
  const columns: ColumnsType<Record<string, unknown>> = result.columns.map(
    (col: ColumnMetadata) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      width: 150,
      ellipsis: true,
      render: (value: unknown) => {
        if (value === null) {
          return <Text type="secondary">NULL</Text>;
        }
        if (typeof value === "object") {
          return <Text type="secondary">{JSON.stringify(value)}</Text>;
        }
        return String(value);
      },
    })
  );

  return (
    <div>
      <Space
        direction="vertical"
        size="middle"
        style={{ width: "100%", marginBottom: "16px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            backgroundColor: "#f6ffed",
            border: "1px solid #b7eb8f",
            borderRadius: "6px",
          }}
        >
          <Space size="large">
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text strong>成功</Text>
            </Space>
            <Text type="secondary">
              返回 {result.rowCount} 行
            </Text>
            <Space>
              <ClockCircleOutlined />
              <Text type="secondary">{result.executionTimeMs}ms</Text>
            </Space>
          </Space>
          {result.hasLimit && (
            <Tag color="blue">
              LIMIT {result.limitValue || "default (1000)"}
            </Tag>
          )}
        </div>
      </Space>

      <Table
        columns={columns}
        dataSource={result.rows}
        pagination={{
          pageSize: 50,
          showTotal: (total) => `共 ${total} 条`,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ["20", "50", "100", "200"],
        }}
        scroll={{ x: "max-content", y: 400 }}
        size="small"
        bordered
        rowKey={(record, index) => `${Object.values(record)[0]}-${index}`}
      />
    </div>
  );
};
