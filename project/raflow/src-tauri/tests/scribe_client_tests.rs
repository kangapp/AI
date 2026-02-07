// Scribe client tests - 测试 ElevenLabs WebSocket 客户端
// 这个测试文件测试 WebSocket 连接和消息处理

use raflow::transcription::{
    client::{ScribeClient, ScribeClientEvent},
    messages::{TranscriptMessage, ScribeConfig},
};

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试: 客户端创建和配置
    #[test]
    fn test_client_creation() {
        let config = ScribeConfig::default();
        let client = ScribeClient::new(config);

        // 验证客户端未连接
        assert!(!client.is_connected());
    }

    /// 测试: 连接配置
    #[test]
    fn test_connection_config() {
        let config = ScribeConfig {
            api_key: "test_api_key".to_string(),
            model_id: "scribe_v2_realtime".to_string(),
            language: Some("zh-CN".to_string()),
            sample_rate: 16000,
        };

        let client = ScribeClient::new(config);

        // 验证配置
        assert_eq!(client.config().api_key, "test_api_key");
        assert_eq!(client.config().model_id, "scribe_v2_realtime");
        assert_eq!(client.config().language, Some("zh-CN".to_string()));
    }

    /// 测试: 音频数据编码为 Base64
    #[test]
    fn test_audio_base64_encoding() {
        let config = ScribeConfig::default();
        let client = ScribeClient::new(config);

        // 测试音频数据
        let audio_data: Vec<i16> = vec![1000, 2000, 3000, 4000, 5000];

        // 编码为 Base64
        let base64_str = client.encode_audio_base64(&audio_data);

        // 验证编码结果不为空
        assert!(!base64_str.is_empty(), "Base64 string should not be empty");

        // 验证可以解码回原始数据
        let decoded = client.decode_audio_base64(&base64_str);
        assert_eq!(decoded, audio_data, "Decoded data should match original");
    }

    /// 测试: 消息解析 - partial_transcript
    #[test]
    fn test_parse_partial_transcript() {
        let json = r#"{
            "message_type": "partial_transcript",
            "text": "你好世界",
            "created_at_ts": 1234567890
        }"#;

        let message = TranscriptMessage::from_json(json);

        assert!(message.is_ok(), "Should parse partial_transcript");

        let msg = message.unwrap();
        match msg {
            TranscriptMessage::Partial { text, timestamp } => {
                assert_eq!(text, "你好世界");
                assert_eq!(timestamp, 1234567890);
            }
            _ => panic!("Expected Partial transcript"),
        }
    }

    /// 测试: 消息解析 - committed_transcript
    #[test]
    fn test_parse_committed_transcript() {
        let json = r#"{
            "message_type": "committed_transcript",
            "text": "Hello World",
            "created_at_ts": 1234567891
        }"#;

        let message = TranscriptMessage::from_json(json);

        assert!(message.is_ok(), "Should parse committed_transcript");

        let msg = message.unwrap();
        match msg {
            TranscriptMessage::Committed { text, timestamp } => {
                assert_eq!(text, "Hello World");
                assert_eq!(timestamp, 1234567891);
            }
            _ => panic!("Expected Committed transcript"),
        }
    }

    /// 测试: 消息解析 - session_started
    #[test]
    fn test_parse_session_started() {
        let json = r#"{
            "message_type": "session_started",
            "session_id": "test_session_123"
        }"#;

        let message = TranscriptMessage::from_json(json);

        assert!(message.is_ok(), "Should parse session_started");

        let msg = message.unwrap();
        match msg {
            TranscriptMessage::SessionStarted { session_id } => {
                assert_eq!(session_id, "test_session_123");
            }
            _ => panic!("Expected SessionStarted"),
        }
    }

    /// 测试: 消息解析 - 错误处理
    #[test]
    fn test_parse_error_message() {
        let json = r#"{
            "message_type": "input_error",
            "error": "Invalid audio format"
        }"#;

        let message = TranscriptMessage::from_json(json);

        assert!(message.is_ok(), "Should parse error message");

        let msg = message.unwrap();
        match msg {
            TranscriptMessage::Error { error } => {
                assert_eq!(error, "Invalid audio format");
            }
            _ => panic!("Expected Error"),
        }
    }

    /// 测试: 无效 JSON 处理
    #[test]
    fn test_parse_invalid_json() {
        let invalid_json = "not a valid json";

        let message = TranscriptMessage::from_json(invalid_json);

        assert!(message.is_err(), "Should fail to parse invalid JSON");
    }

    /// 测试: 未知消息类型
    #[test]
    fn test_parse_unknown_message_type() {
        let json = r#"{
            "message_type": "unknown_type",
            "data": "something"
        }"#;

        let message = TranscriptMessage::from_json(json);

        // 应该返回错误或默认值
        assert!(message.is_err() || message.unwrap().is_unknown(),
                "Unknown message type should be handled");
    }

    /// 测试: 音频块消息创建
    #[test]
    fn test_create_audio_chunk_message() {
        let config = ScribeConfig::default();
        let client = ScribeClient::new(config);

        let audio_data: Vec<i16> = vec![1000, 2000, 3000];

        // 创建音频块消息 (不提交)
        let json = client.create_audio_chunk_message(&audio_data, false);

        // 验证 JSON 包含必要的字段
        assert!(json.contains("input_audio_chunk"), "Should have message_type");
        assert!(json.contains("audio_base_64"), "Should have audio data");
        assert!(json.contains("\"commit\":false"), "Should have commit flag");

        // 验证 Base64 编码的数据
        assert!(json.len() > 50, "Base64 data should be present");
    }

    /// 测试: 会话配置消息创建
    #[test]
    fn test_create_config_message() {
        let config = ScribeConfig {
            api_key: "test_key".to_string(),
            model_id: "scribe_v2_realtime".to_string(),
            language: Some("en-US".to_string()),
            sample_rate: 16000,
        };

        let client = ScribeClient::new(config);
        let json = client.create_config_message();

        // 验证配置消息
        assert!(json.contains("model_id"), "Should have model_id");
        assert!(json.contains("scribe_v2_realtime"), "Should have model value");
        assert!(json.contains("language"), "Should have language");
        assert!(json.contains("en-US"), "Should have language value");
        assert!(json.contains("sample_rate"), "Should have sample_rate");
        assert!(json.contains("16000"), "Should have sample_rate value");
    }

    /// 测试: 事件发送
    #[test]
    fn test_event_sending() {
        let config = ScribeConfig::default();
        let mut client = ScribeClient::new(config);

        // 创建一个简单的事件发送器用于测试
        use std::sync::{Arc, Mutex};
        let event_received = Arc::new(Mutex::new(false));
        let event_received_clone = event_received.clone();

        let sender: Arc<Mutex<Box<dyn Fn(ScribeClientEvent) + Send>>> =
            Arc::new(Mutex::new(Box::new(move |_event| {
                *event_received_clone.lock().unwrap() = true;
            })));

        client.set_event_sender(Some(sender));

        // 模拟发送一个事件
        let event = ScribeClientEvent::PartialTranscript {
            text: "测试文本".to_string(),
            timestamp: 1234567890,
        };

        client.emit_event(event);

        // 验证事件被接收
        assert!(*event_received.lock().unwrap());
    }
}
