/**
 * Shared SchemaTree component for displaying database metadata.
 */

import { Tree } from "antd";
import { useTreeData, type DataNode } from "../../hooks";

export interface SchemaTreeProps {
  tables: any[];
  views: any[];
  onSelect?: (selectedKeys: React.Key[], info: any) => void;
  selectedKeys?: React.Key[];
  loading?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function SchemaTree({
  tables,
  views,
  onSelect,
  selectedKeys,
  loading = false,
  style,
  className,
}: SchemaTreeProps) {
  const treeData = useTreeData(tables, views);

  return (
    <Tree
      showIcon
      defaultExpandAll
      treeData={treeData}
      onSelect={onSelect}
      selectedKeys={selectedKeys}
      loading={loading}
      style={{ fontSize: "13px", ...style }}
      className={className}
    />
  );
}

export default SchemaTree;
