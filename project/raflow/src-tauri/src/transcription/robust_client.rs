// RobustScribeClient - 带断线重连机制的 ElevenLabs 客户端
// 实现指数退避重试策略、自动重连、连接状态跟踪

use super::messages::ScribeConfig;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// 连接状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    /// 未连接
    Disconnected,
    /// 连接中
    Connecting,
    /// 已连接
    Connected,
    /// 重连中
    Reconnecting,
}

/// RobustScribeClient - 带断线重连的转录客户端
pub struct RobustScribeClient {
    /// 配置
    config: ScribeConfig,
    /// 当前连接状态
    state: Arc<Mutex<ConnectionState>>,
    /// 重连尝试次数
    reconnect_attempts: Arc<Mutex<usize>>,
    /// 最大重连次数
    max_reconnect_attempts: usize,
    /// 初始退避时间
    initial_backoff: Duration,
    /// 最大退避时间
    max_backoff: Duration,
}

impl RobustScribeClient {
    /// 使用默认配置创建新的客户端
    pub fn new(config: ScribeConfig) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
            reconnect_attempts: Arc::new(Mutex::new(0)),
            max_reconnect_attempts: 10,
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_millis(30000),
        }
    }

    /// 使用自定义最大重连次数创建客户端
    pub fn with_max_attempts(config: ScribeConfig, max_attempts: usize) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
            reconnect_attempts: Arc::new(Mutex::new(0)),
            max_reconnect_attempts: max_attempts,
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_millis(30000),
        }
    }

    /// 使用自定义退避参数创建客户端
    pub fn with_backoff(
        config: ScribeConfig,
        initial_backoff: Duration,
        max_backoff: Duration,
    ) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
            reconnect_attempts: Arc::new(Mutex::new(0)),
            max_reconnect_attempts: 10,
            initial_backoff,
            max_backoff,
        }
    }

    /// 获取配置
    pub fn config(&self) -> &ScribeConfig {
        &self.config
    }

    /// 获取当前连接状态
    pub fn state(&self) -> ConnectionState {
        *self.state.lock().unwrap()
    }

    /// 设置连接状态
    pub fn set_state(&self, new_state: ConnectionState) {
        *self.state.lock().unwrap() = new_state;
    }

    /// 检查是否已连接
    pub fn is_connected(&self) -> bool {
        matches!(self.state(), ConnectionState::Connected)
    }

    /// 获取重连尝试次数
    pub fn reconnect_attempts(&self) -> usize {
        *self.reconnect_attempts.lock().unwrap()
    }

    /// 增加重连尝试次数
    pub fn increment_reconnect_attempts(&self) {
        let mut attempts = self.reconnect_attempts.lock().unwrap();
        *attempts += 1;
    }

    /// 重置重连尝试次数
    pub fn reset_reconnect_attempts(&self) {
        *self.reconnect_attempts.lock().unwrap() = 0;
    }

    /// 获取最大重连次数
    pub fn max_reconnect_attempts(&self) -> usize {
        self.max_reconnect_attempts
    }

    /// 计算退避时间（指数退避）
    pub fn backoff_duration(&self, attempt: usize) -> Duration {
        let base_ms = self.initial_backoff.as_millis() as u64;
        let max_ms = self.max_backoff.as_millis() as u64;

        // 指数退避: base * 2^attempt
        let duration_ms = (base_ms * 2_u64.pow(attempt as u32)).min(max_ms);

        Duration::from_millis(duration_ms)
    }

    /// 判断是否应该继续重连
    pub fn should_continue_reconnecting(&self) -> bool {
        self.reconnect_attempts() < self.max_reconnect_attempts
    }

    /// 处理连接错误
    pub fn handle_connection_error<E: std::error::Error>(&self, _error: &E) {
        self.increment_reconnect_attempts();

        if self.should_continue_reconnecting() {
            self.set_state(ConnectionState::Reconnecting);
        } else {
            // 达到最大重连次数，停止尝试
            self.set_state(ConnectionState::Disconnected);
        }
    }

    /// 处理连接建立
    pub fn handle_connection_established(&self) {
        self.reset_reconnect_attempts();
        self.set_state(ConnectionState::Connected);
    }

    /// 开始连接
    pub fn start_connecting(&self) {
        self.set_state(ConnectionState::Connecting);
        self.reset_reconnect_attempts();
    }

    /// 断开连接
    pub fn disconnect(&self) {
        self.reset_reconnect_attempts();
        self.set_state(ConnectionState::Disconnected);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_initial_state() {
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        assert_eq!(client.state(), ConnectionState::Disconnected);
        assert_eq!(client.reconnect_attempts(), 0);
        assert!(!client.is_connected());
    }

    #[test]
    fn test_backoff_calculation() {
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 验证指数退避
        assert_eq!(client.backoff_duration(0).as_millis(), 100);
        assert_eq!(client.backoff_duration(1).as_millis(), 200);
        assert_eq!(client.backoff_duration(2).as_millis(), 400);
        assert_eq!(client.backoff_duration(3).as_millis(), 800);
        assert_eq!(client.backoff_duration(4).as_millis(), 1600);
        assert_eq!(client.backoff_duration(5).as_millis(), 3200);
        assert_eq!(client.backoff_duration(6).as_millis(), 6400);
        assert_eq!(client.backoff_duration(7).as_millis(), 12800);
        assert_eq!(client.backoff_duration(8).as_millis(), 25600);
        assert_eq!(client.backoff_duration(9).as_millis(), 30000); // cap at max
        assert_eq!(client.backoff_duration(10).as_millis(), 30000);
    }

    #[test]
    fn test_reconnect_counter() {
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        assert_eq!(client.reconnect_attempts(), 0);

        client.increment_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 1);

        client.increment_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 2);

        client.reset_reconnect_attempts();
        assert_eq!(client.reconnect_attempts(), 0);
    }

    #[test]
    fn test_should_continue_reconnecting() {
        let config = ScribeConfig::default();
        let client = RobustScribeClient::new(config);

        // 0-9 次应该继续
        for _ in 0..10 {
            assert!(client.should_continue_reconnecting());
            client.increment_reconnect_attempts();
        }

        // 第 10 次应该停止
        assert!(!client.should_continue_reconnecting());
    }

    #[test]
    fn test_custom_max_attempts() {
        let config = ScribeConfig::default();
        let client = RobustScribeClient::with_max_attempts(config, 3);

        assert_eq!(client.max_reconnect_attempts(), 3);

        // 3 次内应该继续
        for _ in 0..3 {
            assert!(client.should_continue_reconnecting());
            client.increment_reconnect_attempts();
        }

        // 第 4 次应该停止
        assert!(!client.should_continue_reconnecting());
    }

    #[test]
    fn test_custom_backoff() {
        let config = ScribeConfig::default();
        let client = RobustScribeClient::with_backoff(
            config,
            Duration::from_millis(50),
            Duration::from_millis(5000),
        );

        assert_eq!(client.backoff_duration(0).as_millis(), 50);
        assert_eq!(client.backoff_duration(1).as_millis(), 100);
        assert_eq!(client.backoff_duration(7).as_millis(), 5000); // cap at custom max
    }
}
