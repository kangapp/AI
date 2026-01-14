import { DatabaseOutlined, TableOutlined, ColumnHeightOutlined } from "@ant-design/icons";
import { Alert, Tree } from "antd";
import { DatabaseList } from "../../components/database";
import type { DatabaseConnection, TableMetadata, ViewMetadata, ColumnMetadata } from "../../types";

interface DataNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: DataNode[];
  className?: string;
  style?: React.CSSProperties;
}

interface SidebarProps {
  databases: DatabaseConnection[];
  selectedDatabaseName: string | null;
  selectedDatabase: {
    name: string;
    dbType: string;
    tables: TableMetadata[];
    views: ViewMetadata[];
  } | null;
  metadataLoading: boolean;
  metadataError: string | null;
  onSelectDatabase: (name: string) => void;
  onDeleteDatabase: (name: string) => Promise<void>;
  onDatabaseUpdated: () => void;
  onTableSelect: (table: TableMetadata | ViewMetadata, sql?: string) => void;
}

/**
 * Sidebar component displaying database list and schema browser.
 */
export function Sidebar({
  databases,
  selectedDatabaseName,
  selectedDatabase,
  metadataLoading,
  metadataError,
  onSelectDatabase,
  onDeleteDatabase,
  onDatabaseUpdated,
  onTableSelect,
}: SidebarProps) {
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
          children: table.columns.map((col: ColumnMetadata) => ({
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
            children: table.columns.map((col: ColumnMetadata) => ({
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
          children: view.columns.map((col: ColumnMetadata) => ({
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
            children: view.columns.map((col: ColumnMetadata) => ({
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
        // Generate SQL query for the selected table
        const columns = obj.columns.map((col) => col.name).join(", ");
        const query = `SELECT\n  ${columns}\nFROM ${obj.name}\nLIMIT 100;`;

        // Call onTableSelect with both table and generated SQL
        onTableSelect(obj, query);

        return;
      }
    }
  };

  return (
    <div style={{ padding: "16px", height: "100%", overflow: "auto" }}>
      <div style={{ marginBottom: "16px" }}>
        <strong>您的数据库</strong>
      </div>
      <DatabaseList
        databases={databases}
        onSelect={onSelectDatabase}
        onDelete={onDeleteDatabase}
        onDatabaseUpdated={onDatabaseUpdated}
        selectedName={selectedDatabaseName}
      />

      {selectedDatabase && !metadataLoading && (
        <>
          <div
            style={{
              marginTop: "24px",
              marginBottom: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #f0f0f0",
            }}
          >
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
  );
}
