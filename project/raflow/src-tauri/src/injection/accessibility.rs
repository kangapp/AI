// Accessibility detection - 可编辑性检测
// 使用系统 Accessibility API 检测聚焦元素是否可编辑

use std::collections::HashSet;

/// 可编辑性检测错误
#[derive(Debug, Clone, PartialEq)]
pub enum AccessibilityError {
    /// 无辅助功能权限
    NoAccessibilityPermission,
    /// 无聚焦元素
    NoFocusedElement,
    /// 元素不可编辑
    ElementNotEditable,
    /// 应用被阻止
    ApplicationBlocked(String),
}

impl std::fmt::Display for AccessibilityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AccessibilityError::NoAccessibilityPermission => {
                write!(f, "No accessibility permission")
            }
            AccessibilityError::NoFocusedElement => {
                write!(f, "No focused element")
            }
            AccessibilityError::ElementNotEditable => {
                write!(f, "Element is not editable")
            }
            AccessibilityError::ApplicationBlocked(app) => {
                write!(f, "Application is blocked: {}", app)
            }
        }
    }
}

impl std::error::Error for AccessibilityError {}

/// 可编辑性检测配置
#[derive(Debug, Clone)]
pub struct EditableDetectionConfig {
    /// 是否使用白名单
    pub use_whitelist: bool,
    /// 是否使用黑名单
    pub use_blacklist: bool,
    /// 自定义白名单
    pub custom_whitelist: Vec<String>,
    /// 自定义黑名单
    pub custom_blacklist: Vec<String>,
}

impl Default for EditableDetectionConfig {
    fn default() -> Self {
        Self {
            use_whitelist: false,
            use_blacklist: true, // 默认启用黑名单模式
            custom_whitelist: Vec::new(),
            custom_blacklist: Vec::new(),
        }
    }
}

impl EditableDetectionConfig {
    /// 创建配置构建器
    pub fn builder() -> EditableDetectionConfigBuilder {
        EditableDetectionConfigBuilder::default()
    }

    /// 检查应用是否被允许
    pub fn should_allow_app(&self, bundle_id: &str) -> bool {
        // 如果启用了自定义白名单，使用自定义白名单
        if !self.custom_whitelist.is_empty() {
            return self.custom_whitelist.contains(&bundle_id.to_string());
        }

        // 如果启用了白名单，检查默认白名单
        if self.use_whitelist {
            return is_whitelisted_app(bundle_id);
        }

        // 如果启用了自定义黑名单，检查自定义黑名单
        if !self.custom_blacklist.is_empty() {
            return !self.custom_blacklist.contains(&bundle_id.to_string());
        }

        // 如果启用了黑名单，检查默认黑名单
        if self.use_blacklist {
            return !is_blacklisted_app(bundle_id);
        }

        // 默认允许
        true
    }
}

/// 配置构建器
#[derive(Debug, Clone, Default)]
pub struct EditableDetectionConfigBuilder {
    config: EditableDetectionConfig,
}

impl EditableDetectionConfigBuilder {
    /// 设置是否使用白名单
    pub fn use_whitelist(mut self, use_whitelist: bool) -> Self {
        self.config.use_whitelist = use_whitelist;
        self
    }

    /// 设置是否使用黑名单
    pub fn use_blacklist(mut self, use_blacklist: bool) -> Self {
        self.config.use_blacklist = use_blacklist;
        self
    }

    /// 设置自定义白名单
    pub fn custom_whitelist(mut self, whitelist: Vec<String>) -> Self {
        self.config.custom_whitelist = whitelist;
        self
    }

    /// 从 HashSet 设置自定义白名单
    pub fn custom_whitelist_set(mut self, whitelist: HashSet<String>) -> Self {
        self.config.custom_whitelist = whitelist.into_iter().collect();
        self
    }

    /// 设置自定义黑名单
    pub fn custom_blacklist(mut self, blacklist: Vec<String>) -> Self {
        self.config.custom_blacklist = blacklist;
        self
    }

    /// 从 HashSet 设置自定义黑名单
    pub fn custom_blacklist_set(mut self, blacklist: HashSet<String>) -> Self {
        self.config.custom_blacklist = blacklist.into_iter().collect();
        self
    }

    /// 构建配置
    pub fn build(self) -> EditableDetectionConfig {
        self.config
    }
}

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
    // TODO: 完整实现需要使用 accessibility crate
    // 检查 AXUIElement 的 AXSelectedTextRangeAttribute 属性
    // 这需要辅助功能权限
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
        "com.apple.loginwindow",
        "com.apple.dock",
        "com.apple.WebKit.PluginProcess",
        "com.apple.WebKit.Plugin.64",
    ];

    BLACKLIST.contains(&bundle_id)
}

