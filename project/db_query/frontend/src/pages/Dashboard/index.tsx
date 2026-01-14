import { useState, useCallback } from "react";
import { Layout, Space, Typography, message } from "antd";
import { AddDatabaseForm } from "../../components/database";
import { Sidebar } from "./Sidebar";
import { DatabaseInfo } from "./DatabaseInfo";
import { QueryTabs } from "./QueryTabs";
import { useDatabases } from "./hooks/useDatabases";
import { useMetadata } from "./hooks/useMetadata";
import { useQueryExecution } from "./hooks/useQueryExecution";
import type { TableMetadata, ViewMetadata } from "../../types";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

/**
 * Dashboard main component.
 * Orchestrates database selection, query execution, and result display.
 */
export function Dashboard() {
  const { databases, refreshDatabases } = useDatabases();
  const {
    selectedDatabase,
    selectedDatabaseName,
    loading: metadataLoading,
    error: metadataError,
    selectDatabase,
    clearDatabase,
    deleteDatabase,
  } = useMetadata();
  const {
    sql,
    setSql,
    queryResult,
    loading: queryLoading,
    error: queryError,
    activeTab,
    setActiveTab,
    executeQuery,
    handleQueryGenerated,
    handleNaturalQueryExecuted,
    clearQuery,
  } = useQueryExecution();

  const [selectedTable, setSelectedTable] = useState<TableMetadata | ViewMetadata | null>(null);

  const handleSelectDatabase = async (name: string) => {
    setSelectedTable(null);
    clearQuery();
    await selectDatabase(name);
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteDatabase(name, selectedDatabaseName);
      // React Query automatically handles cache invalidation
    } catch {
      // Error already handled in the hook
    }
  };

  const handleExecuteQueryWrapper = async () => {
    if (!selectedDatabaseName) {
      message.warning("请选择一个数据库");
      return;
    }
    await executeQuery(selectedDatabaseName);
  };

  const handleTableSelect = useCallback((table: TableMetadata | ViewMetadata, generatedSql?: string) => {
    setSelectedTable(table);
    if (generatedSql) {
      setSql(generatedSql);
    }
  }, [setSql]);

  const handleCloseDatabase = () => {
    clearDatabase();
    setSelectedTable(null);
    clearQuery();
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #f0f0f0" }}
      >
        <Title level={3} style={{ margin: "16px 0" }}>
          数据库查询工具
        </Title>
      </Header>
      <Layout>
        <Sider
          width={300}
          style={{
            background: "#fff",
            borderRight: "1px solid #f0f0f0",
            height: "calc(100vh - 64px)",
            overflow: "hidden",
          }}
        >
          <Sidebar
            databases={databases}
            selectedDatabaseName={selectedDatabaseName}
            selectedDatabase={selectedDatabase}
            metadataLoading={metadataLoading}
            metadataError={metadataError}
            onSelectDatabase={handleSelectDatabase}
            onDeleteDatabase={handleDelete}
            onDatabaseUpdated={refreshDatabases}
            onTableSelect={handleTableSelect}
          />
        </Sider>
        <Content style={{ padding: "24px", background: "#f5f5f5" }}>
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={4}>SQL 查询</Title>
              <AddDatabaseForm onDatabaseCreated={refreshDatabases} />
            </div>

            {selectedDatabase && (
              <DatabaseInfo
                selectedDatabase={selectedDatabase}
                selectedTable={selectedTable}
                onClose={handleCloseDatabase}
              />
            )}

            {!selectedDatabase && (
              <div
                style={{
                  padding: "48px",
                  textAlign: "center",
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  border: "1px dashed #d9d9d9",
                }}
              >
                <p style={{ color: "#8c8c8c", fontSize: "16px" }}>从侧边栏选择一个数据库开始查询</p>
              </div>
            )}

            {selectedDatabase && (
              <QueryTabs
                databaseName={selectedDatabase.name}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sql={sql}
                setSql={setSql}
                queryResult={queryResult}
                queryLoading={queryLoading}
                queryError={queryError}
                onExecuteQuery={handleExecuteQueryWrapper}
                onQueryGenerated={handleQueryGenerated}
                onNaturalQueryExecuted={handleNaturalQueryExecuted}
              />
            )}
          </Space>
        </Content>
      </Layout>
    </Layout>
  );
}
