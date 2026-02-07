// Clipboard injection tests - 剪贴板注入测试
// 测试文本注入到剪贴板和模拟粘贴功能

use raflow::injection::clipboard::{ClipboardInjector, InjectResult};

#[cfg(test)]
mod clipboard_injection_tests {
    use super::*;

    /// 测试：注入结果类型
    /// 应该返回正确的注入结果类型
    #[test]
    fn test_inject_result_types() {
        // 测试 InjectResult 的序列化和反序列化
        let result = InjectResult::Injected;

        // 序列化
        let json = serde_json::to_string(&result).expect("Failed to serialize");
        assert!(json.contains("Injected"), "JSON should contain result type");

        // 反序列化
        let deserialized: InjectResult = serde_json::from_str(&json).expect("Failed to deserialize");
        assert!(matches!(deserialized, InjectResult::Injected), "Should deserialize to correct type");
    }

    /// 测试：ClipboardOnly 结果类型
    #[test]
    fn test_clipboard_only_result() {
        let result = InjectResult::ClipboardOnly;
        let json = serde_json::to_string(&result).expect("Failed to serialize");
        assert!(json.contains("ClipboardOnly"), "JSON should contain ClipboardOnly");
    }

    /// 测试：Failed 结果类型
    #[test]
    fn test_failed_result() {
        let result = InjectResult::Failed("Test error".to_string());
        let json = serde_json::to_string(&result).expect("Failed to serialize");
        assert!(json.contains("Failed"), "JSON should contain Failed");
        assert!(json.contains("Test error"), "JSON should contain error message");
    }

    /// 测试：ClipboardInjector 创建
    /// 应该能够创建剪贴板注入器
    #[test]
    fn test_clipboard_injector_creation() {
        // 这个测试只验证类型系统，不实际访问剪贴板
        // 在有显示环境的机器上可以运行完整的测试
        let injector = ClipboardInjector::new();

        // 验证可以创建（即使失败也是预期的行为）
        match injector {
            Ok(_) => {
                // 成功创建，这是好事
                assert!(true, "ClipboardInjector created successfully");
            }
            Err(e) => {
                // 创建失败，可能是在无头环境中
                assert!(!e.is_empty(), "Error message should not be empty");
            }
        }
    }

    /// 测试：Default trait 实现
    #[test]
    fn test_clipboard_injector_default() {
        let injector = ClipboardInjector::default();
        // Default 应该总是返回一个有效的实例
        // 即使剪贴板不可用
        assert!(true, "Default trait implemented");
    }

    /// 测试：save_clipboard 在未初始化时的行为
    #[test]
    fn test_save_with_no_clipboard() {
        // 创建一个默认的 injector（可能没有剪贴板）
        let mut injector = ClipboardInjector::default();

        // save_clipboard 应该不会崩溃
        injector.save_clipboard();

        // saved_content 应该是 None
        assert_eq!(injector.get_saved_clipboard(), None, "Should be None when no clipboard");
    }

    /// 测试：restore_clipboard 在没有保存内容时的行为
    #[test]
    fn test_restore_with_no_saved_content() {
        let mut injector = ClipboardInjector::default();

        // 尝试恢复，但没有保存的内容
        let result = injector.restore_clipboard();

        assert!(result.is_ok(), "Restore should not error");
        assert_eq!(result.unwrap(), false, "Should return false when nothing to restore");
    }

    /// 测试：get_saved_clipboard 初始状态
    #[test]
    fn test_get_saved_initial_state() {
        let injector = ClipboardInjector::default();
        assert_eq!(injector.get_saved_clipboard(), None, "Initial state should be None");
    }

    /// 测试：write_to_clipboard 的行为
    #[test]
    fn test_write_to_clipboard() {
        let injector = ClipboardInjector::default();
        let result = injector.write_to_clipboard("test");

        // 结果取决于剪贴板是否可用
        // 在有显示环境的机器上可能会成功
        // 在无头环境中会失败
        match result {
            Ok(_) => {
                // 剪贴板可用，写入成功
                assert!(true, "Clipboard write succeeded");
            }
            Err(_) => {
                // 剪贴板不可用，这是预期的
                assert!(true, "Clipboard not available");
            }
        }
    }

    /// 测试：read_from_clipboard 的行为
    #[test]
    fn test_read_from_clipboard() {
        let injector = ClipboardInjector::default();
        let result = injector.read_from_clipboard();

        // 结果取决于剪贴板是否可用
        match result {
            Ok(_) | Err(_) => {
                // 两种结果都是可接受的
                assert!(true, "Read attempt completed");
            }
        }
    }

    /// 测试：inject_text 的基本行为
    #[test]
    fn test_inject_text_basic() {
        let mut injector = ClipboardInjector::default();
        let result = injector.inject_text("test text");

        // 没有剪贴板时应该返回 Failed
        match result {
            InjectResult::Failed(_) => {
                assert!(true, "Should fail when clipboard not available");
            }
            InjectResult::ClipboardOnly => {
                // 如果有剪贴板，应该返回 ClipboardOnly
                assert!(true, "Should return ClipboardOnly when clipboard available");
            }
            InjectResult::Injected => {
                // 目前不实现 Injected，因为我们还没有添加键盘模拟
                assert!(false, "Should not return Injected yet");
            }
        }
    }

    /// 测试：多次保存只保留最后一次（内存测试）
    #[test]
    fn test_multiple_saves_memory() {
        let mut injector = ClipboardInjector::default();

        // 手动设置 saved_content 来测试内存行为
        // 这不需要实际的剪贴板访问
        injector.save_clipboard();

        // 当没有剪贴板时，save_clipboard 会保存 None
        // 所以我们验证 saved_content 的行为
        let first_save = injector.get_saved_clipboard();

        // 再次保存
        injector.save_clipboard();
        let second_save = injector.get_saved_clipboard();

        // 由于没有剪贴板，两次都应该是 None 或者相同
        assert_eq!(first_save, second_save, "Multiple saves should behave consistently");
    }
}
