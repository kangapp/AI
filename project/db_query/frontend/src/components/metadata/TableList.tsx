import { Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableMetadata, ViewMetadata, ColumnMetadata } from "../../types";

const { Text } = Typography;

interface TableListProps {
  tables: TableMetadata[];
  views: ViewMetadata[];
}

interface TableOrViewData {
  key: string;
  name: string;
  schema: string | null;
  type: "table" | "view";
  columnCount: number;
  columns: ColumnMetadata[];
}

export function TableList({ tables, views }: TableListProps) {
  // Combine tables and views for display
  const data: TableOrViewData[] = [
    ...tables.map((t) => ({
      key: `table-${t.name}`,
      name: t.name,
      schema: t.schema,
      type: "table" as const,
      columnCount: t.columns.length,
      columns: t.columns,
    })),
    ...views.map((v) => ({
      key: `view-${v.name}`,
      name: v.name,
      schema: v.schema,
      type: "view" as const,
      columnCount: v.columns.length,
      columns: v.columns,
    })),
  ];

  const columns: ColumnsType<TableOrViewData> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Schema",
      dataIndex: "schema",
      key: "schema",
      render: (schema: string | null) => schema || <Text type="secondary">default</Text>,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: "table" | "view") => (
        <Tag color={type === "table" ? "blue" : "green"}>{type.toUpperCase()}</Tag>
      ),
    },
    {
      title: "Columns",
      dataIndex: "columnCount",
      key: "columnCount",
    },
  ];

  const columnColumns: ColumnsType<ColumnMetadata> = [
    {
      title: "Column",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: ColumnMetadata) => (
        <span>
          {name}
          {record.isPrimaryKey && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              PK
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: "Type",
      dataIndex: "dataType",
      key: "dataType",
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: "Nullable",
      dataIndex: "isNullable",
      key: "isNullable",
      render: (nullable: boolean) => (
        <Tag color={nullable ? "orange" : "green"}>
          {nullable ? "YES" : "NO"}
        </Tag>
      ),
    },
    {
      title: "Default",
      dataIndex: "defaultValue",
      key: "defaultValue",
      render: (value: string | null) => value || <Text type="secondary">null</Text>,
    },
  ];

  const expandedRowRender = (record: TableOrViewData) => {
    const columnsData = record.columns as ColumnMetadata[];
    return (
      <Table
        columns={columnColumns}
        dataSource={columnsData}
        pagination={false}
        size="small"
        rowKey="name"
      />
    );
  };

  return (
    <Table
      columns={columns}
      dataSource={data}
      expandable={{ expandedRowRender }}
      pagination={{ pageSize: 10 }}
      size="middle"
    />
  );
}
