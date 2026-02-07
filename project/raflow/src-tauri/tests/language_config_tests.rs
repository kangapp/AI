// Language configuration tests - 多语言配置测试
// 测试 ElevenLabs Scribe v2 多语言支持、自动语言检测、语言代码验证

use raflow::transcription::language_config::{
    LanguageConfig, SupportedLanguage, LanguageCode, AutoLanguageDetection
};

#[cfg(test)]
mod language_config_tests {
    use super::*;

    // ===== RED PHASE: 编写测试 =====

    #[test]
    fn test_language_config_default() {
        // 测试：默认配置使用自动语言检测
        let config = LanguageConfig::default();

        assert_eq!(config.language_code, None);
        assert!(matches!(config.language(), AutoLanguageDetection::Auto));
        assert_eq!(config.model_id, "scribe_v2_realtime");
        assert!(!config.tag_audio_events);
        assert!(!config.diarize);
    }

    #[test]
    fn test_language_config_with_specific_language() {
        // 测试：指定特定语言
        let config = LanguageConfig::builder()
            .language(LanguageCode::ChineseChina)
            .build();

        assert_eq!(config.language_code, Some("zh-CN".to_string()));
        assert!(matches!(config.language(), AutoLanguageDetection::Specific(LanguageCode::ChineseChina)));
    }

    #[test]
    fn test_language_config_with_auto_detection() {
        // 测试：启用自动语言检测
        let config = LanguageConfig::builder()
            .auto_detect_language()
            .build();

        assert_eq!(config.language_code, None);
        assert!(matches!(config.language(), AutoLanguageDetection::Auto));
    }

    #[test]
    fn test_language_config_with_model_id() {
        // 测试：自定义模型 ID
        let config = LanguageConfig::builder()
            .model_id("scribe_v2_realtime")
            .build();

        assert_eq!(config.model_id, "scribe_v2_realtime");
    }

    #[test]
    fn test_language_config_with_audio_events() {
        // 测试：启用音频事件标记
        let config = LanguageConfig::builder()
            .tag_audio_events(true)
            .build();

        assert!(config.tag_audio_events);
    }

    #[test]
    fn test_language_config_with_diarization() {
        // 测试：启用说话人识别
        let config = LanguageConfig::builder()
            .diarize(true)
            .build();

        assert!(config.diarize);
    }

    #[test]
    fn test_language_config_full_builder() {
        // 测试：完整配置构建器
        let config = LanguageConfig::builder()
            .language(LanguageCode::EnglishUS)
            .model_id("scribe_v2_realtime")
            .tag_audio_events(true)
            .diarize(true)
            .build();

        assert_eq!(config.language_code, Some("en-US".to_string()));
        assert!(matches!(config.language(), AutoLanguageDetection::Specific(LanguageCode::EnglishUS)));
        assert_eq!(config.model_id, "scribe_v2_realtime");
        assert!(config.tag_audio_events);
        assert!(config.diarize);
    }

    #[test]
    fn test_supported_language_from_code() {
        // 测试：从语言代码获取支持的语言
        let lang = SupportedLanguage::from_code("zh-CN");
        assert!(matches!(lang, SupportedLanguage::ChineseChina));
        assert_eq!(lang.code(), "zh-CN");
        assert_eq!(lang.name(), "中文 (简体)");

        let lang = SupportedLanguage::from_code("en-US");
        assert!(matches!(lang, SupportedLanguage::EnglishUS));
        assert_eq!(lang.code(), "en-US");
        assert_eq!(lang.name(), "English (US)");
    }

