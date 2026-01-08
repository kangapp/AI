import {
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  Spin,
  Tabs,
  message,
} from "antd";
import { ReloadOutlined, HistoryOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { DatabaseDetail } from "../../types";
import type { QueryResponse } from "../../services/api";
import { api } from "../../services/api";
import { TableList } from "../metadata";
import { SqlEditor, QueryResults, QueryHistory } from "../query";

interface DatabaseDetailProps {
  database: DatabaseDetail;
  onRefresh: () => void;
}

export function DatabaseDetailComponent({ database, onRefresh }: DatabaseDetailProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.getDatabase(database.name, true);
      onRefresh();
    } catch (error) {
      console.error("Failed to refresh metadata", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!sql.trim()) {
      message.warning("Please enter a SQL query");
      return;
    }

    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const result = await api.executeQuery(database.name, sql);
      setQueryResult(result);
      message.success(`Query returned ${result.rowCount} rows`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Query execution failed";
      setQueryError(errorMsg);
      message.error(errorMsg);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleSelectHistoryQuery = (querySql: string) => {
    setSql(querySql);
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Descriptions title={database.name} bordered column={2}>
        <Descriptions.Item label="Type">
          <Tag color="blue">{database.dbType}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Connection">
          <code>{database.url}</code>
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {new Date(database.createdAt).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="Last Connected">
          {database.lastConnectedAt
            ? new Date(database.lastConnectedAt).toLocaleString()
            : "Never"}
        </Descriptions.Item>
        <Descriptions.Item label="Tables" span={2}>
          {database.tables.length}
        </Descriptions.Item>
        <Descriptions.Item label="Views" span={2}>
          {database.views.length}
        </Descriptions.Item>
      </Descriptions>

      <Space>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={handleRefresh}
          loading={refreshing}
        >
          Refresh Metadata
        </Button>
        <Button
          icon={<HistoryOutlined />}
          onClick={() => setHistoryVisible(true)}
        >
          Query History
        </Button>
      </Space>

      <Tabs
        defaultActiveKey="query"
        items={[
          {
            key: "query",
            label: "SQL Query",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="large">
                <SqlEditor
                  value={sql}
                  onChange={setSql}
                  onExecute={handleExecuteQuery}
                  loading={queryLoading}
                  placeholder="Enter SELECT query here..."
                />
                <QueryResults
                  result={queryResult}
                  loading={queryLoading}
                  error={queryError}
                />
              </Space>
            ),
          },
          {
            key: "schema",
            label: "Schema",
            children: (
              <>
                <Divider orientation="left">Tables</Divider>
                {refreshing ? (
                  <Spin />
                ) : (
                  <TableList tables={database.tables} views={[]} />
                )}

                {database.views.length > 0 && (
                  <>
                    <Divider orientation="left">Views</Divider>
                    <TableList tables={[]} views={database.views} />
                  </>
                )}
              </>
            ),
          },
        ]}
      />

      <QueryHistory
        databaseName={database.name}
        onSelectQuery={handleSelectHistoryQuery}
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </Space>
  );
}
