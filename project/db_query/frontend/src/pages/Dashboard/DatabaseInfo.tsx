import { DatabaseOutlined, TableOutlined } from "@ant-design/icons";
import { Alert } from "antd";
import type { DatabaseDetail, TableMetadata, ViewMetadata } from "../../types";

interface DatabaseInfoProps {
  selectedDatabase: DatabaseDetail | null;
  selectedTable: TableMetadata | ViewMetadata | null;
  onClose: () => void;
}

/**
 * DatabaseInfo component displaying selected database details and statistics.
 */
export function DatabaseInfo({ selectedDatabase, selectedTable, onClose }: DatabaseInfoProps) {
  if (!selectedDatabase) {
    return null;
  }

  return (
    <Alert
      message={
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Database info */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <DatabaseOutlined style={{ fontSize: "13px", color: "#1890ff" }} />
            <span style={{ fontSize: "13px", fontWeight: 500 }}>{selectedDatabase.name}</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color:
                  selectedDatabase.dbType === "mysql"
                    ? "#1890ff"
                    : selectedDatabase.dbType === "sqlite"
                      ? "#52c41a"
                      : "#8c8c8c",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: "3px",
                backgroundColor:
                  selectedDatabase.dbType === "mysql"
                    ? "#e6f7ff"
                    : selectedDatabase.dbType === "sqlite"
                      ? "#f6ffed"
                      : "#f5f5f5",
              }}
            >
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

          {/* Close button */}
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: "12px",
                color: "#8c8c8c",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
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
        padding: "8px 12px",
      }}
    />
  );
}
