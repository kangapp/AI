import { useState, useEffect } from "react";
import { Layout, Typography, Space, Modal, message, Tree, Alert } from "antd";
import { TableOutlined, ColumnHeightOutlined, DatabaseOutlined } from "@ant-design/icons";
import { DatabaseList, AddDatabaseForm } from "../components/database";
import { SqlEditor, QueryResults } from "../components/query";
import type { DatabaseConnection, DatabaseDetail, TableMetadata, ColumnMetadata, ViewMetadata } from "../types";
import { api } from "../services/api";
import type { QueryResponse } from "../services/api";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

interface DataNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: DataNode[];
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
          icon: <TableOutlined />,
          children: table.columns.map((col) => ({
            title: `${col.name}: ${col.dataType}`,
            key: `table-default-${table.name}-col-${col.name}`,
            icon: <ColumnHeightOutlined />,
          })),
        }));
        nodes.push({
          title: `Tables (${selectedDatabase.tables.length})`,
          key: "tables",
          icon: <DatabaseOutlined />,
          children: tableNodes,
        });
      } else {
        // Group by schema
        for (const [schema, tables] of schemaEntries) {
          const tableNodes: DataNode[] = tables.map((table) => ({
            title: table.name,
            key: `table-${schema}-${table.name}`,
            icon: <TableOutlined />,
            children: table.columns.map((col) => ({
              title: `${col.name}: ${col.dataType}`,
              key: `table-${schema}-${table.name}-col-${col.name}`,
              icon: <ColumnHeightOutlined />,
            })),
          }));
          nodes.push({
            title: `${schema} (${tables.length})`,
            key: `schema-${schema}`,
            icon: <DatabaseOutlined />,
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
          icon: <TableOutlined />,
          children: view.columns.map((col) => ({
            title: `${col.name}: ${col.dataType}`,
            key: `view-default-${view.name}-col-${col.name}`,
            icon: <ColumnHeightOutlined />,
          })),
        }));
        nodes.push({
          title: `Views (${selectedDatabase.views.length})`,
          key: "views",
          icon: <DatabaseOutlined />,
          children: viewNodes,
        });
      } else {
        // Group by schema
        for (const [schema, views] of schemaEntries) {
          const viewNodes: DataNode[] = views.map((view) => ({
            title: view.name,
            key: `view-${schema}-${view.name}`,
            icon: <TableOutlined />,
            children: view.columns.map((col) => ({
              title: `${col.name}: ${col.dataType}`,
              key: `view-${schema}-${view.name}-col-${col.name}`,
              icon: <ColumnHeightOutlined />,
            })),
          }));
          nodes.push({
            title: `${schema} (${views.length})`,
            key: `view-schema-${schema}`,
            icon: <DatabaseOutlined />,
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
                message={`已连接到：${selectedDatabase.name}`}
                description={`${selectedDatabase.tables.length} 个表，${selectedDatabase.views.length} 个视图 • ${selectedDatabase.dbType}`}
                type="info"
                showIcon
                closable
                onClose={() => {
                  setSelectedDatabaseName(null);
                  setSelectedDatabase(null);
                  setSelectedTable(null);
                  setSql("");
                  setQueryResult(null);
                  setQueryError(null);
                }}
              />
            )}

            {selectedTable && (
              <Alert
                message={selectedTable.name}
                description={
                  <div>
                    <div>类型: <strong>{selectedTable.schema || "default"}</strong></div>
                    <div>列数: {selectedTable.columns.length}</div>
                    {selectedTable.rowCountEstimate !== null && (
                      <div>行数（估）: {selectedTable.rowCountEstimate}</div>
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
                <SqlEditor
                  value={sql}
                  onChange={setSql}
                  onExecute={handleExecuteQuery}
                  loading={queryLoading}
                  placeholder="在此输入 SELECT 查询..."
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
