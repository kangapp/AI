// Language configuration - 多语言配置支持
// ElevenLabs Scribe v2 Realtime API 多语言和自动语言检测

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// 语言代码枚举
///
/// 支持 ElevenLabs Scribe v2 的所有语言代码
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LanguageCode {
    // 英语
    EnglishUS,
    EnglishGB,
    EnglishAU,
    EnglishIN,

    // 中文
    ChineseChina,
    ChineseTaiwan,

    // 日韩
    Japanese,
    Korean,

    // 西班牙语
    SpanishES,
    SpanishMX,

    // 法语
    FrenchFR,
    FrenchCA,

    // 德语
    German,

    // 意大利语
    Italian,

    // 葡萄牙语
    PortugueseBR,
    PortuguesePT,

    // 俄语
    Russian,

    // 阿拉伯语
    Arabic,

    // 荷兰语
    Dutch,

    // 芬兰语
    Finnish,

    // 土耳其语
    Turkish,

    // 印地语
    Hindi,

    // 泰语
    Thai,

    // 越南语
    Vietnamese,
}

impl LanguageCode {
    /// 获取语言代码字符串
    pub fn code(&self) -> &'static str {
        match self {
            LanguageCode::EnglishUS => "en-US",
            LanguageCode::EnglishGB => "en-GB",
            LanguageCode::EnglishAU => "en-AU",
            LanguageCode::EnglishIN => "en-IN",
            LanguageCode::ChineseChina => "zh-CN",
            LanguageCode::ChineseTaiwan => "zh-TW",
            LanguageCode::Japanese => "ja-JP",
            LanguageCode::Korean => "ko-KR",
            LanguageCode::SpanishES => "es-ES",
            LanguageCode::SpanishMX => "es-MX",
            LanguageCode::FrenchFR => "fr-FR",
            LanguageCode::FrenchCA => "fr-CA",
            LanguageCode::German => "de-DE",
            LanguageCode::Italian => "it-IT",
            LanguageCode::PortugueseBR => "pt-BR",
            LanguageCode::PortuguesePT => "pt-PT",
            LanguageCode::Russian => "ru-RU",
            LanguageCode::Arabic => "ar-SA",
            LanguageCode::Dutch => "nl-NL",
            LanguageCode::Finnish => "fi-FI",
            LanguageCode::Turkish => "tr-TR",
            LanguageCode::Hindi => "hi-IN",
            LanguageCode::Thai => "th-TH",
            LanguageCode::Vietnamese => "vi-VN",
        }
    }

    /// 获取支持的语言枚举
    pub fn supported_language(&self) -> SupportedLanguage {
        match self {
            LanguageCode::EnglishUS => SupportedLanguage::EnglishUS,
            LanguageCode::EnglishGB => SupportedLanguage::EnglishGB,
            LanguageCode::EnglishAU => SupportedLanguage::EnglishAU,
            LanguageCode::EnglishIN => SupportedLanguage::EnglishIN,
            LanguageCode::ChineseChina => SupportedLanguage::ChineseChina,
            LanguageCode::ChineseTaiwan => SupportedLanguage::ChineseTaiwan,
            LanguageCode::Japanese => SupportedLanguage::Japanese,
            LanguageCode::Korean => SupportedLanguage::Korean,
            LanguageCode::SpanishES => SupportedLanguage::SpanishES,
            LanguageCode::SpanishMX => SupportedLanguage::SpanishMX,
            LanguageCode::FrenchFR => SupportedLanguage::FrenchFR,
            LanguageCode::FrenchCA => SupportedLanguage::FrenchCA,
            LanguageCode::German => SupportedLanguage::German,
            LanguageCode::Italian => SupportedLanguage::Italian,
            LanguageCode::PortugueseBR => SupportedLanguage::PortugueseBR,
            LanguageCode::PortuguesePT => SupportedLanguage::PortuguesePT,
            LanguageCode::Russian => SupportedLanguage::Russian,
            LanguageCode::Arabic => SupportedLanguage::Arabic,
            LanguageCode::Dutch => SupportedLanguage::Dutch,
            LanguageCode::Finnish => SupportedLanguage::Finnish,
            LanguageCode::Turkish => SupportedLanguage::Turkish,
            LanguageCode::Hindi => SupportedLanguage::Hindi,
            LanguageCode::Thai => SupportedLanguage::Thai,
            LanguageCode::Vietnamese => SupportedLanguage::Vietnamese,
        }
    }
}

