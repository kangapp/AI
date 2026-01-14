import { useState, useMemo } from "react";
import { Modal, Form, Input, Button, message, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { DatabaseCreateRequest } from "../../types";
import { api } from "../../services/api";

const { Text } = Typography;

interface AddDatabaseFormProps {
  onDatabaseCreated: () => void;
}

// Database connection examples by type
const EXAMPLES = {
  postgresql: [
    { label: "标准连接", value: "postgresql://user:password@localhost:5432/mydatabase" },
    { label: "使用主机名", value: "postgresql://user:password@db.example.com:5432/mydatabase" },
  ],
  mysql: [
    { label: "标准连接", value: "mysql://user:password@localhost:3306/mydatabase" },
    { label: "使用主机名", value: "mysql://user:password@db.example.com:3306/mydatabase" },
  ],
  sqlite: [
    { label: "相对路径", value: "sqlite:///data/database.db" },
    { label: "绝对路径", value: "sqlite:////Users/username/data/database.db" },
    { label: "内存数据库", value: "sqlite:///:memory:" },
  ],
  general: [
    { label: "PostgreSQL", value: "postgresql://user:password@localhost:5432/mydb" },
    { label: "MySQL", value: "mysql://user:password@localhost:3306/mydb" },
    { label: "SQLite (相对)", value: "sqlite:///path/to/database.db" },
    { label: "SQLite (绝对)", value: "sqlite:////absolute/path/to/database.db" },
  ],
};

// Detect database type from connection string
function detectDatabaseType(url: string): "postgresql" | "mysql" | "sqlite" | "general" {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith("postgresql://") || lowerUrl.startsWith("postgres://")) {
    return "postgresql";
  }
  if (lowerUrl.startsWith("mysql://")) {
    return "mysql";
  }
  if (lowerUrl.startsWith("sqlite://")) {
    return "sqlite";
  }
  return "general";
}

export function AddDatabaseForm({ onDatabaseCreated }: AddDatabaseFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // Detect current database type based on input
  const detectedType = useMemo(() => {
    return detectDatabaseType(urlInput);
  }, [urlInput]);

  // Get relevant examples based on detected type
  const relevantExamples = useMemo(() => {
    return EXAMPLES[detectedType] || EXAMPLES.general;
  }, [detectedType]);

  const handleSubmit = async (values: DatabaseCreateRequest) => {
    setLoading(true);
    try {
      await api.createDatabase(values.name, values.url);
      message.success("数据库添加成功");
      form.resetFields();
      setUrlInput("");
      setIsModalOpen(false);
      onDatabaseCreated();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加数据库失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUrlInput(e.target.value);
  };

  const handleClose = () => {
    form.resetFields();
    setUrlInput("");
    setIsModalOpen(false);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setIsModalOpen(true)}
      >
        添加数据库
      </Button>
      <Modal
        title="添加数据库连接"
        open={isModalOpen}
        onCancel={handleClose}
        footer={null}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[
              { required: true, message: "请输入数据库名称" },
            ]}
          >
            <Input placeholder="我的 PostgreSQL 数据库" />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <span>连接字符串</span>
                {detectedType !== "general" && (
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    (检测到: {detectedType.toUpperCase()})
                  </Text>
                )}
              </Space>
            }
            name="url"
            rules={[
              { required: true, message: "请输入连接字符串" },
              {
                pattern: /^(postgres|mysql|sqlite):\/\//,
                message:
                  "连接字符串必须以 postgres://, mysql:// 或 sqlite:// 开头",
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="postgresql://user:password@localhost:5432/mydatabase"
              onChange={handleUrlChange}
            />
          </Form.Item>

          {/* Dynamic Examples Section */}
          <div
            style={{
              marginTop: "-12px",
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#f5f5f5",
              borderRadius: "6px",
              border: "1px solid #e8e8e8",
            }}
          >
            <Text strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>
              {detectedType === "general" ? "连接示例" : `${detectedType.toUpperCase()} 连接示例`}
            </Text>
            {relevantExamples.map((example, index) => (
              <div key={index} style={{ marginBottom: index < relevantExamples.length - 1 ? "8px" : "0" }}>
                <Text type="secondary" style={{ fontSize: "11px" }}>
                  {example.label}:
                </Text>
                <div
                  style={{
                    marginTop: "4px",
                    padding: "6px 8px",
                    backgroundColor: "#fff",
                    border: "1px solid #d9d9d9",
                    borderRadius: "4px",
                    fontFamily: "Monaco, Consolas, monospace",
                    fontSize: "11px",
                    color: "#1890ff",
                    wordBreak: "break-all",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => {
                    form.setFieldValue("url", example.value);
                    setUrlInput(example.value);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e6f7ff";
                    e.currentTarget.style.borderColor = "#1890ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#fff";
                    e.currentTarget.style.borderColor = "#d9d9d9";
                  }}
                  title="点击填入"
                >
                  {example.value}
                </div>
              </div>
            ))}
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                添加数据库
              </Button>
              <Button onClick={handleClose}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
