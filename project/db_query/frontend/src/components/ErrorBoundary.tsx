import { Component, ErrorInfo, ReactNode } from "react";
import { Button, Result, Typography } from "antd";

const { Paragraph, Text } = Typography;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree.
 * Displays a fallback UI when an error occurs.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service (in production)
    console.error("Error caught by ErrorBoundary:", error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;

      return (
        <div style={{ padding: "50px", textAlign: "center" }}>
          <Result
            status="error"
            title="应用程序出错了"
            subTitle="抱歉，应用程序遇到了意外错误。您可以尝试刷新页面或重置应用状态。"
            extra={[
              <Button type="primary" key="reset" onClick={this.handleReset}>
                重置应用
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
            ]}
          >
            <div style={{ textAlign: "left", maxWidth: "600px", margin: "0 auto" }}>
              <Paragraph>
                <Text strong>错误详情：</Text>
              </Paragraph>
              <Paragraph>
                <Text type="danger">{error?.toString()}</Text>
              </Paragraph>
              {errorInfo && (
                <details style={{ marginTop: "16px" }}>
                  <summary style={{ cursor: "pointer", marginBottom: "8px" }}>
                    <Text type="secondary">查看堆栈跟踪</Text>
                  </summary>
                  <pre
                    style={{
                      background: "#f5f5f5",
                      padding: "12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      overflow: "auto",
                      maxHeight: "300px",
                    }}
                  >
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}