impl FromStr for LanguageCode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "en-US" => Ok(LanguageCode::EnglishUS),
            "en-GB" => Ok(LanguageCode::EnglishGB),
            "en-AU" => Ok(LanguageCode::EnglishAU),
            "en-IN" => Ok(LanguageCode::EnglishIN),
            "zh-CN" => Ok(LanguageCode::ChineseChina),
            "zh-TW" => Ok(LanguageCode::ChineseTaiwan),
            "ja-JP" => Ok(LanguageCode::Japanese),
            "ko-KR" => Ok(LanguageCode::Korean),
            "es-ES" => Ok(LanguageCode::SpanishES),
            "es-MX" => Ok(LanguageCode::SpanishMX),
            "fr-FR" => Ok(LanguageCode::FrenchFR),
            "fr-CA" => Ok(LanguageCode::FrenchCA),
            "de-DE" => Ok(LanguageCode::German),
            "it-IT" => Ok(LanguageCode::Italian),
            "pt-BR" => Ok(LanguageCode::PortugueseBR),
            "pt-PT" => Ok(LanguageCode::PortuguesePT),
            "ru-RU" => Ok(LanguageCode::Russian),
            "ar-SA" => Ok(LanguageCode::Arabic),
            "nl-NL" => Ok(LanguageCode::Dutch),
            "fi-FI" => Ok(LanguageCode::Finnish),
            "tr-TR" => Ok(LanguageCode::Turkish),
            "hi-IN" => Ok(LanguageCode::Hindi),
            "th-TH" => Ok(LanguageCode::Thai),
            "vi-VN" => Ok(LanguageCode::Vietnamese),
            _ => Err(format!("Unknown language code: {}", s)),
        }
    }
}

impl fmt::Display for LanguageCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.code())
    }
}

/// 支持的语言
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SupportedLanguage {
    // 英语
    EnglishUS,
    EnglishGB,
    EnglishAU,
    EnglishIN,

    // 中文
    ChineseChina,
    ChineseTaiwan,

    // 日韩
    Japanese,
    Korean,

    // 西班牙语
    SpanishES,
    SpanishMX,

    // 法语
    FrenchFR,
    FrenchCA,

    // 德语
    German,

    // 意大利语
    Italian,

    // 葡萄牙语
    PortugueseBR,
    PortuguesePT,

    // 俄语
    Russian,

    // 阿拉伯语
    Arabic,

    // 荷兰语
    Dutch,

    // 芬兰语
    Finnish,

    // 土耳其语
    Turkish,

    // 印地语
    Hindi,

    // 泰语
    Thai,

    // 越南语
    Vietnamese,
}

impl SupportedLanguage {
    /// 从语言代码获取支持的语言
    pub fn from_code(code: &str) -> Self {
        match code {
            "en-US" => SupportedLanguage::EnglishUS,
            "en-GB" => SupportedLanguage::EnglishGB,
            "en-AU" => SupportedLanguage::EnglishAU,
            "en-IN" => SupportedLanguage::EnglishIN,
            "zh-CN" => SupportedLanguage::ChineseChina,
            "zh-TW" => SupportedLanguage::ChineseTaiwan,
            "ja-JP" => SupportedLanguage::Japanese,
            "ko-KR" => SupportedLanguage::Korean,
            "es-ES" => SupportedLanguage::SpanishES,
            "es-MX" => SupportedLanguage::SpanishMX,
            "fr-FR" => SupportedLanguage::FrenchFR,
            "fr-CA" => SupportedLanguage::FrenchCA,
            "de-DE" => SupportedLanguage::German,
            "it-IT" => SupportedLanguage::Italian,
            "pt-BR" => SupportedLanguage::PortugueseBR,
            "pt-PT" => SupportedLanguage::PortuguesePT,
            "ru-RU" => SupportedLanguage::Russian,
            "ar-SA" => SupportedLanguage::Arabic,
            "nl-NL" => SupportedLanguage::Dutch,
            "fi-FI" => SupportedLanguage::Finnish,
            "tr-TR" => SupportedLanguage::Turkish,
            "hi-IN" => SupportedLanguage::Hindi,
            "th-TH" => SupportedLanguage::Thai,
            "vi-VN" => SupportedLanguage::Vietnamese,
            _ => SupportedLanguage::EnglishUS, // 默认英语
        }
    }

