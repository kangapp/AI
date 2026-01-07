import { useState } from "react";
import { Modal, Form, Input, Button, message, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { DatabaseCreateRequest } from "../../types";
import { api } from "../../services/api";

interface AddDatabaseFormProps {
  onDatabaseCreated: () => void;
}

export function AddDatabaseForm({ onDatabaseCreated }: AddDatabaseFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: DatabaseCreateRequest) => {
    setLoading(true);
    try {
      await api.createDatabase(values.name, values.url);
      message.success("Database added successfully");
      form.resetFields();
      setIsModalOpen(false);
      onDatabaseCreated();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to add database");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setIsModalOpen(true)}
      >
        Add Database
      </Button>
      <Modal
        title="Add Database Connection"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, message: "Please enter a name for this database" },
            ]}
          >
            <Input placeholder="My PostgreSQL Database" />
          </Form.Item>
          <Form.Item
            label="Connection String"
            name="url"
            rules={[
              { required: true, message: "Please enter a connection string" },
              {
                pattern: /^(postgres|mysql|sqlite):\/\//,
                message:
                  "Connection string must start with postgres://, mysql://, or sqlite://",
              },
            ]}
            extra="Examples: postgresql://user:pass@localhost:5432/mydb, mysql://user:pass@localhost:3306/mydb, sqlite:///path/to/file.db"
          >
            <Input.TextArea
              rows={3}
              placeholder="postgresql://user:password@localhost:5432/mydatabase"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Add Database
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
