import { useState, useEffect } from "react";
import { Layout, Typography, Space, Button, message, Spin, Menu, Tree, Alert, Tabs } from "antd";
import { ArrowLeftOutlined, TableOutlined, ColumnHeightOutlined, DatabaseOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import type { DatabaseDetail, TableMetadata, ColumnMetadata, ViewMetadata } from "../types";
import { api } from "../services/api";
import { SqlEditor, QueryResults, QueryHistory } from "../components/query";
import { NaturalQueryInput } from "../components/query/NaturalQueryInput";
import type { QueryResponse, NaturalQueryResponse } from "../services/api";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

interface DataNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: DataNode[];
}

export function DatabasePage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [database, setDatabase] = useState<DatabaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableMetadata | ViewMetadata | null>(null);
  const [activeTab, setActiveTab] = useState("sql");

  const loadDatabase = async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const db = await api.getDatabase(name);
      setDatabase(db);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load database";
      setError(errorMsg);
      message.error(errorMsg);
      // Don't navigate away, show error on page
    } finally {
      setLoading(false);
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
      const result = await api.executeQuery(name!, sql);
      setQueryResult(result);
      message.success(`Query returned ${result.rowCount} rows in ${result.executionTimeMs}ms`);
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
    setActiveTab("sql");
  };

  const handleQueryGenerated = (generatedSql: string) => {
    setSql(generatedSql);
    setActiveTab("sql");
  };

  const handleNaturalQueryExecuted = (response: NaturalQueryResponse) => {
    if (response.explanation) {
      message.success(response.explanation);
    }
  };

  // Build tree data from metadata
  const buildTreeData = (): DataNode[] => {
    if (!database) return [];

    const nodes: DataNode[] = [];

    // Tables
    if (database.tables.length > 0) {
      const tableNodes: DataNode[] = database.tables.map((table) => ({
        title: table.name,
        key: `table-${table.name}`,
        icon: <TableOutlined />,
        children: table.columns.map((col) => ({
          title: `${col.name}: ${col.dataType}`,
          key: `table-${table.name}-col-${col.name}`,
          icon: <ColumnHeightOutlined />,
        })),
      }));
      nodes.push({
        title: `Tables (${database.tables.length})`,
        key: "tables",
        icon: <DatabaseOutlined />,
        children: tableNodes,
      });
    }

    // Views
    if (database.views.length > 0) {
      const viewNodes: DataNode[] = database.views.map((view) => ({
        title: view.name,
        key: `view-${view.name}`,
        icon: <TableOutlined />,
        children: view.columns.map((col) => ({
          title: `${col.name}: ${col.dataType}`,
          key: `view-${view.name}-col-${col.name}`,
          icon: <ColumnHeightOutlined />,
        })),
      }));
      nodes.push({
        title: `Views (${database.views.length})`,
        key: "views",
        icon: <DatabaseOutlined />,
        children: viewNodes,
      });
    }

    return nodes;
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0];
    if (!key || !database) return;

    // Find the selected table or view
    const allObjects = [...database.tables, ...database.views];
    for (const obj of allObjects) {
      if (key === `table-${obj.name}` || key === `view-${obj.name}`) {
        setSelectedTable(obj);
        break;
      }
    }
  };

  useEffect(() => {
    loadDatabase();
  }, [name]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute query
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (sql.trim() && !queryLoading) {
          handleExecuteQuery();
        }
      }

      // Ctrl/Cmd + Shift + N to switch to natural language tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setActiveTab("natural");
      }

      // Ctrl/Cmd + Shift + S to switch to SQL tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setActiveTab("sql");
      }

      // Ctrl/Cmd + H to toggle history
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setHistoryVisible(!historyVisible);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [sql, queryLoading, historyVisible, activeTab]);

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Content style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!database) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #f0f0f0" }}>
          <Space style={{ margin: "16px 0" }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
              Back
            </Button>
            <Title level={4} style={{ margin: 0 }}>Database</Title>
          </Space>
        </Header>
        <Content style={{ padding: "24px" }}>
          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              showIcon
              closable
            />
          )}
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #f0f0f0" }}>
        <Space style={{ margin: "16px 0" }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
            Back
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {database.name}
          </Title>
        </Space>
      </Header>
      <Layout>
        <Sider width={280} style={{ background: "#fff", borderRight: "1px solid #f0f0f0", height: "calc(100vh - 64px)", overflow: "auto" }}>
          <div style={{ padding: "16px" }}>
            <div style={{ marginBottom: "16px" }}>
              <strong>Schema Explorer</strong>
            </div>
            <Tree
              showIcon
              defaultExpandAll
              treeData={buildTreeData()}
              onSelect={handleTreeSelect}
              style={{ fontSize: "13px" }}
            />
          </div>
        </Sider>
        <Content style={{ padding: "24px", background: "#f5f5f5" }}>
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            {error && (
              <Alert
                message="Error"
                description={error}
                type="error"
                showIcon
                closable
                onClose={() => setError(null)}
              />
            )}

            {selectedTable && (
              <Alert
                message={selectedTable.name}
                description={
                  <div>
                    <div>Type: <strong>{selectedTable.schema || "default"}</strong></div>
                    <div>Columns: {selectedTable.columns.length}</div>
                    {selectedTable.rowCountEstimate !== null && (
                      <div>Rows (est): {selectedTable.rowCountEstimate}</div>
                    )}
                    {selectedTable.description && <div>{selectedTable.description}</div>}
                  </div>
                }
                type="info"
                showIcon
                closable
                onClose={() => setSelectedTable(null)}
              />
            )}

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "sql",
                  label: (
                    <span>
                      <ColumnHeightOutlined />
                      SQL Editor
                    </span>
                  ),
                  children: (
                    <SqlEditor
                      value={sql}
                      onChange={setSql}
                      onExecute={handleExecuteQuery}
                      loading={queryLoading}
                      placeholder="Enter SELECT query here..."
                    />
                  ),
                },
                {
                  key: "natural",
                  label: (
                    <span>
                      <ThunderboltOutlined />
                      AI Query
                    </span>
                  ),
                  children: (
                    <NaturalQueryInput
                      databaseName={database.name}
                      onQueryGenerated={handleQueryGenerated}
                      onQueryExecuted={handleNaturalQueryExecuted}
                      disabled={queryLoading}
                    />
                  ),
                },
              ]}
            />

            <QueryResults
              result={queryResult}
              loading={queryLoading}
              error={queryError}
              databaseName={database.name}
              currentSql={sql}
            />
          </Space>
        </Content>
      </Layout>

      <QueryHistory
        databaseName={database.name}
        onSelectQuery={handleSelectHistoryQuery}
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </Layout>
  );
}
