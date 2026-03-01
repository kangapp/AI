//! Recording session management.
//!
//! This module provides the [`RecordingSession`] state machine that coordinates
//! audio capture, WebSocket transcription, and clipboard output.

mod recording;
mod websocket_task;

pub use recording::{RecordingSession, SessionError, SessionState};
