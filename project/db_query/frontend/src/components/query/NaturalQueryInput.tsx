/**
 * Natural language query input component.
 */

import { useState, useEffect } from "react";
import { Button, Input, Modal, Space, Typography, Alert, Spin, Card, Tag } from "antd";
import { ThunderboltOutlined, CheckCircleOutlined, ExclamationCircleOutlined, BulbOutlined, FireOutlined } from "@ant-design/icons";
import type { NaturalQueryResponse } from "../../types";
import { api } from "../../services/api";

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface NaturalQueryInputProps {
  databaseName: string;
  onQueryGenerated: (sql: string) => void;
  onQueryExecuted?: (response: NaturalQueryResponse) => void;
  disabled?: boolean;
}

export const NaturalQueryInput: React.FC<NaturalQueryInputProps> = ({
  databaseName,
  onQueryGenerated,
  onQueryExecuted,
  disabled = false,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Load suggested queries when database changes
  useEffect(() => {
    const loadSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const response = await api.getSuggestedQueries(databaseName, 6);
        setSuggestedQueries(response.suggestions);
      } catch (err) {
        console.error("Failed to load suggested queries:", err);
        setSuggestedQueries([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    loadSuggestions();
  }, [databaseName]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.naturalQuery(databaseName, prompt.trim(), false);

      if (response.success && response.isValid) {
        setGeneratedSql(response.generatedSql);
        setExplanation(response.explanation);
        setShowConfirmModal(true);
      } else {
        setError(response.validationMessage || "Failed to generate SQL");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate SQL");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (!generatedSql) {
      return;
    }

    setLoading(true);
    setShowConfirmModal(false);

    try {
      const response = await api.naturalQuery(databaseName, prompt.trim(), true);

      if (response.success) {
        onQueryGenerated(response.generatedSql);
        if (onQueryExecuted) {
          onQueryExecuted(response);
        }
      } else {
        setError(response.validationMessage || "Query execution failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query execution failed");
    } finally {
      setLoading(false);
      setGeneratedSql(null);
      setExplanation(null);
      setPrompt("");
    }
  };

  const handleEditAndExecute = () => {
    if (generatedSql) {
      onQueryGenerated(generatedSql);
      setShowConfirmModal(false);
      setGeneratedSql(null);
      setExplanation(null);
    }
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
    setGeneratedSql(null);
    setExplanation(null);
  };

  return (
    <>
      <Card
        bordered={false}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: "24px" }}>
          {/* 标题区域 */}
          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(255, 255, 255, 0.2)",
                padding: "12px 24px",
                borderRadius: "50px",
                backdropFilter: "blur(10px)",
              }}
            >
              <ThunderboltOutlined style={{ fontSize: "24px", color: "#FFD700" }} />
              <Text strong style={{ fontSize: "18px", color: "#fff", margin: 0 }}>
                AI 智能查询
              </Text>
            </div>
            <Paragraph
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                marginTop: "12px",
                marginBottom: 0,
                fontSize: "14px",
              }}
            >
              用自然语言描述你的需求，AI 将自动生成 SQL 查询语句
            </Paragraph>
          </div>

          {/* 输入区域 */}
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "16px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            }}
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：显示所有产品价格大于50的商品，按价格降序排列"
              autoSize={{ minRows: 3, maxRows: 6 }}
              disabled={disabled || loading}
              onPressEnter={(e) => {
                if (e.shiftKey) return;
                e.preventDefault();
                handleGenerate();
              }}
              style={{
                border: "none",
                boxShadow: "none",
                fontSize: "15px",
                resize: "none",
              }}
            />

            {/* 操作按钮 */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                marginTop: "16px",
                gap: "12px",
              }}
            >
              <Text type="secondary" style={{ fontSize: "13px", marginRight: "auto" }}>
                按 Enter 快速生成，Shift + Enter 换行
              </Text>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleGenerate}
                disabled={disabled || loading || !prompt.trim()}
                loading={loading}
                size="large"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: "8px",
                  height: "44px",
                  paddingLeft: "24px",
                  paddingRight: "24px",
                  fontSize: "15px",
                  fontWeight: 500,
                }}
              >
                生成 SQL
              </Button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert
              message="生成失败"
              description={error}
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              closable
              onClose={() => setError(null)}
              style={{
                marginTop: "16px",
                borderRadius: "8px",
                border: "none",
              }}
            />
          )}

          {/* 猜你想搜 */}
          {!loadingSuggestions && suggestedQueries.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                <FireOutlined style={{ color: "#FFD700", fontSize: "16px" }} />
                <Text strong style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: "14px" }}>
                  猜你想搜
                </Text>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {suggestedQueries.map((suggestion, index) => (
                  <Tag
                    key={index}
                    closable={false}
                    style={{
                      background: "rgba(255, 255, 255, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: "#fff",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      margin: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    onClick={() => {
                      setPrompt(suggestion);
                    }}
                  >
                    {suggestion}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {loadingSuggestions && (
            <div
              style={{
                marginTop: "20px",
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              <Spin size="small" /> 正在生成建议...
            </div>
          )}
        </div>
      </Card>

      {/* 成功弹窗 */}
      <Modal
        title={null}
        open={showConfirmModal}
        onCancel={handleCancel}
        footer={null}
        width={680}
        centered
        closeIcon={<span style={{ color: "#fff", fontSize: "20px" }}>✕</span>}
        style={{
          background: "transparent",
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          }}
        >
          {/* 弹窗头部 */}
          <div
            style={{
              background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
              padding: "24px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircleOutlined style={{ fontSize: "36px", color: "#fff" }} />
            </div>
            <Text
              strong
              style={{
                fontSize: "22px",
                color: "#fff",
                display: "block",
              }}
            >
              SQL 生成成功
            </Text>
          </div>

          {/* 弹窗内容 */}
          <Spin spinning={loading}>
            <div style={{ padding: "32px" }}>
              {explanation && (
                <Alert
                  icon={<BulbOutlined style={{ color: "#1890ff" }} />}
                  message={
                    <Text strong style={{ fontSize: "15px" }}>
                      说明
                    </Text>
                  }
                  description={
                    <Text style={{ fontSize: "14px", color: "#595959" }}>
                      {explanation}
                    </Text>
                  }
                  type="info"
                  showIcon
                  style={{
                    marginBottom: "24px",
                    borderRadius: "8px",
                    border: "1px solid #91d5ff",
                    background: "#e6f7ff",
                  }}
                />
              )}

              <div>
                <Text
                  strong
                  style={{
                    fontSize: "15px",
                    color: "#262626",
                    display: "block",
                    marginBottom: "12px",
                  }}
                >
                  生成的 SQL:
                </Text>
                <pre
                  style={{
                    background: "#282c34",
                    color: "#abb2bf",
                    padding: "20px",
                    borderRadius: "10px",
                    margin: 0,
                    overflow: "auto",
                    maxHeight: "240px",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    fontFamily: "Monaco, Menlo, 'Ubuntu Mono', Consolas, source-code-pro, monospace",
                  }}
                >
                  {generatedSql}
                </pre>
              </div>
            </div>
          </Spin>

          {/* 弹窗底部按钮 */}
          <div
            style={{
              padding: "20px 32px",
              borderTop: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              background: "#fafafa",
            }}
          >
            <Button
              onClick={handleCancel}
              style={{
                borderRadius: "8px",
                height: "40px",
                paddingLeft: "20px",
                paddingRight: "20px",
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleEditAndExecute}
              style={{
                borderRadius: "8px",
                height: "40px",
                paddingLeft: "20px",
                paddingRight: "20px",
              }}
            >
              在 SQL 编辑器中编辑
            </Button>
            <Button
              type="primary"
              onClick={handleConfirmExecute}
              loading={loading}
              style={{
                background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                border: "none",
                borderRadius: "8px",
                height: "40px",
                paddingLeft: "24px",
                paddingRight: "24px",
                fontWeight: 500,
              }}
            >
              立即执行
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default NaturalQueryInput;
