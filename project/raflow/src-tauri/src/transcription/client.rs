// Scribe client - ElevenLabs WebSocket 客户端
// 连接到 ElevenLabs Scribe v2 Realtime API 进行语音转录

use super::messages::ScribeConfig;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::json;
use std::sync::{Arc, Mutex};

/// Scribe 客户端事件
#[derive(Debug, Clone)]
pub enum ScribeClientEvent {
    /// 部分转录 (实时结果)
    PartialTranscript {
        text: String,
        timestamp: u64,
    },
    /// 确认转录 (最终结果)
    CommittedTranscript {
        text: String,
        timestamp: u64,
    },
    /// 会话开始
    SessionStarted {
        session_id: String,
    },
    /// 错误
    Error {
        error: String,
    },
}

/// ElevenLabs Scribe WebSocket 客户端
pub struct ScribeClient {
    /// 配置
    config: ScribeConfig,
    /// 连接状态
    connected: Arc<Mutex<bool>>,
    /// 事件发送器 (用于发送事件到前端)
    event_sender: Option<Arc<Mutex<Box<dyn Fn(ScribeClientEvent) + Send>>>>,
}

impl ScribeClient {
    /// 创建新的 Scribe 客户端
    pub fn new(config: ScribeConfig) -> Self {
        Self {
            config,
            connected: Arc::new(Mutex::new(false)),
            event_sender: None,
        }
    }

    /// 获取配置
    pub fn config(&self) -> &ScribeConfig {
        &self.config
    }

    /// 检查是否已连接
    pub fn is_connected(&self) -> bool {
        *self.connected.lock().unwrap()
    }

    /// 设置事件发送器
    pub fn set_event_sender(
        &mut self,
        sender: Option<Arc<Mutex<Box<dyn Fn(ScribeClientEvent) + Send>>>>,
    ) {
        self.event_sender = sender;
    }

    /// 发送事件
    pub fn emit_event(&self, event: ScribeClientEvent) {
        if let Some(ref sender) = self.event_sender {
            if let Ok(sender) = sender.lock() {
                sender(event.clone());
            }
        }
    }

    /// 编码音频数据为 Base64
    pub fn encode_audio_base64(&self, audio_data: &[i16]) -> String {
        // 将 i16 数据转换为字节数组
        let bytes: Vec<u8> = audio_data
            .iter()
            .flat_map(|&sample| sample.to_le_bytes().to_vec())
            .collect();
        STANDARD.encode(&bytes)
    }

    /// 解码 Base64 音频数据
    pub fn decode_audio_base64(&self, base64_str: &str) -> Vec<i16> {
        let bytes = STANDARD.decode(base64_str).unwrap_or_default();
        bytes
            .chunks_exact(2)
            .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
            .collect()
    }

    /// 创建音频块消息
    pub fn create_audio_chunk_message(&self, audio_data: &[i16], commit: bool) -> String {
        let base64_audio = self.encode_audio_base64(audio_data);
        json!({
            "message_type": "input_audio_chunk",
            "audio_base_64": base64_audio,
            "commit": commit,
            "sample_rate": self.config.sample_rate
        })
        .to_string()
    }

    /// 创建配置消息
    pub fn create_config_message(&self) -> String {
        let mut obj = json!({
            "model_id": self.config.model_id,
            "sample_rate": self.config.sample_rate
        });

        // 添加可选的语言配置
        if let Some(ref language) = self.config.language {
            obj["language"] = json!(language);
        }

        obj.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let config = ScribeConfig::default();
        let client = ScribeClient::new(config);
        assert!(!client.is_connected());
    }

    #[test]
    fn test_audio_encoding() {
        let config = ScribeConfig::default();
        let client = ScribeClient::new(config);
        let audio = vec![1000i16, 2000, 3000];
        let encoded = client.encode_audio_base64(&audio);
        assert!(!encoded.is_empty());

        let decoded = client.decode_audio_base64(&encoded);
        assert_eq!(decoded, audio);
    }

    #[test]
    fn test_create_audio_chunk_message() {
        let config = ScribeConfig::default();
        let client = ScribeClient::new(config);
        let audio = vec![100i16, 200];
        let json = client.create_audio_chunk_message(&audio, false);
        assert!(json.contains("input_audio_chunk"));
        assert!(json.contains("audio_base_64"));
        assert!(json.contains("commit"));
    }

    #[test]
    fn test_create_config_message() {
        let config = ScribeConfig {
            api_key: "test".to_string(),
            model_id: "scribe_v2_realtime".to_string(),
            language: Some("zh-CN".to_string()),
            sample_rate: 16000,
        };
        let client = ScribeClient::new(config);
        let json = client.create_config_message();
        assert!(json.contains("scribe_v2_realtime"));
        assert!(json.contains("zh-CN"));
        assert!(json.contains("16000"));
    }
}
