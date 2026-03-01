//! Recording session management.
//!
//! This module provides the [`RecordingSession`] state machine that coordinates
//! audio capture, WebSocket transcription, and clipboard output.

mod session;

pub use session::{RecordingSession, SessionError, SessionState};
