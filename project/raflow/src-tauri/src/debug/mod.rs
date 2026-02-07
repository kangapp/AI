// Debug mode module - 调试模式模块
// 提供调试状态管理和日志配置功能

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::str::FromStr;

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum LogLevel {
    /// TRACE 级别
    Trace,
    /// DEBUG 级别
    Debug,
    /// INFO 级别（默认）
    #[default]
    Info,
    /// WARN 级别
    Warn,
    /// ERROR 级别
    Error,
}

impl LogLevel {
    /// 转换为 tracing::Level
    pub fn as_tracing_level(&self) -> tracing::Level {
        match self {
            LogLevel::Trace => tracing::Level::TRACE,
            LogLevel::Debug => tracing::Level::DEBUG,
            LogLevel::Info => tracing::Level::INFO,
            LogLevel::Warn => tracing::Level::WARN,
            LogLevel::Error => tracing::Level::ERROR,
        }
    }

    /// 转换为 EnvFilter 指令字符串
    pub fn as_filter_directive(&self) -> String {
        match self {
            LogLevel::Trace => "trace",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
        .to_string()
    }
}

impl FromStr for LogLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "trace" => Ok(LogLevel::Trace),
            "debug" => Ok(LogLevel::Debug),
            "info" => Ok(LogLevel::Info),
            "warn" | "warning" => Ok(LogLevel::Warn),
            "error" => Ok(LogLevel::Error),
            _ => Err(format!("Invalid log level: {}", s)),
        }
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Trace => write!(f, "trace"),
            LogLevel::Debug => write!(f, "debug"),
            LogLevel::Info => write!(f, "info"),
            LogLevel::Warn => write!(f, "warn"),
            LogLevel::Error => write!(f, "error"),
        }
    }
}

/// 调试配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugConfig {
    /// 是否启用调试模式
    pub enabled: bool,
    /// 日志级别
    pub log_level: LogLevel,
    /// 包含的目标模块（白名单）
    pub include_targets: HashSet<String>,
    /// 排除的目标模块（黑名单）
    pub exclude_targets: HashSet<String>,
}

impl Default for DebugConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            log_level: LogLevel::default(),
            include_targets: HashSet::new(),
            exclude_targets: HashSet::new(),
        }
    }
}

impl DebugConfig {
    /// 创建配置构建器
    pub fn builder() -> DebugConfigBuilder {
        DebugConfigBuilder::default()
    }

    /// 从 DebugState 创建配置
    pub fn from_state(state: &DebugState) -> Self {
        DebugConfig {
            enabled: state.is_enabled(),
            log_level: state.log_level(),
            include_targets: state.include_targets().iter().cloned().collect(),
            exclude_targets: state.exclude_targets().iter().cloned().collect(),
        }
    }

    /// 构建环境过滤器指令字符串
    pub fn build_filter_directive(&self) -> String {
        let mut directives = Vec::new();

        // 添加基础级别
        directives.push(format!("{}", self.log_level));

        // 添加包含的目标
        for target in &self.include_targets {
            directives.push(format!("{}={}", target, self.log_level));
        }

        // 添加排除的目标
        for target in &self.exclude_targets {
            directives.push(format!("{}=off", target));
        }

        directives.join(",")
    }
}

/// 调试配置构建器
#[derive(Debug, Default)]
pub struct DebugConfigBuilder {
    config: DebugConfig,
}

impl DebugConfigBuilder {
    /// 设置是否启用
    pub fn enabled(mut self, enabled: bool) -> Self {
        self.config.enabled = enabled;
        self
    }

    /// 设置日志级别
    pub fn log_level(mut self, level: LogLevel) -> Self {
        self.config.log_level = level;
        self
    }

    /// 添加包含的目标
    pub fn include_target(mut self, target: impl Into<String>) -> Self {
        self.config.include_targets.insert(target.into());
        self
    }

    /// 添加排除的目标
    pub fn exclude_target(mut self, target: impl Into<String>) -> Self {
        self.config.exclude_targets.insert(target.into());
        self
    }

    /// 构建配置
    pub fn build(self) -> DebugConfig {
        self.config
    }
}

/// 调试状态
#[derive(Debug, Clone)]
pub struct DebugState {
    /// 是否启用调试模式
    enabled: bool,
    /// 日志级别
    log_level: LogLevel,
    /// 包含的目标模块（白名单）
    include_targets: HashSet<String>,
    /// 排除的目标模块（黑名单）
    exclude_targets: HashSet<String>,
}

