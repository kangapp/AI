// Scribe API messages - ElevenLabs Scribe v2 Realtime API 消息定义

use serde::{Deserialize, Serialize};

/// ElevenLabs Scribe 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScribeConfig {
    /// API 密钥
    pub api_key: String,
    /// 模型 ID
    pub model_id: String,
    /// 语言代码 (可选，如 "zh-CN", "en-US")
    pub language: Option<String>,
    /// 采样率 (Hz)
    pub sample_rate: u32,
}

impl Default for ScribeConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model_id: "scribe_v2_realtime".to_string(),
            language: None,
            sample_rate: 16000,
        }
    }
}

/// 转录消息
///
/// 表示从 ElevenLabs WebSocket 接收到的各种消息类型
#[derive(Debug, Clone, PartialEq)]
pub enum TranscriptMessage {
    /// 部分转录 (实时结果)
    Partial {
        text: String,
        timestamp: u64,
    },
    /// 确认转录 (最终结果)
    Committed {
        text: String,
        timestamp: u64,
    },
    /// 会话开始
    SessionStarted {
        session_id: String,
    },
    /// 错误消息
    Error {
        error: String,
    },
}

impl TranscriptMessage {
    /// 从 JSON 解析消息
    pub fn from_json(json: &str) -> Result<Self, String> {
        let value: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let message_type = value
            .get("message_type")
            .and_then(|v| v.as_str())
            .ok_or("Missing message_type")?;

        match message_type {
            "partial_transcript" => {
                let text = value
                    .get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let timestamp = value
                    .get("created_at_ts")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                Ok(TranscriptMessage::Partial { text, timestamp })
            }
            "committed_transcript" => {
                let text = value
                    .get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let timestamp = value
                    .get("created_at_ts")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                Ok(TranscriptMessage::Committed { text, timestamp })
            }
            "session_started" => {
                let session_id = value
                    .get("session_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(TranscriptMessage::SessionStarted { session_id })
            }
            "input_error" => {
                let error = value
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                Ok(TranscriptMessage::Error { error })
            }
            _ => Err(format!("Unknown message type: {}", message_type)),
        }
    }

    /// 检查是否为未知消息类型
    pub fn is_unknown(&self) -> bool {
        matches!(self, TranscriptMessage::Error { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_partial_transcript() {
        let json = r#"{"message_type": "partial_transcript", "text": "你好", "created_at_ts": 123}"#;
        let msg = TranscriptMessage::from_json(json).unwrap();
        assert!(matches!(msg, TranscriptMessage::Partial { .. }));
    }

    #[test]
    fn test_parse_committed_transcript() {
        let json = r#"{"message_type": "committed_transcript", "text": "Hello", "created_at_ts": 456}"#;
        let msg = TranscriptMessage::from_json(json).unwrap();
        assert!(matches!(msg, TranscriptMessage::Committed { .. }));
    }

    #[test]
    fn test_parse_session_started() {
        let json = r#"{"message_type": "session_started", "session_id": "test123"}"#;
        let msg = TranscriptMessage::from_json(json).unwrap();
        assert!(matches!(msg, TranscriptMessage::SessionStarted { .. }));
    }

    #[test]
    fn test_parse_error() {
        let json = r#"{"message_type": "input_error", "error": "Test error"}"#;
        let msg = TranscriptMessage::from_json(json).unwrap();
        assert!(matches!(msg, TranscriptMessage::Error { .. }));
    }

    #[test]
    fn test_parse_invalid_json() {
        let json = "not json";
        assert!(TranscriptMessage::from_json(json).is_err());
    }

    #[test]
    fn test_config_default() {
        let config = ScribeConfig::default();
        assert_eq!(config.model_id, "scribe_v2_realtime");
        assert_eq!(config.sample_rate, 16000);
    }
}
