import { useState, useEffect } from "react";
import { Modal, Form, Input, Button, message, Space, Descriptions } from "antd";
import { EditOutlined } from "@ant-design/icons";
import type { DatabaseConnection, DatabaseUpdateRequest } from "../../types";
import { api } from "../../services/api";

interface EditDatabaseFormProps {
  database: DatabaseConnection;
  onDatabaseUpdated: () => void;
}

export function EditDatabaseForm({ database, onDatabaseUpdated }: EditDatabaseFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      form.setFieldsValue({
        name: database.name,
        url: database.url,
      });
    }
  }, [isModalOpen, database, form]);

  const handleSubmit = async (values: DatabaseUpdateRequest) => {
    setLoading(true);
    try {
      await api.updateDatabase(database.name, values);
      message.success("数据库更新成功");
      form.resetFields();
      setIsModalOpen(false);
      onDatabaseUpdated();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新数据库失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "4px",
          fontSize: "12px",
          color: "#8c8c8c",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
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
        <EditOutlined />
      </button>
      <Modal
        title="编辑数据库连接"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={500}
      >
        <Descriptions
          column={1}
          size="small"
          bordered
          style={{ marginBottom: "16px" }}
        >
          <Descriptions.Item label="当前名称">{database.name}</Descriptions.Item>
          <Descriptions.Item label="数据库类型">
            {database.dbType.toUpperCase()}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(database.createdAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="新名称"
            name="name"
            tooltip="留空则不修改名称"
          >
            <Input placeholder="输入新名称或留空" />
          </Form.Item>
          <Form.Item
            label="新连接字符串"
            name="url"
            tooltip="留空则不修改连接"
            extra="示例：postgresql://user:pass@localhost:5432/mydb, mysql://user:pass@localhost:3306/mydb, sqlite:///path/to/file.db"
          >
            <Input.TextArea
              rows={3}
              placeholder="输入新连接字符串或留空"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                更新数据库
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
