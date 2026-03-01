//! Clipboard operations
//!
//! This module provides clipboard functionality for copying text to the system clipboard.

use arboard::Clipboard;
use thiserror::Error;

/// Clipboard errors
#[derive(Error, Debug)]
pub enum ClipboardError {
    /// Failed to access clipboard
    #[error("Failed to access clipboard: {0}")]
    Access(String),

    /// Failed to set text
    #[error("Failed to set text: {0}")]
    SetText(String),
}

/// Write text to clipboard
///
/// # Arguments
/// * `text` - The text to copy to clipboard
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(ClipboardError)` on failure
///
/// # Example
/// ```ignore
/// use raflow_lib::clipboard::write_to_clipboard;
///
/// write_to_clipboard("Hello, World!")?;
/// ```
pub fn write_to_clipboard(text: &str) -> Result<(), ClipboardError> {
    let mut clipboard = Clipboard::new()
        .map_err(|e| ClipboardError::Access(e.to_string()))?;

    clipboard
        .set_text(text)
        .map_err(|e| ClipboardError::SetText(e.to_string()))?;

    tracing::info!("Text copied to clipboard: {} chars", text.len());
    Ok(())
}
