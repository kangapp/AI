import { Descriptions, Tag, Button, Space, Divider, Spin } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { DatabaseDetail } from "../../types";
import { api } from "../../services/api";
import { TableList } from "../metadata";

interface DatabaseDetailProps {
  database: DatabaseDetail;
  onRefresh: () => void;
}

export function DatabaseDetailComponent({ database, onRefresh }: DatabaseDetailProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.getDatabase(database.name, true);
      onRefresh();
    } catch (error) {
      console.error("Failed to refresh metadata", error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Descriptions title={database.name} bordered column={2}>
        <Descriptions.Item label="Type">
          <Tag color="blue">{database.dbType}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Connection">
          <code>{database.url}</code>
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {new Date(database.createdAt).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="Last Connected">
          {database.lastConnectedAt
            ? new Date(database.lastConnectedAt).toLocaleString()
            : "Never"}
        </Descriptions.Item>
        <Descriptions.Item label="Tables" span={2}>
          {database.tables.length}
        </Descriptions.Item>
        <Descriptions.Item label="Views" span={2}>
          {database.views.length}
        </Descriptions.Item>
      </Descriptions>

      <Button
        icon={<ReloadOutlined spin={refreshing} />}
        onClick={handleRefresh}
        loading={refreshing}
      >
        Refresh Metadata
      </Button>

      <Divider orientation="left">Tables</Divider>
      {refreshing ? (
        <Spin />
      ) : (
        <TableList tables={database.tables} views={[]} />
      )}

      {database.views.length > 0 && (
        <>
          <Divider orientation="left">Views</Divider>
          <TableList tables={[]} views={database.views} />
        </>
      )}
    </Space>
  );
}