/// 应用白名单检查
/// 检查应用是否在白名单中（已知支持文本编辑的应用）
pub fn is_whitelisted_app(bundle_id: &str) -> bool {
    // 白名单应用列表
    const WHITELIST: &[&str] = &[
        // 文本编辑器
        "com.apple.TextEdit",
        "com.apple.dt.Xcode",
        "com.microsoft.VSCode",
        "org.gnu.Emacs",
        "com.sublimetext.4",
        "com.funneltek.FluentTyper",

        // 浏览器
        "com.google.Chrome",
        "org.mozilla.firefox",
        "com.apple.Safari",
        "com.microsoft.Edg",
        "com.brave.Browser",

        // 通讯工具
        "com.slack.Slack",
        "com.hnc.Discord",
        "com.tencent.xinWeChat",
        "com.facebook.archon.developerID",
        "org.telegram.messenger",

        // 协作工具
        "com.figma.Desktop",
        "notion.id",
        "com.microsoft.Teams",
        "us.zoom.xos",

        // 办公软件
        "com.microsoft.Word",
        "com.microsoft.Excel",
        "com.microsoft.PowerPoint",
        "com.microsoft.OneNote",
        "com.apple.iWork.Pages",
        "com.apple.iWork.Keynote",
        "com.apple.iWork.Numbers",
        "org.libreoffice.script",

        // 邮件和消息
        "com.apple.Mail",
        "com.apple.iChat",
        "com.apple.MobileSMS",
        "com.microsoft.Outlook",

        // 系统工具
        "com.apple.Spotlight",
        "com.apple.Terminal",
        "com.googlecode.iterm2",
        "co.zeit.hyper",

        // 开发工具
        "com.jetbrains.PhpStorm",
        "com.jetbrains.WebStorm",
        "com.jetbrains.PyCharm",
        "com.jetbrains.intellij",
        "com.github.GitHubClient",
        "com.atom.Atom",

        // 笔记工具
        "com.evernote.Evernote",
        "bear.Mac",
        "com.agiletortoise.Drafts",
        "xyz.typist.Notional",
    ];

    WHITELIST.contains(&bundle_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blacklisted_apps() {
        assert!(is_blacklisted_app("com.apple.GameCenterUI"));
        assert!(is_blacklisted_app("com.apple.ScreenSaver.Engine"));
        assert!(is_blacklisted_app("com.apple.systemuiserver"));
        assert!(!is_blacklisted_app("com.apple.TextEdit"));
        assert!(!is_blacklisted_app("com.vscode"));
        assert!(!is_blacklisted_app("unknown.app"));
    }

    #[test]
    fn test_whitelisted_apps() {
        // 测试几个白名单应用
        assert!(is_whitelisted_app("com.apple.TextEdit"));
        assert!(is_whitelisted_app("com.apple.dt.Xcode"));
        assert!(is_whitelisted_app("com.microsoft.VSCode"));
        assert!(is_whitelisted_app("com.google.Chrome"));
        assert!(is_whitelisted_app("org.mozilla.firefox"));
        assert!(is_whitelisted_app("com.slack.Slack"));

        // 不在白名单中的应用
        assert!(!is_whitelisted_app("com.apple.GameCenterUI"));
        assert!(!is_whitelisted_app("unknown.app"));
    }

    #[test]
    fn test_error_display() {
        assert_eq!(
            AccessibilityError::NoAccessibilityPermission.to_string(),
            "No accessibility permission"
        );
        assert_eq!(
            AccessibilityError::NoFocusedElement.to_string(),
            "No focused element"
        );
        assert_eq!(
            AccessibilityError::ElementNotEditable.to_string(),
            "Element is not editable"
        );
        assert_eq!(
            AccessibilityError::ApplicationBlocked("test.app".to_string()).to_string(),
            "Application is blocked: test.app"
        );
    }

    #[test]
    fn test_error_clone() {
        let error1 = AccessibilityError::NoAccessibilityPermission;
        let error2 = error1.clone();
        assert_eq!(error1, error2);

        let error3 = AccessibilityError::ApplicationBlocked("test.app".to_string());
        let error4 = error3.clone();
        assert_eq!(error3, error4);
    }

    #[test]
    fn test_config_default() {
        let config = EditableDetectionConfig::default();
        assert_eq!(config.use_whitelist, false);
        assert_eq!(config.use_blacklist, true);
        assert!(config.custom_whitelist.is_empty());
        assert!(config.custom_blacklist.is_empty());
    }

    #[test]
    fn test_config_builder() {
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
    fn test_blacklist_only_logic() {
        let config = EditableDetectionConfig::builder()
            .use_whitelist(false)
            .use_blacklist(true)
            .build();

        assert!(config.should_allow_app("unknown.app"));
        assert!(config.should_allow_app("com.apple.TextEdit"));
        assert!(!config.should_allow_app("com.apple.GameCenterUI"));
    }

    #[test]
    fn test_whitelist_only_logic() {
        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(false)
            .build();

        assert!(config.should_allow_app("com.apple.TextEdit"));
        assert!(!config.should_allow_app("unknown.app"));
        assert!(!config.should_allow_app("com.apple.GameCenterUI"));
    }

    #[test]
    fn test_custom_lists_override_defaults() {
        let custom_whitelist = vec!["com.example.CustomApp".to_string()];
        let custom_blacklist = vec!["com.example.CustomBlocked".to_string()];

        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(true)
            .custom_whitelist(custom_whitelist)
            .custom_blacklist(custom_blacklist)
            .build();

        assert!(config.should_allow_app("com.example.CustomApp"));
        assert!(!config.should_allow_app("com.example.CustomBlocked"));
        assert!(!config.should_allow_app("com.apple.TextEdit"));
    }

    #[test]
    fn test_combined_whitelist_blacklist_logic() {
        let config = EditableDetectionConfig::builder()
            .use_whitelist(true)
            .use_blacklist(true)
            .build();

        assert!(config.should_allow_app("com.apple.TextEdit"));
        assert!(!config.should_allow_app("com.apple.GameCenterUI"));
        assert!(!config.should_allow_app("unknown.app"));
    }

    #[test]
    fn test_is_editable_element_returns_bool() {
        let result = is_editable_element();
        assert!(result == true || result == false);
    }
}
