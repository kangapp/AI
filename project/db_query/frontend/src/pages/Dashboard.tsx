import { useState, useEffect } from "react";
import { Layout, Typography, Space, Modal, message } from "antd";
import { DatabaseList, AddDatabaseForm } from "../components/database";
import type { DatabaseConnection } from "../types";
import { api } from "../services/api";

const { Header, Content } = Layout;
const { Title } = Typography;

export function Dashboard() {
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const response = await api.listDatabases();
      setDatabases(response.databases);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load databases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabases();
  }, []);

  const handleDelete = async (name: string) => {
    Modal.confirm({
      title: "Delete Database",
      content: `Are you sure you want to delete "${name}"?`,
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await api.deleteDatabase(name);
          message.success("Database deleted successfully");
          loadDatabases();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Failed to delete database");
        }
      },
    });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #f0f0f0" }}>
        <Title level={3} style={{ margin: "16px 0" }}>
          Database Query Tool
        </Title>
      </Header>
      <Content style={{ padding: "24px" }}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Title level={4}>Your Databases</Title>
            <AddDatabaseForm onDatabaseCreated={loadDatabases} />
          </div>
          <DatabaseList
            databases={databases}
            onSelect={setSelectedDatabase}
            onDelete={handleDelete}
          />
        </Space>
      </Content>
    </Layout>
  );
}
