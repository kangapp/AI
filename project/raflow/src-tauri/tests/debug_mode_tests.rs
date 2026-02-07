// Debug mode tests - 调试模式测试
// 测试调试状态管理和调试命令

use raflow::debug::{DebugState, DebugConfig, LogLevel};
use std::str::FromStr;

#[test]
fn test_debug_state_default() {
    let state = DebugState::default();

    assert!(!state.is_enabled());
    assert_eq!(state.log_level(), LogLevel::Info);
}

#[test]
fn test_debug_state_enable() {
    let mut state = DebugState::default();

    state.enable();
    assert!(state.is_enabled());
}

#[test]
fn test_debug_state_disable() {
    let mut state = DebugState::default();

    state.enable();
    assert!(state.is_enabled());

    state.disable();
    assert!(!state.is_enabled());
}

#[test]
fn test_debug_state_toggle() {
    let mut state = DebugState::default();

    assert!(!state.is_enabled());

    state.toggle();
    assert!(state.is_enabled());

    state.toggle();
    assert!(!state.is_enabled());
}

#[test]
fn test_debug_state_set_log_level() {
    let mut state = DebugState::default();

    state.set_log_level(LogLevel::Debug);
    assert_eq!(state.log_level(), LogLevel::Debug);

    state.set_log_level(LogLevel::Trace);
    assert_eq!(state.log_level(), LogLevel::Trace);
}

#[test]
fn test_debug_config_default() {
    let config = DebugConfig::default();

    assert!(!config.enabled);
    assert_eq!(config.log_level, LogLevel::Info);
    assert!(config.include_targets.is_empty());
    assert!(config.exclude_targets.is_empty());
}

#[test]
fn test_debug_config_builder() {
    let config = DebugConfig::builder()
        .enabled(true)
        .log_level(LogLevel::Debug)
        .include_target("raflow::audio")
        .include_target("raflow::transcription")
        .exclude_target("raflow::perf")
        .build();

    assert!(config.enabled);
    assert_eq!(config.log_level, LogLevel::Debug);
    assert_eq!(config.include_targets.len(), 2);
    assert_eq!(config.exclude_targets.len(), 1);
    assert!(config.include_targets.contains(&"raflow::audio".to_string()));
    assert!(config.exclude_targets.contains(&"raflow::perf".to_string()));
}

#[test]
fn test_debug_config_from_state() {
    let mut state = DebugState::default();
    state.enable();
    state.set_log_level(LogLevel::Debug);

    let config = DebugConfig::from_state(&state);

    assert!(config.enabled);
    assert_eq!(config.log_level, LogLevel::Debug);
}

#[test]
fn test_debug_state_from_config() {
    let config = DebugConfig::builder()
        .enabled(true)
        .log_level(LogLevel::Trace)
        .build();

    let state = DebugState::from_config(config);

    assert!(state.is_enabled());
    assert_eq!(state.log_level(), LogLevel::Trace);
}

#[test]
fn test_log_level_from_str() {
    assert_eq!(LogLevel::from_str("trace"), Ok(LogLevel::Trace));
    assert_eq!(LogLevel::from_str("debug"), Ok(LogLevel::Debug));
    assert_eq!(LogLevel::from_str("info"), Ok(LogLevel::Info));
    assert_eq!(LogLevel::from_str("warn"), Ok(LogLevel::Warn));
    assert_eq!(LogLevel::from_str("error"), Ok(LogLevel::Error));

    // Test case insensitivity
    assert_eq!(LogLevel::from_str("DEBUG"), Ok(LogLevel::Debug));
    assert_eq!(LogLevel::from_str("Info"), Ok(LogLevel::Info));

    // Test invalid input
    assert!(LogLevel::from_str("invalid").is_err());
}

#[test]
fn test_log_level_display() {
    assert_eq!(LogLevel::Trace.to_string(), "trace");
    assert_eq!(LogLevel::Debug.to_string(), "debug");
    assert_eq!(LogLevel::Info.to_string(), "info");
    assert_eq!(LogLevel::Warn.to_string(), "warn");
    assert_eq!(LogLevel::Error.to_string(), "error");
}

#[test]
fn test_log_level_as_tracing_level() {
    use tracing::Level;

    assert_eq!(LogLevel::Trace.as_tracing_level(), Level::TRACE);
    assert_eq!(LogLevel::Debug.as_tracing_level(), Level::DEBUG);
    assert_eq!(LogLevel::Info.as_tracing_level(), Level::INFO);
    assert_eq!(LogLevel::Warn.as_tracing_level(), Level::WARN);
    assert_eq!(LogLevel::Error.as_tracing_level(), Level::ERROR);
}
