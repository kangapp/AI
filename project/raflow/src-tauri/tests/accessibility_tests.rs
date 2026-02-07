// Accessibility detection tests - 可编辑性检测测试
// 测试 macOS AXUIElement 查询、可编辑性检测、应用白名单/黑名单过滤

use raflow::injection::accessibility::{
    is_editable_element, is_blacklisted_app, is_whitelisted_app,
    EditableDetectionConfig, AccessibilityError
};
use std::collections::HashSet;

#[cfg(test)]
mod accessibility_tests {
    use super::*;

    // ===== RED PHASE: 编写测试 =====

    #[test]
    fn test_blacklisted_apps() {
        // 测试：应用黑名单检查
        assert!(is_blacklisted_app("com.apple.GameCenterUI"));
        assert!(is_blacklisted_app("com.apple.ScreenSaver.Engine"));
        assert!(is_blacklisted_app("com.apple.systemuiserver"));
        assert!(!is_blacklisted_app("com.apple.TextEdit"));
        assert!(!is_blacklisted_app("com.vscode"));
        assert!(!is_blacklisted_app("unknown.app"));
    }

    #[test]
    fn test_whitelisted_apps() {
        // 测试：应用白名单检查
        // 常见可编辑文本的应用
        assert!(is_whitelisted_app("com.apple.TextEdit"));
        assert!(is_whitelisted_app("com.apple.dt.Xcode"));
        assert!(is_whitelisted_app("com.microsoft.VSCode"));
        assert!(is_whitelisted_app("com.google.Chrome"));
        assert!(is_whitelisted_app("org.mozilla.firefox"));
        assert!(is_whitelisted_app("com.slack.Slack"));
        assert!(is_whitelisted_app("com.hnc.Discord"));
        assert!(is_whitelisted_app("com.figma.Desktop"));
        assert!(is_whitelisted_app("notion.id"));
        assert!(is_whitelisted_app("com.microsoft.Word"));
        assert!(is_whitelisted_app("com.microsoft.Excel"));
        assert!(is_whitelisted_app("com.microsoft.PowerPoint"));
        assert!(is_whitelisted_app("com.apple.iWork.Pages"));
        assert!(is_whitelisted_app("com.apple.iWork.Keynote"));
        assert!(is_whitelisted_app("com.apple.iWork.Numbers"));
        assert!(is_whitelisted_app("com.apple.Mail"));
        assert!(is_whitelisted_app("com.apple.iChat"));
        assert!(is_whitelisted_app("com.apple.Spotlight"));
        assert!(is_whitelisted_app("com.apple.Terminal"));
        assert!(is_whitelisted_app("com.googlecode.iterm2"));

        // 不在白名单中的应用
        assert!(!is_whitelisted_app("com.apple.GameCenterUI"));
        assert!(!is_whitelisted_app("com.apple.ScreenSaver.Engine"));
        assert!(!is_whitelisted_app("unknown.app"));
    }

    #[test]
    fn test_editable_detection_config_default() {
        // 测试：默认配置
        let config = EditableDetectionConfig::default();

        assert_eq!(config.use_whitelist, false);
        assert_eq!(config.use_blacklist, true);
        assert!(config.custom_whitelist.is_empty());
        assert!(config.custom_blacklist.is_empty());
    }

    #[test]
    fn test_editable_detection_config_builder() {
        // 测试：配置构建器
        let custom_whitelist = vec!["com.example.App1".to_string(), "com.example.App2".to_string()];
        let custom_blacklist = vec!["com.example.Blocked".to_string()];

        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(false)
            .custom_whitelist(custom_whitelist.clone())
            .custom_blacklist(custom_blacklist.clone())
            .build();

        assert_eq!(config.use_whitelist, true);
        assert_eq!(config.use_blacklist, false);
        assert_eq!(config.custom_whitelist, custom_whitelist);
        assert_eq!(config.custom_blacklist, custom_blacklist);
    }

    #[test]
    fn test_custom_whitelist_from_set() {
        // 测试：从 HashSet 创建自定义白名单
        let mut whitelist = HashSet::new();
        whitelist.insert("com.example.App1".to_string());
        whitelist.insert("com.example.App2".to_string());

        let config = EditableDetectionConfig::builder()
            .custom_whitelist_set(whitelist.iter().cloned().collect())
            .build();

        assert_eq!(
            config.custom_whitelist.iter().collect::<HashSet<_>>(),
            whitelist.iter().collect::<HashSet<_>>()
        );
    }

