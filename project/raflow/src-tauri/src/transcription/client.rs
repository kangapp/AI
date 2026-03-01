//! ElevenLabs WebSocket client for real-time transcription
//!
//! This module provides a WebSocket client for connecting to the ElevenLabs
//! Scribe v2 Realtime API and streaming audio for transcription.

use crate::transcription::{IncomingMessage, OutgoingMessage};
use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use thiserror::Error;
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage, MaybeTlsStream};

/// Type alias for the WebSocket sink (sender) part
type WebSocketSender = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<MaybeTlsStream<TcpStream>>,
    WsMessage,
>;

/// Errors that can occur during WebSocket client operations
#[derive(Error, Debug)]
pub enum ClientError {
    /// WebSocket connection failed
    #[error("WebSocket connection failed: {0}")]
    Connection(String),

    /// Failed to send message to WebSocket
    #[error("Failed to send message: {0}")]
    Send(String),

    /// Failed to receive message from WebSocket
    #[error("Failed to receive message: {0}")]
    Receive(String),

    /// JSON parsing error
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// Client is not connected to WebSocket
    #[error("Not connected to WebSocket")]
    NotConnected,

    /// Transcription session has not been started
    #[error("Transcription session not started")]
    SessionNotStarted,
}

/// ElevenLabs real-time transcription client
///
/// This client handles WebSocket communication with the ElevenLabs Scribe v2
/// Realtime API for streaming audio transcription.
///
/// # Example
///
/// ```no_run
/// use raflow_lib::transcription::TranscriptionClient;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let api_key = "your-api-key".to_string();
///     let mut client = TranscriptionClient::new(api_key);
///
///     // Connect and wait for session to start
///     client.connect().await?;
///
///     // Send audio data (PCM 16kHz mono)
///     let audio_data: &[i16] = &[0, 100, -50, 200];
///     client.send_audio(audio_data).await?;
///
///     // Commit to get final transcription
///     client.commit().await?;
///
///     // Close connection
///     client.close().await;
///
///     Ok(())
/// }
/// ```
pub struct TranscriptionClient {
    /// API key for ElevenLabs authentication
    api_key: String,
    /// WebSocket sender (None if not connected)
    sender: Option<WebSocketSender>,
    /// Session ID received from server after connection
    session_id: Option<String>,
}

