// Clipboard injection - 剪贴板注入实现
// 提供剪贴板读写和文本注入功能

use std::sync::Mutex;
use serde::{Deserialize, Serialize};

/// 文本注入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum InjectResult {
    /// 文本已成功注入到剪贴板并执行了粘贴操作
    Injected,
    /// 仅复制到剪贴板（无法执行粘贴操作）
    ClipboardOnly,
    /// 注入失败
    Failed(String),
}

/// 剪贴板注入器
pub struct ClipboardInjector {
    clipboard: Option<Mutex<arboard::Clipboard>>,
    saved_content: Option<String>,
}

impl ClipboardInjector {
    /// 创建新的剪贴板注入器
    pub fn new() -> Result<Self, String> {
        match arboard::Clipboard::new() {
            Ok(clipboard) => Ok(Self {
                clipboard: Some(Mutex::new(clipboard)),
                saved_content: None,
            }),
            Err(e) => Err(format!("Failed to initialize clipboard: {}", e)),
        }
    }

    /// 保存当前剪贴板内容
    pub fn save_clipboard(&mut self) {
        if let Some(clipboard) = &self.clipboard {
            if let Ok(mut cb) = clipboard.lock() {
                let content = cb.get_text().ok();
                self.saved_content = content;
            }
        }
    }

    /// 恢复之前保存的剪贴板内容
    pub fn restore_clipboard(&mut self) -> Result<bool, String> {
        if let Some(content) = &self.saved_content {
            self.write_to_clipboard(content)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// 获取已保存的剪贴板内容
    pub fn get_saved_clipboard(&self) -> Option<String> {
        self.saved_content.clone()
    }

    /// 写入文本到剪贴板
    pub fn write_to_clipboard(&self, text: &str) -> Result<(), String> {
        if let Some(clipboard) = &self.clipboard {
            if let Ok(mut cb) = clipboard.lock() {
                cb.set_text(text)
                    .map_err(|e| format!("Failed to write to clipboard: {}", e))
            } else {
                Err("Failed to lock clipboard".to_string())
            }
        } else {
            Err("Clipboard not initialized".to_string())
        }
    }

    /// 从剪贴板读取文本
    pub fn read_from_clipboard(&self) -> Result<String, String> {
        if let Some(clipboard) = &self.clipboard {
            if let Ok(mut cb) = clipboard.lock() {
                cb.get_text()
                    .map_err(|e| format!("Failed to read from clipboard: {}", e))
            } else {
                Err("Failed to lock clipboard".to_string())
            }
        } else {
            Err("Clipboard not initialized".to_string())
        }
    }

    /// 注入文本到剪贴板
    pub fn inject_text(&mut self, text: &str) -> InjectResult {
        // 保存当前剪贴板内容
        self.save_clipboard();

        // 写入新文本
        if let Err(e) = self.write_to_clipboard(text) {
            return InjectResult::Failed(e);
        }

        // TODO: 在后续阶段添加键盘模拟粘贴
        // 目前仅返回 ClipboardOnly
        InjectResult::ClipboardOnly
    }
}

impl Default for ClipboardInjector {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            clipboard: None,
            saved_content: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_result_serialization() {
        let result = InjectResult::Injected;
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Injected"));

        let deserialized: InjectResult = serde_json::from_str(&json).unwrap();
        assert!(matches!(deserialized, InjectResult::Injected));
    }
}
