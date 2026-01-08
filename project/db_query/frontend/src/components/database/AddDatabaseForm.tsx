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
      message.success("数据库添加成功");
      form.resetFields();
      setIsModalOpen(false);
      onDatabaseCreated();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加数据库失败");
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
        添加数据库
      </Button>
      <Modal
        title="添加数据库连接"
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
            label="名称"
            name="name"
            rules={[
              { required: true, message: "请输入数据库名称" },
            ]}
          >
            <Input placeholder="我的 PostgreSQL 数据库" />
          </Form.Item>
          <Form.Item
            label="连接字符串"
            name="url"
            rules={[
              { required: true, message: "请输入连接字符串" },
              {
                pattern: /^(postgres|mysql|sqlite):\/\//,
                message:
                  "连接字符串必须以 postgres://, mysql:// 或 sqlite:// 开头",
              },
            ]}
            extra="示例：postgresql://user:pass@localhost:5432/mydb, mysql://user:pass@localhost:3306/mydb, sqlite:///path/to/file.db"
          >
            <Input.TextArea
              rows={3}
              placeholder="postgresql://user:password@localhost:5432/mydatabase"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                添加数据库
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
