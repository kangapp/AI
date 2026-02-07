// API 配置模块 - 管理 API 密钥存储和验证

use std::path::PathBuf;
use std::fs;
use std::env;
use serde::{Deserialize, Serialize};

const API_KEY_FILE: &str = "api_key.json";
const DEFAULT_KEY: &str = "sk_f8ac4a87f9a58b901c4995ab67061e002a6777ec30c3696b";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub api_key: String,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            api_key: DEFAULT_KEY.to_string(),
        }
    }
}

impl ApiConfig {
    /// 获取配置文件路径
    fn config_path() -> Result<PathBuf, String> {
        let config_dir = env::var("HOME")
            .map(|home| Ok(PathBuf::from(home).join(".raflow")))
            .unwrap_or(Err("无法获取 HOME 目录".to_string()))?;

        // 确保目录存在
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;

        Ok(config_dir.join(API_KEY_FILE))
    }

    /// 加载 API 配置
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()?;

        if !path.exists() {
            // 创建默认配置
            let default_config = Self::default();
            default_config.save()?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {}", e))
    }

    /// 保存 API 配置
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()?;

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("序列化配置失败: {}", e))?;

        fs::write(&path, content)
            .map_err(|e| format!("写入配置文件失败: {}", e))
    }

    /// 验证 API 密钥格式
    pub fn validate_key(key: &str) -> Result<(), String> {
        if key.is_empty() {
            return Err("API 密钥不能为空".to_string());
        }

        // ElevenLabs API 密钥通常以 sk_ 开头
        if !key.starts_with("sk_") {
            return Err("API 密钥格式无效，应以 'sk_' 开头".to_string());
        }

        // 检查长度（通常约 40-50 个字符）
        if key.len() < 30 {
            return Err("API 密钥长度不足".to_string());
        }

        Ok(())
    }

    /// 设置新的 API 密钥
    pub fn set_api_key(mut self, key: String) -> Result<Self, String> {
        Self::validate_key(&key)?;

        self.api_key = key;
        self.save()?;
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_key() {
        let result = ApiConfig::validate_key("sk_test1234567890abcdefghijklmnopqrstuvwxyz");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_empty_key() {
        let result = ApiConfig::validate_key("");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_invalid_prefix() {
        let result = ApiConfig::validate_key("test_key");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_short_key() {
        let result = ApiConfig::validate_key("sk_short");
        assert!(result.is_err());
    }

    #[test]
    fn test_default_config() {
        let config = ApiConfig::default();
        assert!(!config.api_key.is_empty());
        assert_eq!(config.api_key, DEFAULT_KEY);
    }
}
