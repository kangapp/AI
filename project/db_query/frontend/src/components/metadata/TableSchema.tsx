import { Table, Tag, Typography, Descriptions } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ColumnMetadata, TableMetadata } from "../../types";

const { Text, Title } = Typography;

interface TableSchemaProps {
  table: TableMetadata;
}

export function TableSchema({ table }: TableSchemaProps) {
  const columns: ColumnsType<ColumnMetadata> = [
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
        <Tag color={nullable ? "orange" : "green"}>{nullable ? "YES" : "NO"}</Tag>
      ),
    },
    {
      title: "Default",
      dataIndex: "defaultValue",
      key: "defaultValue",
      render: (value: string | null) => value || <Text type="secondary">null</Text>,
    },
  ];

  return (
    <>
      <Descriptions title={table.name} bordered column={2} size="small">
        <Descriptions.Item label="Schema">
          {table.schema || "default"}
        </Descriptions.Item>
        <Descriptions.Item label="Columns">
          {table.columns.length}
        </Descriptions.Item>
        {table.rowCountEstimate && (
          <Descriptions.Item label="Estimated Rows">
            {table.rowCountEstimate.toLocaleString()}
          </Descriptions.Item>
        )}
        {table.description && (
          <Descriptions.Item label="Description" span={2}>
            {table.description}
          </Descriptions.Item>
        )}
      </Descriptions>
      <Table
        columns={columns}
        dataSource={table.columns}
        pagination={false}
        size="small"
        rowKey="name"
      />
    </>
  );
}
