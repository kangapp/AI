import { List, Button, Space, Typography, Tag } from "antd";
import { DeleteOutlined, CheckCircleFilled } from "@ant-design/icons";
import type { DatabaseConnection } from "../../types";

const { Text } = Typography;

interface DatabaseListProps {
  databases: DatabaseConnection[];
  onSelect: (name: string) => void;
  onDelete: (name: string) => void;
  selectedName?: string | null;
}

export function DatabaseList({ databases, onSelect, onDelete, selectedName }: DatabaseListProps) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      {databases.length === 0 ? (
        <Text type="secondary" style={{ fontSize: "13px" }}>
          尚未配置数据库。
        </Text>
      ) : (
        <List
          dataSource={databases}
          size="small"
          renderItem={(db) => {
            const isSelected = db.name === selectedName;
            return (
              <List.Item
                style={{
                  padding: "8px 12px",
                  backgroundColor: isSelected ? "#e6f7ff" : "transparent",
                  borderRadius: "4px",
                  border: isSelected ? "1px solid #91d5ff" : "1px solid transparent",
                  marginBottom: "4px",
                  cursor: "pointer",
                }}
                actions={[
                  <Button
                    danger
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(db.name);
                    }}
                    style={{ fontSize: "12px" }}
                  >
                    删除
                  </Button>,
                ]}
                onClick={() => onSelect(db.name)}
              >
                <List.Item.Meta
                  avatar={
                    isSelected ? (
                      <CheckCircleFilled style={{ color: "#1890ff", fontSize: "16px" }} />
                    ) : null
                  }
                  title={
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "nowrap" }}>
                      <Text
                        strong={isSelected}
                        style={{
                          fontSize: "13px",
                          color: isSelected ? "#1890ff" : "inherit",
                          flexShrink: 0,
                        }}
                      >
                        {db.name}
                      </Text>
                      <Tag color={isSelected ? "blue" : "default"} style={{ fontSize: "10px", margin: 0, flexShrink: 0 }}>
                        {db.dbType}
                      </Tag>
                    </div>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      {db.lastConnectedAt
                        ? new Date(db.lastConnectedAt).toLocaleString()
                        : "尚未连接"}
                    </Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Space>
  );
}
