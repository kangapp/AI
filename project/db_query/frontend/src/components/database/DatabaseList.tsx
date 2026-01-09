import { List, Typography, Tag } from "antd";
import { DeleteOutlined, EditOutlined, DatabaseOutlined } from "@ant-design/icons";
import type { DatabaseConnection } from "../../types";
import { EditDatabaseForm } from "./EditDatabaseForm";

const { Text } = Typography;

interface DatabaseListProps {
  databases: DatabaseConnection[];
  onSelect: (name: string) => void;
  onDelete: (name: string) => void;
  onDatabaseUpdated?: () => void;
  selectedName?: string | null;
}

// Action button component
interface ActionButtonProps {
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  danger?: boolean;
  children?: React.ReactNode;
}

function ActionButton({ icon, onClick, danger, children }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: "4px",
        fontSize: "12px",
        color: danger ? "#ff4d4f" : "#8c8c8c",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = danger ? "#fff1f0" : "#f5f5f5";
        e.currentTarget.style.color = danger ? "#ff4d4f" : "#262626";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = danger ? "#ff4d4f" : "#8c8c8c";
      }}
    >
      {children || icon}
    </button>
  );
}

export function DatabaseList({ databases, onSelect, onDelete, onDatabaseUpdated, selectedName }: DatabaseListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {databases.length === 0 ? (
        <Text type="secondary" style={{ fontSize: "12px" }}>
          尚未配置数据库
        </Text>
      ) : (
        databases.map((db) => {
          const isSelected = db.name === selectedName;
          return (
            <div
              key={db.name}
              onClick={() => onSelect(db.name)}
              style={{
                padding: "6px 8px",
                backgroundColor: isSelected ? "#e6f7ff" : "transparent",
                borderRadius: "6px",
                border: isSelected ? "1px solid #91d5ff" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "#fafafa";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {/* Database icon */}
              <DatabaseOutlined
                style={{
                  color: isSelected ? "#1890ff" : "#8c8c8c",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              />

              {/* Database name and type */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <Text
                  strong
                  style={{
                    fontSize: "13px",
                    color: isSelected ? "#1890ff" : "#262626",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  ellipsis
                >
                  {db.name}
                </Text>
                <Tag
                  color={isSelected ? "blue" : "default"}
                  style={{
                    fontSize: "10px",
                    margin: 0,
                    padding: "0 4px",
                    height: "16px",
                    lineHeight: "16px",
                    borderRadius: "3px",
                    flexShrink: 0,
                  }}
                >
                  {db.dbType.toUpperCase()}
                </Tag>
              </div>

              {/* Action buttons */}
              <div
                style={{ display: "flex", gap: "2px", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <EditDatabaseForm
                  database={db}
                  onDatabaseUpdated={onDatabaseUpdated || (() => {})}
                />
                <ActionButton
                  icon={<DeleteOutlined />}
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(db.name);
                  }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