    #[test]
    fn test_supported_language_all_variants() {
        // 测试：所有支持的语言变体
        // 英语
        assert_eq!(SupportedLanguage::EnglishUS.code(), "en-US");
        assert_eq!(SupportedLanguage::EnglishGB.code(), "en-GB");
        assert_eq!(SupportedLanguage::EnglishAU.code(), "en-AU");
        assert_eq!(SupportedLanguage::EnglishIN.code(), "en-IN");

        // 中文
        assert_eq!(SupportedLanguage::ChineseChina.code(), "zh-CN");
        assert_eq!(SupportedLanguage::ChineseTaiwan.code(), "zh-TW");

        // 日语
        assert_eq!(SupportedLanguage::Japanese.code(), "ja-JP");

        // 韩语
        assert_eq!(SupportedLanguage::Korean.code(), "ko-KR");

        // 西班牙语
        assert_eq!(SupportedLanguage::SpanishES.code(), "es-ES");
        assert_eq!(SupportedLanguage::SpanishMX.code(), "es-MX");

        // 法语
        assert_eq!(SupportedLanguage::FrenchFR.code(), "fr-FR");
        assert_eq!(SupportedLanguage::FrenchCA.code(), "fr-CA");

        // 德语
        assert_eq!(SupportedLanguage::German.code(), "de-DE");

        // 意大利语
        assert_eq!(SupportedLanguage::Italian.code(), "it-IT");

        // 葡萄牙语
        assert_eq!(SupportedLanguage::PortugueseBR.code(), "pt-BR");
        assert_eq!(SupportedLanguage::PortuguesePT.code(), "pt-PT");

        // 俄语
        assert_eq!(SupportedLanguage::Russian.code(), "ru-RU");

        // 阿拉伯语
        assert_eq!(SupportedLanguage::Arabic.code(), "ar-SA");

        // 荷兰语
        assert_eq!(SupportedLanguage::Dutch.code(), "nl-NL");

        // 芬兰语
        assert_eq!(SupportedLanguage::Finnish.code(), "fi-FI");

        // 土耳其语
        assert_eq!(SupportedLanguage::Turkish.code(), "tr-TR");

        // 印地语
        assert_eq!(SupportedLanguage::Hindi.code(), "hi-IN");

        // 泰语
        assert_eq!(SupportedLanguage::Thai.code(), "th-TH");

        // 越南语
        assert_eq!(SupportedLanguage::Vietnamese.code(), "vi-VN");
    }

    #[test]
    fn test_supported_language_name() {
        // 测试：语言名称
        assert_eq!(SupportedLanguage::ChineseChina.name(), "中文 (简体)");
        assert_eq!(SupportedLanguage::ChineseTaiwan.name(), "中文 (繁體)");
        assert_eq!(SupportedLanguage::EnglishUS.name(), "English (US)");
        assert_eq!(SupportedLanguage::Japanese.name(), "日本語");
        assert_eq!(SupportedLanguage::Korean.name(), "한국어");
        assert_eq!(SupportedLanguage::SpanishES.name(), "Español (España)");
        assert_eq!(SupportedLanguage::FrenchFR.name(), "Français (France)");
        assert_eq!(SupportedLanguage::German.name(), "Deutsch");
        assert_eq!(SupportedLanguage::Italian.name(), "Italiano");
        assert_eq!(SupportedLanguage::PortugueseBR.name(), "Português (Brasil)");
        assert_eq!(SupportedLanguage::Russian.name(), "Русский");
        assert_eq!(SupportedLanguage::Arabic.name(), "العربية");
    }

