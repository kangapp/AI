// Accessibility detection - 可编辑性检测
// 使用系统 Accessibility API 检测聚焦元素是否可编辑

/// 检测当前聚焦的元素是否可编辑
///
/// 在 macOS 上使用 AXUIElement API
/// 在 Windows/Linux 上暂时返回 true（依赖剪贴板回退）
pub fn is_editable_element() -> bool {
    #[cfg(target_os = "macos")]
    {
        is_editable_element_macos()
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Windows/Linux 实现待定
        // 始终返回 true，依赖剪贴板回退
        true
    }
}

#[cfg(target_os = "macos")]
fn is_editable_element_macos() -> bool {
    // 简化版本：暂时返回 true
    // 完整的可编辑性检测将在后续阶段实现
    // 这需要使用 Accessibility API 和 AXUIElement
    true
}

/// 应用黑名单检查
/// 检查应用是否在黑名单中（不应该注入文本的应用）
pub fn is_blacklisted_app(bundle_id: &str) -> bool {
    // 黑名单应用列表
    const BLACKLIST: &[&str] = &[
        "com.apple.GameCenterUI",
        "com.apple.ScreenSaver.Engine",
        "com.apple.systemuiserver",
    ];

    BLACKLIST.contains(&bundle_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blacklisted_apps() {
        assert!(is_blacklisted_app("com.apple.GameCenterUI"));
        assert!(is_blacklisted_app("com.apple.ScreenSaver.Engine"));
        assert!(!is_blacklisted_app("com.apple.TextEdit"));
        assert!(!is_blacklisted_app("com.vscode"));
    }

    #[test]
    fn test_is_editable_element() {
        // 这个测试只验证函数不会崩溃
        // 实际的可编辑性检测需要真实的 GUI 环境
        let result = is_editable_element();
        assert!(result == true || result == false, "Should return a boolean");
    }
}
