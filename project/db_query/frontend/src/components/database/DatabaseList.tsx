import { List, Button, Space, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { DatabaseConnection } from "../../types";

const { Title, Text } = Typography;

interface DatabaseListProps {
  databases: DatabaseConnection[];
  onSelect: (name: string) => void;
  onDelete: (name: string) => void;
}

export function DatabaseList({ databases, onSelect, onDelete }: DatabaseListProps) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Title level={4}>Databases ({databases.length})</Title>
      {databases.length === 0 ? (
        <Text type="secondary">No databases configured yet.</Text>
      ) : (
        <List
          dataSource={databases}
          renderItem={(db) => (
            <List.Item
              actions={[
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(db.name)}
                >
                  Delete
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Button type="link" onClick={() => onSelect(db.name)}>
                    {db.name}
                  </Button>
                }
                description={
                  <Text type="secondary">
                    {db.dbType} • Last connected:{" "}
                    {db.lastConnectedAt
                      ? new Date(db.lastConnectedAt).toLocaleString()
                      : "Never"}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
}
