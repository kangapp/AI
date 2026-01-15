import { Tabs } from "antd";
import { ColumnHeightOutlined, ThunderboltOutlined, HistoryOutlined, LineChartOutlined } from "@ant-design/icons";
import { SqlEditor, QueryResults, NaturalQueryInput, QueryHistoryTab } from "../../components/query";
import { PerformanceDashboard } from "../../components/performance/PerformanceDashboard";
import type { QueryResponse } from "../../services/api";

interface QueryTabsProps {
  databaseName: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sql: string;
  setSql: (sql: string) => void;
  queryResult: QueryResponse | null;
  queryLoading: boolean;
  queryError: string | null;
  onExecuteQuery: () => void;
  onQueryGenerated: (sql: string) => void;
  onNaturalQueryExecuted: (response: import("../../services/api").NaturalQueryResponse) => void;
}

/**
 * QueryTabs component managing SQL, AI Query, and History tabs.
 */
export function QueryTabs({
  databaseName,
  activeTab,
  setActiveTab,
  sql,
  setSql,
  queryResult,
  queryLoading,
  queryError,
  onExecuteQuery,
  onQueryGenerated,
  onNaturalQueryExecuted,
}: QueryTabsProps) {
  const handleSelectHistoryQuery = (historySql: string) => {
    setSql(historySql);
    setActiveTab("sql");
  };

  const handleReExecuteQuery = async (historySql: string) => {
    setSql(historySql);
    setActiveTab("sql");
    await onExecuteQuery();
  };

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={[
        {
          key: "sql",
          label: (
            <span>
              <ColumnHeightOutlined />
              SQL 查询
            </span>
          ),
          children: (
            <>
              <SqlEditor
                value={sql}
                onChange={setSql}
                onExecute={onExecuteQuery}
                loading={queryLoading}
                placeholder="在此输入 SELECT 查询..."
              />
              <QueryResults result={queryResult} loading={queryLoading} error={queryError} />
            </>
          ),
        },
        {
          key: "natural",
          label: (
            <span>
              <ThunderboltOutlined />
              AI 查询
            </span>
          ),
          children: (
            <NaturalQueryInput
              databaseName={databaseName}
              onQueryGenerated={onQueryGenerated}
              onQueryExecuted={onNaturalQueryExecuted}
              disabled={queryLoading}
            />
          ),
        },
        {
          key: "history",
          label: (
            <span>
              <HistoryOutlined />
              历史记录
            </span>
          ),
          children: (
            <QueryHistoryTab
              databaseName={databaseName}
              onSelectQuery={handleSelectHistoryQuery}
              onReExecuteQuery={handleReExecuteQuery}
            />
          ),
        },
        {
          key: "performance",
          label: (
            <span>
              <LineChartOutlined />
              性能监控
            </span>
          ),
          children: <PerformanceDashboard />,
        },
      ]}
    />
  );
}