impl TranscriptionClient {
    /// Create a new transcription client
    ///
    /// # Arguments
    ///
    /// * `api_key` - ElevenLabs API key for authentication
    ///
    /// # Example
    ///
    /// ```
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// let client = TranscriptionClient::new("your-api-key".to_string());
    /// assert!(!client.is_connected());
    /// ```
    #[must_use]
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            sender: None,
            session_id: None,
        }
    }

    /// Connect to the ElevenLabs WebSocket API
    ///
    /// Establishes a WebSocket connection and waits for the `session_started`
    /// message from the server. The session ID is stored internally.
    ///
    /// # Errors
    ///
    /// Returns `ClientError::Connection` if the WebSocket connection fails.
    /// Returns `ClientError::Receive` if receiving the session_started message fails.
    /// Returns `ClientError::Json` if the session_started message cannot be parsed.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// let mut client = TranscriptionClient::new("your-api-key".to_string());
    /// client.connect().await?;
    /// assert!(client.is_connected());
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect(&mut self) -> Result<(), ClientError> {
        let url = format!(
            "wss://api.elevenlabs.io/v1/speech-to-text/realtime?xi-api-key={}",
            self.api_key
        );

        // Establish WebSocket connection
        let (ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| ClientError::Connection(e.to_string()))?;

        // Split into sender and receiver
        let (sender, mut receiver) = ws_stream.split();

        // Wait for session_started message
        let session_id = loop {
            let msg = receiver
                .next()
                .await
                .ok_or_else(|| ClientError::Receive("Connection closed".to_string()))?
                .map_err(|e| ClientError::Receive(e.to_string()))?;

            if let WsMessage::Text(text) = msg {
                let incoming: IncomingMessage = serde_json::from_str(&text)?;
                if let IncomingMessage::SessionStarted { session_id } = incoming {
                    break session_id;
                }
                // Ignore other messages while waiting for session_started
            }
        };

        self.sender = Some(sender);
        self.session_id = Some(session_id);

        Ok(())
    }

    /// Send audio data to the transcription API
    ///
    /// The audio must be PCM format at 16kHz mono. The data is automatically
    /// encoded to base64 before sending.
    ///
    /// # Arguments
    ///
    /// * `pcm_data` - Raw PCM audio samples (i16 format, 16kHz mono)
    ///
    /// # Errors
    ///
    /// Returns `ClientError::NotConnected` if the client is not connected.
    /// Returns `ClientError::Send` if sending the message fails.
    /// Returns `ClientError::Json` if serializing the message fails.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// let mut client = TranscriptionClient::new("your-api-key".to_string());
    /// client.connect().await?;
    ///
    /// let audio_data: &[i16] = &[0, 100, -50, 200];
    /// client.send_audio(audio_data).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn send_audio(&mut self, pcm_data: &[i16]) -> Result<(), ClientError> {
        let sender = self.sender.as_mut().ok_or(ClientError::NotConnected)?;

        let base64_audio = encode_pcm_to_base64(pcm_data);
        let message = OutgoingMessage::audio(base64_audio);
        let json = serde_json::to_string(&message)?;

        sender
            .send(WsMessage::Text(json.into()))
            .await
            .map_err(|e| ClientError::Send(e.to_string()))?;

        Ok(())
    }

    /// Send a commit signal to finalize the current transcription
    ///
    /// This signals to the API that the current audio segment is complete
    /// and a final transcription should be generated.
    ///
    /// # Errors
    ///
    /// Returns `ClientError::NotConnected` if the client is not connected.
    /// Returns `ClientError::Send` if sending the message fails.
    /// Returns `ClientError::Json` if serializing the message fails.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// let mut client = TranscriptionClient::new("your-api-key".to_string());
    /// client.connect().await?;
    ///
    /// let audio_data: &[i16] = &[0, 100, -50, 200];
    /// client.send_audio(audio_data).await?;
    /// client.commit().await?; // Finalize transcription
    /// # Ok(())
    /// # }
    /// ```
    pub async fn commit(&mut self) -> Result<(), ClientError> {
        let sender = self.sender.as_mut().ok_or(ClientError::NotConnected)?;

        let message = OutgoingMessage::commit();
        let json = serde_json::to_string(&message)?;

        sender
            .send(WsMessage::Text(json.into()))
            .await
            .map_err(|e| ClientError::Send(e.to_string()))?;

        Ok(())
    }

    /// Close the WebSocket connection
    ///
    /// This method gracefully closes the connection and resets the internal state.
    /// It is safe to call this method multiple times.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// let mut client = TranscriptionClient::new("your-api-key".to_string());
    /// client.connect().await?;
    /// // ... use client ...
    /// client.close().await;
    /// assert!(!client.is_connected());
    /// # Ok(())
    /// # }
    /// ```
    pub async fn close(&mut self) {
        if let Some(mut sender) = self.sender.take() {
            // Attempt to send close frame, ignore errors
            let _ = sender.close().await;
        }
        self.session_id = None;
    }

    /// Check if the client is currently connected
    ///
    /// Returns `true` if there is an active WebSocket connection.
    ///
    /// # Example
    ///
    /// ```
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// let client = TranscriptionClient::new("your-api-key".to_string());
    /// assert!(!client.is_connected());
    /// ```
    #[must_use]
    pub fn is_connected(&self) -> bool {
        self.sender.is_some()
    }

    /// Get the current session ID
    ///
    /// Returns `Some(session_id)` if connected and session has started,
    /// `None` otherwise.
    ///
    /// # Example
    ///
    /// ```
    /// use raflow_lib::transcription::TranscriptionClient;
    ///
    /// let client = TranscriptionClient::new("your-api-key".to_string());
    /// assert!(client.session_id().is_none());
    /// ```
    #[must_use]
    pub fn session_id(&self) -> Option<&str> {
        self.session_id.as_deref()
    }
}