    /// 获取语言代码
    pub fn code(&self) -> &'static str {
        match self {
            SupportedLanguage::EnglishUS => "en-US",
            SupportedLanguage::EnglishGB => "en-GB",
            SupportedLanguage::EnglishAU => "en-AU",
            SupportedLanguage::EnglishIN => "en-IN",
            SupportedLanguage::ChineseChina => "zh-CN",
            SupportedLanguage::ChineseTaiwan => "zh-TW",
            SupportedLanguage::Japanese => "ja-JP",
            SupportedLanguage::Korean => "ko-KR",
            SupportedLanguage::SpanishES => "es-ES",
            SupportedLanguage::SpanishMX => "es-MX",
            SupportedLanguage::FrenchFR => "fr-FR",
            SupportedLanguage::FrenchCA => "fr-CA",
            SupportedLanguage::German => "de-DE",
            SupportedLanguage::Italian => "it-IT",
            SupportedLanguage::PortugueseBR => "pt-BR",
            SupportedLanguage::PortuguesePT => "pt-PT",
            SupportedLanguage::Russian => "ru-RU",
            SupportedLanguage::Arabic => "ar-SA",
            SupportedLanguage::Dutch => "nl-NL",
            SupportedLanguage::Finnish => "fi-FI",
            SupportedLanguage::Turkish => "tr-TR",
            SupportedLanguage::Hindi => "hi-IN",
            SupportedLanguage::Thai => "th-TH",
            SupportedLanguage::Vietnamese => "vi-VN",
        }
    }

    /// 获取语言名称
    pub fn name(&self) -> &'static str {
        match self {
            SupportedLanguage::EnglishUS => "English (US)",
            SupportedLanguage::EnglishGB => "English (UK)",
            SupportedLanguage::EnglishAU => "English (Australia)",
            SupportedLanguage::EnglishIN => "English (India)",
            SupportedLanguage::ChineseChina => "中文 (简体)",
            SupportedLanguage::ChineseTaiwan => "中文 (繁體)",
            SupportedLanguage::Japanese => "日本語",
            SupportedLanguage::Korean => "한국어",
            SupportedLanguage::SpanishES => "Español (España)",
            SupportedLanguage::SpanishMX => "Español (México)",
            SupportedLanguage::FrenchFR => "Français (France)",
            SupportedLanguage::FrenchCA => "Français (Canada)",
            SupportedLanguage::German => "Deutsch",
            SupportedLanguage::Italian => "Italiano",
            SupportedLanguage::PortugueseBR => "Português (Brasil)",
            SupportedLanguage::PortuguesePT => "Português (Portugal)",
            SupportedLanguage::Russian => "Русский",
            SupportedLanguage::Arabic => "العربية",
            SupportedLanguage::Dutch => "Nederlands",
            SupportedLanguage::Finnish => "Suomi",
            SupportedLanguage::Turkish => "Türkçe",
            SupportedLanguage::Hindi => "हिन्दी",
            SupportedLanguage::Thai => "ไทย",
            SupportedLanguage::Vietnamese => "Tiếng Việt",
        }
    }
}

/// 自动语言检测配置
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AutoLanguageDetection {
    /// 自动检测语言
    Auto,
    /// 指定特定语言
    Specific(LanguageCode),
}

impl Default for AutoLanguageDetection {
    fn default() -> Self {
        AutoLanguageDetection::Auto
    }
}

impl fmt::Display for AutoLanguageDetection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AutoLanguageDetection::Auto => write!(f, "auto"),
            AutoLanguageDetection::Specific(code) => write!(f, "{}", code),
        }
    }
}