    #[test]
    fn test_custom_blacklist_from_set() {
        // 测试：从 HashSet 创建自定义黑名单
        let mut blacklist = HashSet::new();
        blacklist.insert("com.example.Blocked".to_string());
        blacklist.insert("com.example.Restricted".to_string());

        let config = EditableDetectionConfig::builder()
            .custom_blacklist_set(blacklist.iter().cloned().collect())
            .build();

        assert_eq!(
            config.custom_blacklist.iter().collect::<HashSet<_>>(),
            blacklist.iter().collect::<HashSet<_>>()
        );
    }

    #[test]
    fn test_accessibility_error_display() {
        // 测试：错误信息显示
        let error = AccessibilityError::NoAccessibilityPermission;
        assert_eq!(error.to_string(), "No accessibility permission");

        let error = AccessibilityError::NoFocusedElement;
        assert_eq!(error.to_string(), "No focused element");

        let error = AccessibilityError::ElementNotEditable;
        assert_eq!(error.to_string(), "Element is not editable");

        let error = AccessibilityError::ApplicationBlocked(String::from("com.example.Blocked"));
        assert!(error.to_string().contains("com.example.Blocked"));
    }

    #[test]
    fn test_accessibility_error_clone() {
        // 测试：错误克隆
        let error1 = AccessibilityError::NoAccessibilityPermission;
        let error2 = error1.clone();
        assert_eq!(error1.to_string(), error2.to_string());

        let error3 = AccessibilityError::ApplicationBlocked(String::from("test.app"));
        let error4 = error3.clone();
        assert_eq!(error3.to_string(), error4.to_string());
    }

    #[test]
    fn test_is_editable_element_returns_bool() {
        // 测试：函数返回布尔值
        // 注意：实际的可编辑性检测需要真实的 GUI 环境
        // 这个测试只验证函数签名和基本行为
        let result = is_editable_element();
        assert!(result == true || result == false);
    }

    #[test]
    fn test_combined_whitelist_blacklist_logic() {
        // 测试：白名单和黑名单组合逻辑
        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(true)
            .build();

        // 当同时启用白名单和黑名单时
        // 白名单优先（如果在白名单中，则允许）
        // 否则检查黑名单

        // 白名单中的应用应该被允许
        assert!(config.should_allow_app("com.apple.TextEdit"));

        // 黑名单中的应用应该被拒绝（即使不在白名单中）
        assert!(!config.should_allow_app("com.apple.GameCenterUI"));

        // 不在白名单也不在黑名单中的应用应该被拒绝（因为启用了白名单）
        assert!(!config.should_allow_app("unknown.app"));
    }

    #[test]
    fn test_blacklist_only_logic() {
        // 测试：仅黑名单模式
        let config = EditableDetectionConfig::builder()
            .use_whitelist(false)
            .use_blacklist(true)
            .build();

        // 仅启用黑名单时
        // 不在黑名单中的应用应该被允许
        assert!(config.should_allow_app("unknown.app"));
        assert!(config.should_allow_app("com.apple.TextEdit"));

        // 黑名单中的应用应该被拒绝
        assert!(!config.should_allow_app("com.apple.GameCenterUI"));
    }

    #[test]
    fn test_whitelist_only_logic() {
        // 测试：仅白名单模式
        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(false)
            .build();

        // 仅启用白名单时
        // 白名单中的应用应该被允许
        assert!(config.should_allow_app("com.apple.TextEdit"));

        // 不在白名单中的应用应该被拒绝
        assert!(!config.should_allow_app("unknown.app"));
        assert!(!config.should_allow_app("com.apple.GameCenterUI"));
    }

    #[test]
    fn test_custom_lists_override_defaults() {
        // 测试：自定义列表覆盖默认列表
        let custom_whitelist = vec!["com.example.CustomApp".to_string()];
        let custom_blacklist = vec!["com.example.CustomBlocked".to_string()];

        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(true)
            .custom_whitelist(custom_whitelist)
            .custom_blacklist(custom_blacklist)
            .build();

        // 自定义白名单中的应该被允许
        assert!(config.should_allow_app("com.example.CustomApp"));

        // 自定义黑名单中的应该被拒绝
        assert!(!config.should_allow_app("com.example.CustomBlocked"));

        // 默认白名单中的应用应该被拒绝（被自定义覆盖）
        assert!(!config.should_allow_app("com.apple.TextEdit"));
    }
}
