import { useState, useEffect } from "react";
import { Layout, Typography, Space, Button, message, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { DatabaseDetail as DatabaseDetailComponent } from "../components/database";
import type { DatabaseDetail } from "../types";
import { api } from "../services/api";

const { Header, Content } = Layout;
const { Title } = Typography;

export function DatabasePage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [database, setDatabase] = useState<DatabaseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDatabase = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const db = await api.getDatabase(name);
      setDatabase(db);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load database");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, [name]);

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Content style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!database) {
    return null;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #f0f0f0" }}>
        <Space style={{ margin: "16px 0" }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
            Back
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {database.name}
          </Title>
        </Space>
      </Header>
      <Content style={{ padding: "24px" }}>
        <DatabaseDetailComponent database={database} onRefresh={loadDatabase} />
      </Content>
    </Layout>
  );
}
