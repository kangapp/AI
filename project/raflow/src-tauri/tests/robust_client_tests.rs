// RobustScribeClient 测试 - 断线重连机制
// 测试指数退避重试策略、自动重连、连接状态跟踪

use raflow::transcription::robust_client::{ConnectionState, RobustScribeClient};
use raflow::transcription::messages::ScribeConfig;
use std::time::Duration;

#[cfg(test)]
mod robust_client_tests {
    use super::*;

    // ===== RED PHASE: 编写失败的测试 =====

    #[tokio::test]
    async fn test_client_creation_with_default_config() {
        // 测试：使用默认配置创建客户端
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 验证初始状态为 Disconnected
        assert_eq!(client.state(), ConnectionState::Disconnected);
        assert_eq!(client.reconnect_attempts(), 0);
        assert!(!client.is_connected());
    }

    #[tokio::test]
    async fn test_exponential_backoff_calculation() {
        // 测试：指数退避计算
        // 初始 100ms，最大 30s，指数增长
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 第1次重试: 100ms
        assert_eq!(client.backoff_duration(0), Duration::from_millis(100));
        // 第2次重试: 200ms
        assert_eq!(client.backoff_duration(1), Duration::from_millis(200));
        // 第3次重试: 400ms
        assert_eq!(client.backoff_duration(2), Duration::from_millis(400));
        // 第4次重试: 800ms
        assert_eq!(client.backoff_duration(3), Duration::from_millis(800));
        // 第5次重试: 1600ms
        assert_eq!(client.backoff_duration(4), Duration::from_millis(1600));
        // 第6次重试: 3200ms
        assert_eq!(client.backoff_duration(5), Duration::from_millis(3200));
        // 第7次重试: 6400ms
        assert_eq!(client.backoff_duration(6), Duration::from_millis(6400));
        // 第8次重试: 12800ms
        assert_eq!(client.backoff_duration(7), Duration::from_millis(12800));
        // 第9次重试: 25600ms
        assert_eq!(client.backoff_duration(8), Duration::from_millis(25600));
        // 第10次重试: 30000ms (达到最大值)
        assert_eq!(client.backoff_duration(9), Duration::from_millis(30000));
        // 第11次重试: 30000ms (保持最大值)
        assert_eq!(client.backoff_duration(10), Duration::from_millis(30000));
    }

    #[tokio::test]
    async fn test_max_reconnect_attempts() {
        // 测试：最大重连次数限制
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 默认最大重连次数为 10
        assert_eq!(client.max_reconnect_attempts(), 10);
    }

    #[tokio::test]
    async fn test_connection_state_transitions() {
        // 测试：连接状态转换
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 初始状态
        assert_eq!(client.state(), ConnectionState::Disconnected);

        // 模拟状态转换到 Connecting
        client.set_state(ConnectionState::Connecting);
        assert_eq!(client.state(), ConnectionState::Connecting);

        // 模拟状态转换到 Connected
        client.set_state(ConnectionState::Connected);
        assert_eq!(client.state(), ConnectionState::Connected);
        assert!(client.is_connected());

        // 模拟状态转换到 Reconnecting
        client.set_state(ConnectionState::Reconnecting);
        assert_eq!(client.state(), ConnectionState::Reconnecting);
    }

    #[tokio::test]
    async fn test_reconnect_attempt_counter() {
        // 测试：重连尝试计数器
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 初始计数为 0
        assert_eq!(client.reconnect_attempts(), 0);

        // 增加重连尝试
        client.increment_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 1);

        client.increment_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 2);

        client.increment_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 3);

        // 重置计数器
        client.reset_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 0);
    }

    #[tokio::test]
    async fn test_should_continue_reconnecting() {
        // 测试：是否应该继续重连
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 在最大尝试次数内应该继续重连
        for i in 0..10 {
            assert!(client.should_continue_reconnecting(), "Attempt {} should continue", i);
            client.increment_reconnect_attempts();
        }

        // 超过最大尝试次数应该停止
        assert!(!client.should_continue_reconnecting(), "Should stop after max attempts");
    }

    #[tokio::test]
    async fn test_config_custom_max_attempts() {
        // 测试：自定义最大重连次数
        let config = ScribeConfig::default();
        let client = RobustScribeClient::with_max_attempts(config, 5);

        assert_eq!(client.max_reconnect_attempts(), 5);

        // 5次内应该继续
        for _ in 0..5 {
            assert!(client.should_continue_reconnecting());
            client.increment_reconnect_attempts();
        }

        // 第6次应该停止
        assert!(!client.should_continue_reconnecting());
    }

    #[tokio::test]
    async fn test_config_custom_backoff_limits() {
        // 测试：自定义退避参数
        let config = ScribeConfig::default();
        let client = RobustScribeClient::with_backoff(
            config,
            Duration::from_millis(50),  // 初始
            Duration::from_millis(5000), // 最大
        );

        // 验证自定义退避时间
        assert_eq!(client.backoff_duration(0), Duration::from_millis(50));
        assert_eq!(client.backoff_duration(1), Duration::from_millis(100));
        assert_eq!(client.backoff_duration(7), Duration::from_millis(5000)); // 达到最大值
    }

    #[tokio::test]
    async fn test_connection_failure_detection() {
        // 测试：连接失败检测
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 模拟连接失败
        client.handle_connection_error(&std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            "Connection refused",
        ));

        // 状态应该变为 Reconnecting
        assert_eq!(client.state(), ConnectionState::Reconnecting);
        // 重连计数应该增加
        assert_eq!(client.reconnect_attempts(), 1);
    }

    #[tokio::test]
    async fn test_successful_connection_resets_counter() {
        // 测试：成功连接后重置计数器
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 模拟几次失败
        for _ in 0..3 {
            client.handle_connection_error(&std::io::Error::new(
                std::io::ErrorKind::ConnectionRefused,
                "Connection refused",
            ));
        }

        assert_eq!(client.reconnect_attempts(), 3);

        // 模拟成功连接
        client.handle_connection_established();

        // 状态应该是 Connected
        assert_eq!(client.state(), ConnectionState::Connected);
        // 计数器应该重置
        assert_eq!(client.reconnect_attempts(), 0);
    }

    #[tokio::test]
    async fn test_max_reconnects_exhausted() {
        // 测试：达到最大重连次数后停止
        let config = ScribeConfig {
            api_key: "test".to_string(),
            ..Default::default()
        };
        let client = RobustScribeClient::with_max_attempts(config, 3);

        // 模拟3次失败
        for _ in 0..3 {
            client.handle_connection_error(&std::io::Error::new(
                std::io::ErrorKind::ConnectionRefused,
                "Connection refused",
            ));
        }

        // 第4次失败时应该停止重连
        assert!(!client.should_continue_reconnecting());
        // 状态应该是 Disconnected (停止尝试)
        assert_eq!(client.state(), ConnectionState::Disconnected);
    }
}
