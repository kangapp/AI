import { useState, useEffect } from "react";
import { Layout, Typography, Space, Modal, message, Tree, Alert, Tabs } from "antd";
import { TableOutlined, ColumnHeightOutlined, DatabaseOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { DatabaseList, AddDatabaseForm } from "../components/database";
import { SqlEditor, QueryResults, NaturalQueryInput } from "../components/query";
import type { DatabaseConnection, DatabaseDetail, TableMetadata, ColumnMetadata, ViewMetadata } from "../types";
import { api } from "../services/api";
import type { QueryResponse, NaturalQueryResponse } from "../services/api";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

interface DataNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: DataNode[];
  className?: string;
  style?: React.CSSProperties;
}

export function Dashboard() {
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDatabaseName, setSelectedDatabaseName] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseDetail | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableMetadata | ViewMetadata | null>(null);
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sql");

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const response = await api.listDatabases();
      setDatabases(response.databases);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载数据库失败");
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseMetadata = async (name: string) => {
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const db = await api.getDatabase(name);
      setSelectedDatabase(db);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "加载数据库元数据失败";
      setMetadataError(errorMsg);
      message.error(errorMsg);
    } finally {
      setMetadataLoading(false);
    }
  };

  useEffect(() => {
    loadDatabases();
  }, []);

  const handleDelete = async (name: string) => {
    Modal.confirm({
      title: "删除数据库",
      content: `确定要删除 "${name}" 吗？`,
      okText: "删除",
      okType: "danger",
      onOk: async () => {
        try {
          await api.deleteDatabase(name);
          message.success("数据库删除成功");
          if (selectedDatabaseName === name) {
            setSelectedDatabaseName(null);
            setSelectedDatabase(null);
          }
          loadDatabases();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除数据库失败");
        }
      },
    });
  };

  const handleSelectDatabase = async (name: string) => {
    setSelectedDatabaseName(name);
    setSelectedTable(null);
    setSql("");
    setQueryResult(null);
    setQueryError(null);
    await loadDatabaseMetadata(name);
  };

  const handleExecuteQuery = async () => {
    if (!sql.trim() || !selectedDatabaseName) {
      message.warning("请选择一个数据库并输入 SQL 查询");
      return;
    }

    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const result = await api.executeQuery(selectedDatabaseName, sql);
      setQueryResult(result);
      message.success(`查询返回 ${result.rowCount} 行，耗时 ${result.executionTimeMs}ms`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "查询执行失败";
      setQueryError(errorMsg);
      message.error(errorMsg);
    } finally {
      setQueryLoading(false);
    }
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
    if (!selectedDatabase) return [];

    const nodes: DataNode[] = [];

    // Group tables by schema
    const tablesBySchema: Record<string, typeof selectedDatabase.tables> = {};
    for (const table of selectedDatabase.tables) {
      const schema = table.schema || "default";
      if (!tablesBySchema[schema]) {
        tablesBySchema[schema] = [];
      }
      tablesBySchema[schema].push(table);
    }

    // Tables - group by schema
    if (selectedDatabase.tables.length > 0) {
      const schemaEntries = Object.entries(tablesBySchema);
      if (schemaEntries.length === 1 && schemaEntries[0][0] === "default") {
        // No schema grouping needed for single default schema
        const tableNodes: DataNode[] = selectedDatabase.tables.map((table) => ({
          title: table.name,
          key: `table-default-${table.name}`,
          icon: <TableOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />,
          style: { fontSize: "12px" },
          children: table.columns.map((col) => ({
            title: `${col.name}: ${col.dataType}`,
            key: `table-default-${table.name}-col-${col.name}`,
            icon: <ColumnHeightOutlined style={{ fontSize: "10px", color: "#bfbfbf" }} />,
            style: { fontSize: "11px", color: "#8c8c8c" },
          })),
        }));
        nodes.push({
          title: `Tables (${selectedDatabase.tables.length})`,
          key: "tables",
          icon: <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />,
          style: { fontSize: "13px", fontWeight: 500, color: "#262626" },
          children: tableNodes,
        });
      } else {
        // Group by schema
        for (const [schema, tables] of schemaEntries) {
          const tableNodes: DataNode[] = tables.map((table) => ({
            title: table.name,
            key: `table-${schema}-${table.name}`,
            icon: <TableOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />,
            style: { fontSize: "12px" },
            children: table.columns.map((col) => ({
              title: `${col.name}: ${col.dataType}`,
              key: `table-${schema}-${table.name}-col-${col.name}`,
              icon: <ColumnHeightOutlined style={{ fontSize: "10px", color: "#bfbfbf" }} />,
              style: { fontSize: "11px", color: "#8c8c8c" },
            })),
          }));
          nodes.push({
            title: `${schema} (${tables.length})`,
            key: `schema-${schema}`,
            icon: <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />,
            style: { fontSize: "13px", fontWeight: 500, color: "#262626" },
            children: tableNodes,
          });
        }
      }
    }

    // Group views by schema
    const viewsBySchema: Record<string, typeof selectedDatabase.views> = {};
    for (const view of selectedDatabase.views) {
      const schema = view.schema || "default";
      if (!viewsBySchema[schema]) {
        viewsBySchema[schema] = [];
      }
      viewsBySchema[schema].push(view);
    }

    // Views - group by schema
    if (selectedDatabase.views.length > 0) {
      const schemaEntries = Object.entries(viewsBySchema);
      if (schemaEntries.length === 1 && schemaEntries[0][0] === "default") {
        // No schema grouping needed for single default schema
        const viewNodes: DataNode[] = selectedDatabase.views.map((view) => ({
          title: view.name,
          key: `view-default-${view.name}`,
          icon: <TableOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />,
          style: { fontSize: "12px" },
          children: view.columns.map((col) => ({
            title: `${col.name}: ${col.dataType}`,
            key: `view-default-${view.name}-col-${col.name}`,
            icon: <ColumnHeightOutlined style={{ fontSize: "10px", color: "#bfbfbf" }} />,
            style: { fontSize: "11px", color: "#8c8c8c" },
          })),
        }));
        nodes.push({
          title: `Views (${selectedDatabase.views.length})`,
          key: "views",
          icon: <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />,
          style: { fontSize: "13px", fontWeight: 500, color: "#262626" },
          children: viewNodes,
        });
      } else {
        // Group by schema
        for (const [schema, views] of schemaEntries) {
          const viewNodes: DataNode[] = views.map((view) => ({
            title: view.name,
            key: `view-${schema}-${view.name}`,
            icon: <TableOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />,
            style: { fontSize: "12px" },
            children: view.columns.map((col) => ({
              title: `${col.name}: ${col.dataType}`,
              key: `view-${schema}-${view.name}-col-${col.name}`,
              icon: <ColumnHeightOutlined style={{ fontSize: "10px", color: "#bfbfbf" }} />,
              style: { fontSize: "11px", color: "#8c8c8c" },
            })),
          }));
          nodes.push({
            title: `${schema} (${views.length})`,
            key: `view-schema-${schema}`,
            icon: <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />,
            style: { fontSize: "13px", fontWeight: 500, color: "#262626" },
            children: viewNodes,
          });
        }
      }
    }

    return nodes;
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0];
    if (!key || !selectedDatabase) return;

    const keyStr = String(key);

    // Find the selected table or view
    const allObjects = [...selectedDatabase.tables, ...selectedDatabase.views];
    for (const obj of allObjects) {
      const schema = obj.schema || "default";
      if (
        keyStr === `table-${schema}-${obj.name}` ||
        keyStr === `view-${schema}-${obj.name}`
      ) {
        setSelectedTable(obj);

        // Generate SQL query for the selected table
        const columns = obj.columns.map(col => col.name).join(", ");
        const query = `SELECT\n  ${columns}\nFROM ${obj.name}\nLIMIT 100;`;
        setSql(query);

        return;
      }
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #f0f0f0" }}>
        <Title level={3} style={{ margin: "16px 0" }}>
          数据库查询工具
        </Title>
      </Header>
      <Layout>
        <Sider width={300} style={{ background: "#fff", borderRight: "1px solid #f0f0f0", height: "calc(100vh - 64px)", overflow: "auto" }}>
          <div style={{ padding: "16px" }}>
            <div style={{ marginBottom: "16px" }}>
              <strong>您的数据库</strong>
            </div>
            <DatabaseList
              databases={databases}
              onSelect={handleSelectDatabase}
              onDelete={handleDelete}
              onDatabaseUpdated={loadDatabases}
              selectedName={selectedDatabaseName}
            />

            {selectedDatabase && !metadataLoading && (
              <>
                <div style={{ marginTop: "24px", marginBottom: "16px", paddingTop: "16px", borderTop: "1px solid #f0f0f0" }}>
                  <strong>架构浏览器</strong>
                </div>
                <Tree
                  showIcon
                  defaultExpandAll
                  treeData={buildTreeData()}
                  onSelect={handleTreeSelect}
                  style={{ fontSize: "13px" }}
                />
              </>
            )}

            {metadataLoading && (
              <div style={{ marginTop: "24px", textAlign: "center" }}>
                Loading metadata...
              </div>
            )}

            {metadataError && (
              <Alert
                message="加载元数据失败"
                description={metadataError}
                type="error"
                showIcon
                style={{ marginTop: "16px" }}
              />
            )}
          </div>
        </Sider>
        <Content style={{ padding: "24px", background: "#f5f5f5" }}>
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={4}>SQL 查询</Title>
              <AddDatabaseForm onDatabaseCreated={loadDatabases} />
            </div>

            {selectedDatabase && (
              <Alert
                message={
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    {/* Database info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>
                        {selectedDatabase.name}
                      </span>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: selectedDatabase.dbType === "mysql" ? "#1890ff" :
                               selectedDatabase.dbType === "sqlite" ? "#52c41a" : "#8c8c8c",
                        textTransform: "uppercase",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        backgroundColor: selectedDatabase.dbType === "mysql" ? "#e6f7ff" :
                                         selectedDatabase.dbType === "sqlite" ? "#f6ffed" : "#f5f5f5"
                      }}>
                        {selectedDatabase.dbType}
                      </span>
                    </div>

                    {/* Separator */}
                    <span style={{ color: "#d9d9d9", fontSize: "12px" }}>|</span>

                    {/* Stats */}
                    <span style={{ fontSize: "12px", color: "#8c8c8c" }}>
                      {selectedDatabase.tables.length} 表 · {selectedDatabase.views.length} 视图
                    </span>

                    {/* Table info */}
                    {selectedTable && (
                      <>
                        <span style={{ color: "#d9d9d9", fontSize: "12px" }}>→</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <TableOutlined style={{ fontSize: "12px", color: "#fa8c16" }} />
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#262626" }}>
                            {selectedTable.name}
                          </span>
                          <span style={{ fontSize: "11px", color: "#8c8c8c" }}>
                            ({selectedTable.columns.length} 列)
                          </span>
                        </div>
                      </>
                    )}

                    {/* Close button area */}
                    <div style={{ marginLeft: "auto" }}>
                      <button
                        onClick={() => {
                          setSelectedDatabaseName(null);
                          setSelectedDatabase(null);
                          setSelectedTable(null);
                          setSql("");
                          setQueryResult(null);
                          setQueryError(null);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: "2px 6px",
                          fontSize: "12px",
                          color: "#8c8c8c",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f5f5f5";
                          e.currentTarget.style.color = "#262626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#8c8c8c";
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                }
                type="info"
                showIcon={false}
                style={{
                  borderRadius: "6px",
                  borderLeft: "3px solid #1890ff",
                  backgroundColor: "#fafafa",
                  padding: "8px 12px"
                }}
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
                <p style={{ color: "#8c8c8c", fontSize: "16px" }}>
                  从侧边栏选择一个数据库开始查询
                </p>
              </div>
            )}

            {selectedDatabase && (
              <>
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
                        <SqlEditor
                          value={sql}
                          onChange={setSql}
                          onExecute={handleExecuteQuery}
                          loading={queryLoading}
                          placeholder="在此输入 SELECT 查询..."
                        />
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
                          databaseName={selectedDatabase.name}
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
                />
              </>
            )}
          </Space>
        </Content>
      </Layout>
    </Layout>
  );
}
