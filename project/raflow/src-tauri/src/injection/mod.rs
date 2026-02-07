// Text injection module - 文本注入模块
// 模块入口，导出所有注入相关的功能

pub mod clipboard;
pub mod smart_clipboard;
pub mod accessibility;

// Re-export main types
pub use clipboard::{ClipboardInjector, InjectResult};
pub use accessibility::{
    is_editable_element, is_blacklisted_app, is_whitelisted_app,
    AccessibilityError, EditableDetectionConfig, EditableDetectionConfigBuilder
};