/// Encode PCM audio data (i16 samples) to base64
///
/// This function converts raw PCM audio samples to a base64-encoded string
/// suitable for transmission over the WebSocket API.
///
/// # Arguments
///
/// * `pcm` - Slice of PCM audio samples in i16 format
///
/// # Returns
///
/// Base64-encoded string representing the audio data
///
/// # Example
///
/// ```
/// use raflow_lib::transcription::encode_pcm_to_base64;
///
/// let audio: &[i16] = &[0, 100, -50, 200];
/// let encoded = encode_pcm_to_base64(audio);
/// assert!(!encoded.is_empty());
/// ```
#[must_use]
pub fn encode_pcm_to_base64(pcm: &[i16]) -> String {
    // Convert i16 samples to bytes (little-endian)
    let bytes: Vec<u8> = pcm
        .iter()
        .flat_map(|&sample| sample.to_le_bytes())
        .collect();

    // Encode to base64
    base64::engine::general_purpose::STANDARD.encode(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_new() {
        let client = TranscriptionClient::new("test-key".to_string());
        assert!(!client.is_connected());
        assert!(client.session_id().is_none());
    }

    #[test]
    fn test_encode_pcm_to_base64_empty() {
        let pcm: &[i16] = &[];
        let encoded = encode_pcm_to_base64(pcm);
        assert_eq!(encoded, "");
    }

    #[test]
    fn test_encode_pcm_to_base64_zeros() {
        let pcm: &[i16] = &[0, 0, 0, 0];
        let encoded = encode_pcm_to_base64(pcm);
        // 4 i16 = 8 bytes of zeros -> base64 "AAAAAAAAAAA="
        assert_eq!(encoded, "AAAAAAAAAAA=");
    }

    #[test]
    fn test_encode_pcm_to_base64_simple() {
        // Test with known values
        // 1 as i16 little-endian = [0x01, 0x00]
        // 256 as i16 little-endian = [0x00, 0x01]
        let pcm: &[i16] = &[1, 256];
        let encoded = encode_pcm_to_base64(pcm);

        // Verify we can decode it back
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&encoded)
            .unwrap();
        let decoded_i16: Vec<i16> = decoded
            .chunks_exact(2)
            .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();

        assert_eq!(decoded_i16, vec![1, 256]);
    }

    #[test]
    fn test_encode_pcm_to_base64_negative() {
        let pcm: &[i16] = &[-1, -256];
        let encoded = encode_pcm_to_base64(pcm);

        // Verify we can decode it back
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&encoded)
            .unwrap();
        let decoded_i16: Vec<i16> = decoded
            .chunks_exact(2)
            .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();

        assert_eq!(decoded_i16, vec![-1, -256]);
    }

    #[test]
    fn test_client_error_display() {
        let err = ClientError::Connection("timeout".to_string());
        assert_eq!(err.to_string(), "WebSocket connection failed: timeout");

        let err = ClientError::Send("channel closed".to_string());
        assert_eq!(err.to_string(), "Failed to send message: channel closed");

        let err = ClientError::Receive("EOF".to_string());
        assert_eq!(err.to_string(), "Failed to receive message: EOF");

        let err = ClientError::NotConnected;
        assert_eq!(err.to_string(), "Not connected to WebSocket");

        let err = ClientError::SessionNotStarted;
        assert_eq!(err.to_string(), "Transcription session not started");
    }

    #[test]
    fn test_client_error_from_serde_json() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid json");
        assert!(json_err.is_err());

        let client_err: ClientError = json_err.unwrap_err().into();
        assert!(matches!(client_err, ClientError::Json(_)));
    }
}
