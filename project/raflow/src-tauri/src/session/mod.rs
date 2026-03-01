//! Recording session management.
//!
//! This module provides the [`RecordingSession`] state machine that coordinates
//! audio capture, WebSocket transcription, and clipboard output.

mod session;
mod websocket_task;

pub use session::{RecordingSession, SessionError, SessionState};