    #[test]
    fn test_language_config_to_json_with_specific_language() {
        // 测试：将配置转换为 JSON（指定语言）
        let config = LanguageConfig::builder()
            .language(LanguageCode::ChineseChina)
            .model_id("scribe_v2_realtime")
            .tag_audio_events(false)
            .diarize(false)
            .build();

        let json = config.to_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed["model_id"], "scribe_v2_realtime");
        assert_eq!(parsed["language_code"], "zh-CN");
        assert_eq!(parsed["tag_audio_events"], false);
        assert_eq!(parsed["diarize"], false);
    }

    #[test]
    fn test_language_config_to_json_with_auto_detection() {
        // 测试：将配置转换为 JSON（自动检测）
        let config = LanguageConfig::builder()
            .auto_detect_language()
            .model_id("scribe_v2_realtime")
            .tag_audio_events(true)
            .diarize(true)
            .build();

        let json = config.to_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed["model_id"], "scribe_v2_realtime");
        assert_eq!(parsed["tag_audio_events"], true);
        assert_eq!(parsed["diarize"], true);
        // 自动检测时，language_code 应该被省略或为 null
        assert!(parsed.get("language_code").is_none() || parsed["language_code"].is_null());
    }

    #[test]
    fn test_language_config_serialize_deserialize() {
        // 测试：序列化和反序列化
        let config1 = LanguageConfig::builder()
            .language(LanguageCode::Japanese)
            .model_id("scribe_v2_realtime")
            .tag_audio_events(true)
            .diarize(false)
            .build();

        let json = config1.to_json();
        let config2 = LanguageConfig::from_json(&json).unwrap();

        assert_eq!(config1.model_id, config2.model_id);
        assert_eq!(config1.tag_audio_events, config2.tag_audio_events);
        assert_eq!(config1.diarize, config2.diarize);
        assert_eq!(config1.language_code, config2.language_code);
        assert!(std::mem::discriminant(&config1.language()) == std::mem::discriminant(&config2.language()));
    }

    #[test]
    fn test_language_code_display() {
        // 测试：语言代码显示
        assert_eq!(format!("{}", LanguageCode::ChineseChina), "zh-CN");
        assert_eq!(format!("{}", LanguageCode::EnglishUS), "en-US");
        assert_eq!(format!("{}", LanguageCode::Japanese), "ja-JP");
        assert_eq!(format!("{}", LanguageCode::Korean), "ko-KR");
    }

    #[test]
    fn test_language_code_from_str() {
        // 测试：从字符串解析语言代码
        use std::str::FromStr;

        assert_eq!(LanguageCode::from_str("zh-CN").unwrap(), LanguageCode::ChineseChina);
        assert_eq!(LanguageCode::from_str("en-US").unwrap(), LanguageCode::EnglishUS);
        assert_eq!(LanguageCode::from_str("ja-JP").unwrap(), LanguageCode::Japanese);
        assert_eq!(LanguageCode::from_str("ko-KR").unwrap(), LanguageCode::Korean);

        // 无效的语言代码
        assert!(LanguageCode::from_str("invalid").is_err());
        assert!(LanguageCode::from_str("xx-XX").is_err());
    }

    #[test]
    fn test_supported_language_count() {
        // 测试：确保支持所有主要语言
        let all_languages = vec![
            // 英语
            ("en-US", "English (US)"),
            ("en-GB", "English (UK)"),
            ("en-AU", "English (Australia)"),
            ("en-IN", "English (India)"),
            // 中文
            ("zh-CN", "中文 (简体)"),
            ("zh-TW", "中文 (繁體)"),
            // 日韩
            ("ja-JP", "日本語"),
            ("ko-KR", "한국어"),
            // 欧洲语言
            ("es-ES", "Español (España)"),
            ("es-MX", "Español (México)"),
            ("fr-FR", "Français (France)"),
            ("fr-CA", "Français (Canada)"),
            ("de-DE", "Deutsch"),
            ("it-IT", "Italiano"),
            ("pt-BR", "Português (Brasil)"),
            ("pt-PT", "Português (Portugal)"),
            ("ru-RU", "Русский"),
            // 其他语言
            ("ar-SA", "العربية"),
            ("nl-NL", "Nederlands"),
            ("fi-FI", "Suomi"),
            ("tr-TR", "Türkçe"),
            ("hi-IN", "हिन्दी"),
            ("th-TH", "ไทย"),
            ("vi-VN", "Tiếng Việt"),
        ];

        for (code, name) in all_languages {
            let lang = SupportedLanguage::from_code(code);
            assert_eq!(lang.code(), code, "Language code mismatch for {}", code);
            assert_eq!(lang.name(), name, "Language name mismatch for {}", code);
        }
    }

    #[test]
    fn test_language_config_clone() {
        // 测试：配置克隆
        let config1 = LanguageConfig::builder()
            .language(LanguageCode::Korean)
            .tag_audio_events(true)
            .build();

        let config2 = config1.clone();

        assert_eq!(config1.model_id, config2.model_id);
        assert_eq!(config1.tag_audio_events, config2.tag_audio_events);
        assert_eq!(config1.diarize, config2.diarize);
    }

    #[test]
    fn test_auto_language_detection_display() {
        // 测试：自动语言检测显示
        let auto = AutoLanguageDetection::Auto;
        assert_eq!(format!("{}", auto), "auto");

        let specific = AutoLanguageDetection::Specific(LanguageCode::ChineseChina);
        assert_eq!(format!("{}", specific), "zh-CN");
    }
}
