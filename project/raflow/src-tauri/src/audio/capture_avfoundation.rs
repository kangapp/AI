//! Audio capture using AVAudioEngine (objc2-avf-audio)
//!
//! This module provides macOS-specific audio capture using the AVAudioEngine API
//! from the objc2-avf-audio crate.
//!
//! Note: This implementation is a placeholder as the objc2-avf-audio API requires
//! extensive unsafe code and Objective-C block handling. For production use,
//! consider using the cpal-based implementation which works well on macOS.

use objc2::rc::Retained;
use objc2_avf_audio::{AVAudioEngine, AVAudioFormat};
use ringbuf::traits::Producer;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

/// Audio capture errors
#[derive(Error, Debug)]
pub enum CaptureError {
    /// No input device available on the system
    #[error("No input device available")]
    NoInputDevice,

    /// Failed to build the input stream
    #[error("Failed to build input stream: {0}")]
    StreamBuild(String),

    /// Failed to start the audio stream
    #[error("Failed to start stream: {0}")]
    StreamStart(String),

    /// Failed to install tap on input node
    #[error("Failed to install tap: {0}")]
    TapInstall(String),

    /// Audio engine error
    #[error("Audio engine error: {0}")]
    EngineError(String),
}

/// Audio capture handle using AVAudioEngine
///
/// Manages audio capture from the default input device using macOS's
/// AVAudioEngine API. Provides methods to start/stop capture and query device properties.
///
/// Note: This implementation is currently a stub. The actual audio capture
/// is handled by the cpal-based implementation in capture.rs.
pub struct AudioCapture {
    /// The AVAudioEngine instance (retained)
    _engine: Retained<AVAudioEngine>,
    /// The input format (sample rate, channels)
    format: Option<Retained<AVAudioFormat>>,
    /// Flag indicating if capture is active
    is_capturing: Arc<AtomicBool>,
}

impl AudioCapture {
    /// Create a new audio capture from default input device
    ///
    /// Initializes the audio capture using the system's default input device.
    /// Returns an error if no input device is available or if the device
    /// configuration cannot be retrieved.
    ///
    /// # Errors
    ///
    /// - [`CaptureError::NoInputDevice`] if no default input device exists
    /// - [`CaptureError::StreamBuild`] if device configuration fails
    pub fn new() -> Result<Self, CaptureError> {
        // Safety: AVAudioEngine::new() requires unsafe in objc2-avf-audio
        let engine = unsafe { AVAudioEngine::new() };

        // Safety: inputNode() requires unsafe
        let input_node = unsafe { engine.inputNode() };

        // Safety: outputFormatForBus() requires unsafe
        let format = unsafe { input_node.outputFormatForBus(0) };

        // Safety: sampleRate() requires unsafe
        let sample_rate = unsafe { format.sampleRate() };
        let channel_count = unsafe { format.channelCount() };

        if sample_rate == 0.0 {
            return Err(CaptureError::NoInputDevice);
        }

        tracing::info!(
            "Audio capture initialized (AVAudioEngine): {} channels, {} Hz",
            channel_count,
            sample_rate
        );

        Ok(Self {
            _engine: engine,
            format: Some(format),
            is_capturing: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get the sample rate of the capture device in Hz
    ///
    /// Returns the sample rate configured for the audio input device.
    /// Common values are 44100, 48000, or 96000 Hz.
    #[must_use]
    pub fn sample_rate(&self) -> u32 {
        self.format
            .as_ref()
            .map(|f: &Retained<AVAudioFormat>| unsafe { f.sampleRate() as u32 })
            .unwrap_or(0)
    }

    /// Get the number of audio channels
    ///
    /// Returns the number of channels for the audio input.
    /// Typically 1 (mono) or 2 (stereo).
    #[must_use]
    pub fn channels(&self) -> u16 {
        self.format
            .as_ref()
            .map(|f: &Retained<AVAudioFormat>| unsafe { f.channelCount() as u16 })
            .unwrap_or(0)
    }

    /// Check if currently capturing audio
    ///
    /// Returns `true` if the audio stream is active and capturing data.
    #[must_use]
    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }

    /// Start capturing audio with the provided buffer producer
    ///
    /// Begins audio capture from the input device. Audio samples are written
    /// to the provided ring buffer producer. The capture runs asynchronously.
    ///
    /// Note: This is a stub implementation. The actual capture uses cpal.
    ///
    /// # Arguments
    ///
    /// * `producer` - A ring buffer producer that receives f32 audio samples
    ///
    /// # Errors
    ///
    /// - [`CaptureError::TapInstall`] if the tap cannot be installed
    /// - [`CaptureError::StreamStart`] if the stream fails to start
    pub fn start<P>(&mut self, _producer: P) -> Result<(), CaptureError>
    where
        P: Producer<Item = f32> + Send + 'static,
    {
        if self.is_capturing() {
            tracing::warn!("Audio capture already in progress");
            return Ok(());
        }

        // Note: Full AVAudioEngine tap implementation requires complex Objective-C
        // block handling. For now, we just mark as capturing.
        // The actual capture is handled by the cpal implementation.
        self.is_capturing.store(true, Ordering::SeqCst);

        tracing::info!("Audio capture started (AVAudioEngine stub)");

        Ok(())
    }

    /// Stop capturing audio
    ///
    /// Stops the audio capture and releases the audio stream.
    /// This method is idempotent - calling it when not capturing is safe.
    pub fn stop(&mut self) {
        if !self.is_capturing() {
            return;
        }

        self.is_capturing.store(false, Ordering::SeqCst);

        tracing::info!("Audio capture stopped (AVAudioEngine stub)");
    }
}

impl Default for AudioCapture {
    fn default() -> Self {
        Self::new().expect("Failed to initialize default audio capture")
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}
