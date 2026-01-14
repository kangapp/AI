/**
 * Query Results component displaying SQL query results in a table.
 */

import {
  Button,
  Dropdown,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Descriptions,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  TableOutlined,
  DatabaseOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { QueryResponse, ColumnMetadata } from "../../services/api";
import { api } from "../../services/api";

const { Text } = Typography;

interface QueryResultsProps {
  result: QueryResponse | null;
  loading?: boolean;
  error?: string | null;
  databaseName?: string;
  currentSql?: string;
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
  databaseName = "",
  currentSql = "",
}) => {
  // Export handler
  const handleExport = async (format: "csv" | "json") => {
    if (!databaseName || !currentSql) {
      message.error("缺少数据库或查询信息，无法导出");
      return;
    }

    try {
      await api.exportQueryResults(databaseName, currentSql, format);
      message.success(`已导出为 ${format.toUpperCase()}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "导出失败");
    }
  };

  // Export menu items
  const exportMenuItems: MenuProps["items"] = [
    {
      key: "csv",
      label: "导出为 CSV",
      onClick: () => handleExport("csv"),
    },
    {
      key: "json",
      label: "导出为 JSON",
      onClick: () => handleExport("json"),
    },
  ];
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
        showIcon
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

  // Helper function to get color based on data type
  const getColumnTypeColor = (dataType: string): string => {
    const type = dataType.toLowerCase();
    if (type.includes("int") || type.includes("number") || type.includes("serial")) {
      return "blue";
    }
    if (type.includes("char") || type.includes("text") || type.includes("string")) {
      return "green";
    }
    if (type.includes("date") || type.includes("time")) {
      return "orange";
    }
    if (type.includes("bool")) {
      return "purple";
    }
    if (type.includes("decimal") || type.includes("float") || type.includes("double")) {
      return "cyan";
    }
    return "default";
  };

  // Helper function to shorten data type display
  const shortenDataType = (dataType: string): string => {
    const type = dataType.toUpperCase();
    if (type.includes("VARCHAR")) return "VARCHAR";
    if (type.includes("INTEGER")) return "INT";
    if (type.includes("BIGINT")) return "BIGINT";
    if (type.includes("SMALLINT")) return "SMALLINT";
    if (type.includes("BOOLEAN")) return "BOOL";
    if (type.includes("DECIMAL")) return "DECIMAL";
    if (type.includes("DATETIME")) return "DATETIME";
    if (type.includes("TIMESTAMP")) return "TIMESTAMP";
    if (type.length > 10) return type.substring(0, 10) + "...";
    return type;
  };

  // Build table columns from query result
  const columns: ColumnsType<Record<string, unknown>> = result.columns.map(
    (col: ColumnMetadata) => ({
      title: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Text strong style={{ fontSize: "13px", color: "#262626" }}>
            {col.name}
          </Text>
          <Tag
            color={getColumnTypeColor(col.dataType)}
            style={{
              fontSize: "10px",
              margin: 0,
              padding: "0 4px",
              height: "18px",
              lineHeight: "18px",
              borderRadius: "2px",
            }}
          >
            {shortenDataType(col.dataType)}
          </Tag>
        </div>
      ),
      dataIndex: col.name,
      key: col.name,
      width: 150,
      ellipsis: true,
      render: (value: unknown) => {
        if (value === null) {
          return <Text type="secondary" style={{ fontSize: "13px" }}>NULL</Text>;
        }
        if (typeof value === "object") {
          return <Text type="secondary" style={{ fontSize: "13px" }}>{JSON.stringify(value)}</Text>;
        }
        return <Text style={{ fontSize: "13px" }}>{String(value)}</Text>;
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
            padding: "14px 18px",
            backgroundColor: "#f6ffed",
            border: "1px solid #b7eb8f",
            borderRadius: "8px",
          }}
        >
          <Space size="large">
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a", fontSize: "16px" }} />
              <Text strong style={{ fontSize: "14px", color: "#262626" }}>成功</Text>
            </Space>
            <Space size="small">
              <DatabaseOutlined style={{ color: "#8c8c8c", fontSize: "13px" }} />
              <Text type="secondary" style={{ fontSize: "13px" }}>
                返回 {result.rowCount} 行
              </Text>
            </Space>
            <Space size="small">
              <ClockCircleOutlined style={{ color: "#8c8c8c", fontSize: "13px" }} />
              <Text type="secondary" style={{ fontSize: "13px" }}>{result.executionTimeMs}ms</Text>
            </Space>
          </Space>
          <Space size="small">
            {result.hasLimit && (
              <Tag
                color="blue"
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                LIMIT {result.limitValue || "default (1000)"}
              </Tag>
            )}
            <Dropdown menu={{ items: exportMenuItems }} trigger={["click"]}>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                style={{ borderRadius: "4px" }}
              >
                导出
              </Button>
            </Dropdown>
          </Space>
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
        rowKey={(record) => JSON.stringify(record)}
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          overflow: "hidden",
        }}
        className="query-results-table"
      />
    </div>
  );
};
