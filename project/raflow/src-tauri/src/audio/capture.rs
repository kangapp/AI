//! Audio capture using cpal
//!
//! This module provides cross-platform audio capture functionality using the cpal library.
//! It supports capturing audio from the default input device with configurable buffer sizes.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
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

    /// Unsupported sample format encountered
    #[error("Unsupported sample format: {0:?}")]
    UnsupportedFormat(SampleFormat),
}

/// Audio capture handle
///
/// Manages audio capture from the default input device. Provides methods to
/// start/stop capture and query device properties.
///
/// # Example
///
/// ```no_run
/// use raflow_lib::audio::AudioCapture;
///
/// let capture = AudioCapture::new()?;
/// println!("Sample rate: {}", capture.sample_rate());
/// println!("Channels: {}", capture.channels());
/// # Ok::<(), raflow_lib::audio::CaptureError>(())
/// ```
pub struct AudioCapture {
    /// The audio input device
    device: Device,
    /// The stream configuration
    config: StreamConfig,
    /// The active audio stream (if capturing)
    stream: Option<Stream>,
    /// Flag indicating if capture is active
    is_capturing: Arc<AtomicBool>,
    /// Buffer for audio data
    buffer: Arc<std::sync::Mutex<Vec<f32>>>,
    /// Sample rate value
    sample_rate_val: u32,
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
    ///
    /// # Example
    ///
    /// ```no_run
    /// use raflow_lib::audio::AudioCapture;
    ///
    /// let capture = AudioCapture::new()?;
    /// # Ok::<(), raflow_lib::audio::CaptureError>(())
    /// ```
    /// Create a new audio capture with retry logic
    ///
    /// On macOS, when the app is launched via `open`, the audio device
    /// may not be immediately available. This method retries a few times
    /// with a short delay to handle this edge case.
    pub fn new() -> Result<Self, CaptureError> {
        // Retry logic for macOS open launch issue
        const MAX_RETRIES: usize = 3;
        const RETRY_DELAY_MS: u64 = 100;

        let mut last_error = CaptureError::NoInputDevice;

        for attempt in 0..MAX_RETRIES {
            if attempt > 0 {
                tracing::warn!(
                    "[CAPTURE] Retry {} after {}ms delay",
                    attempt + 1,
                    RETRY_DELAY_MS
                );
                std::thread::sleep(std::time::Duration::from_millis(RETRY_DELAY_MS));
            }

            match Self::try_new() {
                Ok(capture) => {
                    tracing::info!("[CAPTURE] Device initialized on attempt {}", attempt + 1);
                    return Ok(capture);
                }
                Err(e) => {
                    last_error = e;
                    tracing::warn!(
                        "[CAPTURE] Attempt {} failed: {:?}",
                        attempt + 1,
                        last_error
                    );
                }
            }
        }

        Err(last_error)
    }

    /// Internal: Try to create audio capture without retry
    fn try_new() -> Result<Self, CaptureError> {
        let host = cpal::default_host();
        tracing::info!("[CAPTURE] Using host: {:?}", host.id());

        let device = host
            .default_input_device()
            .ok_or(CaptureError::NoInputDevice)?;

        // Get device name for debugging
        let device_name = device.name().unwrap_or_else(|_| "unknown".to_string());
        tracing::info!("[CAPTURE] Using input device: {}", device_name);

        let supported_config = device
            .default_input_config()
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

        let config: StreamConfig = supported_config.into();

        tracing::info!(
            "Audio capture initialized: {} channels, {} Hz",
            config.channels,
            config.sample_rate.0
        );

        let sample_rate = config.sample_rate.0;

        Ok(Self {
            device,
            config,
            stream: None,
            is_capturing: Arc::new(AtomicBool::new(false)),
            buffer: Arc::new(std::sync::Mutex::new(Vec::with_capacity(16384))),
            sample_rate_val: sample_rate,
        })
    }

    /// Get the sample rate of the capture device in Hz
    ///
    /// Returns the sample rate configured for the audio input device.
    /// Common values are 44100, 48000, or 96000 Hz.
    #[must_use]
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate_val
    }

    /// Get the number of audio channels
    ///
    /// Returns the number of channels for the audio input.
    /// Typically 1 (mono) or 2 (stereo).
    #[must_use]
    pub fn channels(&self) -> u16 {
        self.config.channels
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
    /// # Arguments
    ///
    /// * `producer` - A ring buffer producer that receives f32 audio samples
    ///
    /// # Errors
    ///
    /// - [`CaptureError::StreamBuild`] if the stream cannot be created
    /// - [`CaptureError::UnsupportedFormat`] if the sample format is not f32
    /// - [`CaptureError::StreamStart`] if the stream fails to start
    ///
    /// # Example
    ///
    /// ```no_run
    /// use raflow_lib::audio::AudioCapture;
    /// use ringbuf::HeapRb;
    /// use ringbuf::traits::*;
    ///
    /// let mut capture = AudioCapture::new()?;
    /// Start capturing audio
    ///
    /// Starts the audio capture and begins reading from the default input device.
    /// Audio data is stored in an internal buffer accessible via the `buffer()` method.
    ///
    /// # Errors
    ///
    /// Returns an error if the stream cannot be built or started.
    pub fn start(&mut self) -> Result<(), CaptureError> {
        if self.is_capturing() {
            tracing::warn!("Audio capture already in progress");
            return Ok(());
        }

        let channels = self.config.channels as usize;
        let buffer = self.buffer.clone();

        // Build the input stream
        let stream = self
            .device
            .build_input_stream(
                &self.config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Write samples to internal buffer
                    let mut buf = buffer.lock().unwrap();
                    for &sample in data {
                        buf.push(sample);
                    }
                },
                |err| {
                    tracing::error!("Audio stream error: {}", err);
                },
                None,
            )
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

        // Start the stream
        stream
            .play()
            .map_err(|e| CaptureError::StreamStart(e.to_string()))?;

        self.stream = Some(stream);
        self.is_capturing.store(true, Ordering::SeqCst);

        tracing::info!(
            "Audio capture started: {} channels, {} Hz",
            channels,
            self.sample_rate_val
        );

        Ok(())
    }

    /// Get the buffer for audio data
    pub fn buffer(&self) -> Arc<std::sync::Mutex<Vec<f32>>> {
        self.buffer.clone()
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
        self.stream = None;

        tracing::info!("Audio capture stopped");
    }

    /// Get the name of the input device
    ///
    /// Returns the name of the audio input device, or an error string
    /// if the name cannot be retrieved.
    #[must_use]
    pub fn device_name(&self) -> String {
        self.device
            .name()
            .unwrap_or_else(|_| "Unknown Device".to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_error_display() {
        let err = CaptureError::NoInputDevice;
        assert_eq!(err.to_string(), "No input device available");

        let err = CaptureError::StreamBuild("test error".to_string());
        assert_eq!(err.to_string(), "Failed to build input stream: test error");

        let err = CaptureError::StreamStart("test error".to_string());
        assert_eq!(err.to_string(), "Failed to start stream: test error");
    }

    #[test]
    fn test_is_capturing_initial_state() {
        // Note: This test may fail in CI environments without audio devices
        if let Ok(capture) = AudioCapture::new() {
            assert!(!capture.is_capturing());
        }
    }
}