impl Default for DebugState {
    fn default() -> Self {
        Self {
            enabled: false,
            log_level: LogLevel::default(),
            include_targets: HashSet::new(),
            exclude_targets: HashSet::new(),
        }
    }
}

impl DebugState {
    /// 创建新的调试状态
    pub fn new() -> Self {
        Self::default()
    }

    /// 从配置创建调试状态
    pub fn from_config(config: DebugConfig) -> Self {
        Self {
            enabled: config.enabled,
            log_level: config.log_level,
            include_targets: config.include_targets,
            exclude_targets: config.exclude_targets,
        }
    }

    /// 检查是否启用调试模式
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// 启用调试模式
    pub fn enable(&mut self) {
        self.enabled = true;
    }

    /// 禁用调试模式
    pub fn disable(&mut self) {
        self.enabled = false;
    }

    /// 切换调试模式
    pub fn toggle(&mut self) {
        self.enabled = !self.enabled;
    }

    /// 获取日志级别
    pub fn log_level(&self) -> LogLevel {
        self.log_level
    }

    /// 设置日志级别
    pub fn set_log_level(&mut self, level: LogLevel) {
        self.log_level = level;
    }

    /// 获取包含的目标模块
    pub fn include_targets(&self) -> &HashSet<String> {
        &self.include_targets
    }

    /// 添加包含的目标模块
    pub fn add_include_target(&mut self, target: impl Into<String>) {
        self.include_targets.insert(target.into());
    }

    /// 移除包含的目标模块
    pub fn remove_include_target(&mut self, target: &str) {
        self.include_targets.remove(target);
    }

    /// 获取排除的目标模块
    pub fn exclude_targets(&self) -> &HashSet<String> {
        &self.exclude_targets
    }

    /// 添加排除的目标模块
    pub fn add_exclude_target(&mut self, target: impl Into<String>) {
        self.exclude_targets.insert(target.into());
    }

    /// 移除排除的目标模块
    pub fn remove_exclude_target(&mut self, target: &str) {
        self.exclude_targets.remove(target);
    }

    /// 构建环境过滤器指令字符串
    pub fn build_filter_directive(&self) -> String {
        let config = DebugConfig::from_state(self);
        config.build_filter_directive()
    }

    /// 获取配置快照
    pub fn to_config(&self) -> DebugConfig {
        DebugConfig::from_state(self)
    }
}

/// 全局调试状态（使用 OnceLock 实现单例）
use std::sync::OnceLock;

static GLOBAL_DEBUG_STATE: OnceLock<parking_lot::Mutex<DebugState>> = OnceLock::new();

/// 获取全局调试状态
pub fn global_debug_state() -> &'static parking_lot::Mutex<DebugState> {
    GLOBAL_DEBUG_STATE.get_or_init(|| parking_lot::Mutex::new(DebugState::default()))
}

/// 检查是否启用调试模式（便捷函数）
pub fn is_debug_enabled() -> bool {
    global_debug_state().lock().is_enabled()
}

/// 启用调试模式（便捷函数）
pub fn enable_debug() {
    global_debug_state().lock().enable();
}

/// 禁用调试模式（便捷函数）
pub fn disable_debug() {
    global_debug_state().lock().disable();
}

/// 切换调试模式（便捷函数）
pub fn toggle_debug() {
    global_debug_state().lock().toggle();
}

/// 获取日志级别（便捷函数）
pub fn log_level() -> LogLevel {
    global_debug_state().lock().log_level()
}

/// 设置日志级别（便捷函数）
pub fn set_log_level(level: LogLevel) {
    global_debug_state().lock().set_log_level(level);
}

/// 初始化 tracing subscriber（在应用启动时调用）
///
/// 此函数根据全局调试状态配置 tracing 日志系统
pub fn init_tracing() {
    let state = global_debug_state().lock();
    let filter_directive = state.build_filter_directive();

    // 释放锁后再初始化 subscriber
    drop(state);

    // 配置 tracing subscriber
    let env_filter = tracing_subscriber::EnvFilter::try_new(filter_directive)
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .init();
}

/// 重新初始化 tracing subscriber（当调试状态改变时调用）
pub fn reload_tracing() {
    // 注意：tracing subscriber 不支持运行时重新加载
    // 此函数用于未来扩展，当前为空实现
    // 在实际应用中，可能需要使用 reload 功能或重启应用
}
