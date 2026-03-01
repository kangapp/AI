//! WebSocket task for real-time transcription.

use crate::transcription::{IncomingMessage, OutgoingMessage};
use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::Message as WsMessage;

/// Run the WebSocket transcription task.
///
/// This function manages a WebSocket connection to the ElevenLabs API,
/// handling bidirectional communication for real-time transcription.
///
/// # Arguments
///
/// * `api_key` - ElevenLabs API key for authentication
/// * `audio_rx` - Channel receiver for PCM audio data from the audio pipeline
/// * `committed_text` - Shared storage for committed transcript text
/// * `cancel_token` - Atomic flag to signal task cancellation
/// * `app_handle` - Tauri app handle for emitting events to frontend
///
/// # Errors
///
/// Returns an error string if:
/// - WebSocket connection fails
/// - Session initialization fails
/// - Message serialization/deserialization fails
/// - Send/receive operations fail
pub async fn run_transcription_task(
    api_key: String,
    mut audio_rx: mpsc::Receiver<Vec<i16>>,
    committed_text: Arc<Mutex<String>>,
    cancel_token: Arc<AtomicBool>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let url = format!(
        "wss://api.elevenlabs.io/v1/speech-to-text/realtime?xi-api-key={}",
        api_key
    );

    // Connect to WebSocket
    let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let (mut sender, mut receiver) = ws_stream.split();

    tracing::info!("WebSocket connected");

    // Wait for session_started
    let session_id = loop {
        let msg = receiver
            .next()
            .await
            .ok_or("Connection closed")?
            .map_err(|e| format!("Receive error: {}", e))?;

        if let WsMessage::Text(text) = msg {
            let incoming: IncomingMessage = serde_json::from_str(&text)
                .map_err(|e| format!("Parse error: {}", e))?;
            if let IncomingMessage::SessionStarted { session_id } = incoming {
                break session_id;
            }
        }
    };

    tracing::info!("Transcription session started: {}", session_id);

    // Main loop
    loop {
        if cancel_token.load(Ordering::SeqCst) {
            break;
        }

        tokio::select! {
            // Send audio
            Some(pcm_data) = audio_rx.recv() => {
                let base64_audio = encode_pcm_to_base64(&pcm_data);
                let message = OutgoingMessage::audio(base64_audio);
                let json = serde_json::to_string(&message)
                    .map_err(|e| format!("Serialize error: {}", e))?;

                sender
                    .send(WsMessage::Text(json.into()))
                    .await
                    .map_err(|e| format!("Send error: {}", e))?;
            }

            // Receive transcription
            msg = receiver.next() => {
                match msg {
                    Some(Ok(WsMessage::Text(text))) => {
                        if let Ok(incoming) = serde_json::from_str::<IncomingMessage>(&text) {
                            match incoming {
                                IncomingMessage::PartialTranscript { text, .. } => {
                                    let _ = app_handle.emit("partial-transcript", &text);
                                }
                                IncomingMessage::CommittedTranscript { text, .. } => {
                                    // Save committed text
                                    let mut committed = committed_text.lock().await;
                                    if !committed.is_empty() {
                                        committed.push(' ');
                                    }
                                    committed.push_str(&text);

                                    // Emit to frontend
                                    let _ = app_handle.emit("committed-transcript", &*committed);
                                }
                                IncomingMessage::Error { message } => {
                                    tracing::error!("Transcription error: {}", message);
                                }
                                _ => {}
                            }
                        }
                    }
                    Some(Ok(_)) => {} // Ignore non-text messages
                    Some(Err(e)) => {
                        tracing::error!("WebSocket receive error: {}", e);
                    }
                    None => break, // Connection closed
                }
            }
        }
    }

    // Close connection
    let _ = sender.close().await;
    tracing::info!("WebSocket task ended");

    Ok(())
}

/// Encode PCM audio to base64.
///
/// Converts raw PCM audio samples (i16) to a base64-encoded string
/// suitable for transmission over the WebSocket API.
///
/// # Arguments
///
/// * `pcm` - Slice of PCM audio samples in i16 format (16kHz mono)
///
/// # Returns
///
/// Base64-encoded string representing the audio data
fn encode_pcm_to_base64(pcm: &[i16]) -> String {
    let bytes: Vec<u8> = pcm
        .iter()
        .flat_map(|&sample| sample.to_le_bytes())
        .collect();
    base64::engine::general_purpose::STANDARD.encode(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