/// 语言配置
///
/// 配置 ElevenLabs Scribe v2 的转录语言和相关选项
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanguageConfig {
    /// 语言代码（可选，None 表示自动检测）
    #[serde(rename = "language_code", skip_serializing_if = "Option::is_none")]
    pub language_code: Option<String>,
    /// 模型 ID
    pub model_id: String,
    /// 标记音频事件（如笑声、掌声等）
    #[serde(rename = "tag_audio_events")]
    pub tag_audio_events: bool,
    /// 说话人识别
    pub diarize: bool,
}

impl Default for LanguageConfig {
    fn default() -> Self {
        Self {
            language_code: None,
            model_id: "scribe_v2_realtime".to_string(),
            tag_audio_events: false,
            diarize: false,
        }
    }
}

impl LanguageConfig {
    /// 创建配置构建器
    pub fn builder() -> LanguageConfigBuilder {
        LanguageConfigBuilder::default()
    }

    /// 将配置转换为 JSON
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap()
    }

    /// 从 JSON 解析配置
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| format!("Failed to parse JSON: {}", e))
    }

    /// 获取语言配置
    pub fn language(&self) -> AutoLanguageDetection {
        match &self.language_code {
            None => AutoLanguageDetection::Auto,
            Some(code) => {
                LanguageCode::from_str(code)
                    .map(AutoLanguageDetection::Specific)
                    .unwrap_or(AutoLanguageDetection::Auto)
            }
        }
    }

    /// 设置语言
    pub fn with_language(mut self, language: LanguageCode) -> Self {
        self.language_code = Some(language.code().to_string());
        self
    }

    /// 启用自动语言检测
    pub fn with_auto_detect(mut self) -> Self {
        self.language_code = None;
        self
    }
}

/// 语言配置构建器
#[derive(Debug, Clone, Default)]
pub struct LanguageConfigBuilder {
    config: LanguageConfig,
}

impl LanguageConfigBuilder {
    /// 设置语言
    pub fn language(mut self, language: LanguageCode) -> Self {
        self.config.language_code = Some(language.code().to_string());
        self
    }

    /// 启用自动语言检测
    pub fn auto_detect_language(mut self) -> Self {
        self.config.language_code = None;
        self
    }

    /// 设置模型 ID
    pub fn model_id(mut self, model_id: &str) -> Self {
        self.config.model_id = model_id.to_string();
        self
    }

    /// 设置音频事件标记
    pub fn tag_audio_events(mut self, tag: bool) -> Self {
        self.config.tag_audio_events = tag;
        self
    }

    /// 设置说话人识别
    pub fn diarize(mut self, diarize: bool) -> Self {
        self.config.diarize = diarize;
        self
    }

    /// 构建配置
    pub fn build(self) -> LanguageConfig {
        self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = LanguageConfig::default();
        assert!(matches!(config.language(), AutoLanguageDetection::Auto));
        assert_eq!(config.model_id, "scribe_v2_realtime");
        assert!(!config.tag_audio_events);
        assert!(!config.diarize);
    }

    #[test]
    fn test_builder_with_language() {
        let config = LanguageConfig::builder()
            .language(LanguageCode::ChineseChina)
            .build();

        assert!(matches!(config.language(), AutoLanguageDetection::Specific(LanguageCode::ChineseChina)));
    }

    #[test]
    fn test_language_code_display() {
        assert_eq!(format!("{}", LanguageCode::ChineseChina), "zh-CN");
        assert_eq!(format!("{}", LanguageCode::EnglishUS), "en-US");
    }

    #[test]
    fn test_supported_language() {
        let lang = SupportedLanguage::from_code("zh-CN");
        assert_eq!(lang.code(), "zh-CN");
        assert_eq!(lang.name(), "中文 (简体)");
    }

    #[test]
    fn test_auto_detection_display() {
        assert_eq!(format!("{}", AutoLanguageDetection::Auto), "auto");
    }

    #[test]
    fn test_to_json_with_language() {
        let config = LanguageConfig::builder()
            .language(LanguageCode::ChineseChina)
            .build();

        let json = config.to_json();
        assert!(json.contains("zh-CN"));
    }
}
