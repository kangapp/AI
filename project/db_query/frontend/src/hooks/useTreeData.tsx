/**
 * Custom hook for building schema tree data from metadata.
 */

import { useMemo } from "react";
import { TableOutlined, ColumnHeightOutlined, DatabaseOutlined } from "@ant-design/icons";
import type { TableMetadata, ViewMetadata } from "../types";

export interface DataNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: DataNode[];
  className?: string;
  style?: React.CSSProperties;
}

interface GroupedMetadata {
  tablesBySchema: Record<string, TableMetadata[]>;
  viewsBySchema: Record<string, ViewMetadata[]>;
}

/**
 * Group tables and views by schema
 */
function groupBySchema(
  tables: TableMetadata[],
  views: ViewMetadata[]
): GroupedMetadata {
  const tablesBySchema: Record<string, TableMetadata[]> = {};
  const viewsBySchema: Record<string, ViewMetadata[]> = {};

  for (const table of tables) {
    const schema = table.schema || "default";
    if (!tablesBySchema[schema]) {
      tablesBySchema[schema] = [];
    }
    tablesBySchema[schema].push(table);
  }

  for (const view of views) {
    const schema = view.schema || "default";
    if (!viewsBySchema[schema]) {
      viewsBySchema[schema] = [];
    }
    viewsBySchema[schema].push(view);
  }

  return { tablesBySchema, viewsBySchema };
}

/**
 * Build tree data for a single table or view
 */
function buildObjectNode(
  obj: TableMetadata | ViewMetadata,
  type: "table" | "view",
  schema: string
): DataNode {
  const prefix = type;
  return {
    title: obj.name,
    key: `${prefix}-${schema}-${obj.name}`,
    icon: <TableOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />,
    style: { fontSize: "12px" },
    children: obj.columns.map((col) => ({
      title: `${col.name}: ${col.dataType}`,
      key: `${prefix}-${schema}-${obj.name}-col-${col.name}`,
      icon: <ColumnHeightOutlined style={{ fontSize: "10px", color: "#bfbfbf" }} />,
      style: { fontSize: "11px", color: "#8c8c8c" },
    })),
  };
}

/**
 * Build tree nodes for tables or views grouped by schema
 */
function buildSchemaGroupNodes(
  schemaEntries: [string, (TableMetadata | ViewMetadata)[]][],
  type: "table" | "view",
  defaultLabel: string
): DataNode[] {
  if (schemaEntries.length === 1 && schemaEntries[0][0] === "default") {
    // No schema grouping needed for single default schema
    const objects = schemaEntries[0][1];
    const label = `${defaultLabel} (${objects.length})`;
    return [
      {
        title: label,
        key: type === "table" ? "tables" : "views",
        icon: <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />,
        style: { fontSize: "13px", fontWeight: 500, color: "#262626" },
        children: objects.map((obj) => buildObjectNode(obj, type, "default")),
      },
    ];
  }

  // Group by schema
  return schemaEntries.map(([schema, objects]) => ({
    title: `${schema} (${objects.length})`,
    key: `${type}-schema-${schema}`,
    icon: <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />,
    style: { fontSize: "13px", fontWeight: 500, color: "#262626" },
    children: objects.map((obj) => buildObjectNode(obj, type, schema)),
  }));
}

/**
 * Custom hook to build tree data from database metadata
 */
export function useTreeData(
  tables: TableMetadata[],
  views: ViewMetadata[]
): DataNode[] {
  return useMemo(() => {
    const nodes: DataNode[] = [];
    const { tablesBySchema, viewsBySchema } = groupBySchema(tables, views);

    // Build table nodes
    if (tables.length > 0) {
      const tableEntries = Object.entries(tablesBySchema);
      nodes.push(...buildSchemaGroupNodes(tableEntries, "table", "Tables"));
    }

    // Build view nodes
    if (views.length > 0) {
      const viewEntries = Object.entries(viewsBySchema);
      nodes.push(...buildSchemaGroupNodes(viewEntries, "view", "Views"));
    }

    return nodes;
  }, [tables, views]);
}
