//! Audio capture using cpal
//!
//! This module provides cross-platform audio capture functionality using the cpal library.
//! It supports capturing audio from the default input device with configurable buffer sizes.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
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
    pub fn new() -> Result<Self, CaptureError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or(CaptureError::NoInputDevice)?;

        let supported_config = device
            .default_input_config()
            .map_err(|e| CaptureError::StreamBuild(e.to_string()))?;

        let config: StreamConfig = supported_config.into();

        tracing::info!(
            "Audio capture initialized: {} channels, {} Hz",
            config.channels,
            config.sample_rate.0
        );

        Ok(Self {
            device,
            config,
            stream: None,
            is_capturing: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get the sample rate of the capture device in Hz
    ///
    /// Returns the sample rate configured for the audio input device.
    /// Common values are 44100, 48000, or 96000 Hz.
    #[must_use]
    pub fn sample_rate(&self) -> u32 {
        self.config.sample_rate.0
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
    /// let capture = AudioCapture::new()?;
    /// let buffer_size = capture.sample_rate() as usize; // 1 second buffer
    /// let rb = HeapRb::<f32>::new(buffer_size);
    /// let (producer, _consumer) = rb.split();
    ///
    /// capture.start(producer)?;
    /// # Ok::<(), raflow_lib::audio::CaptureError>(())
    /// ```
    pub fn start<P>(&mut self, mut producer: P) -> Result<(), CaptureError>
    where
        P: Producer<Item = f32> + Send + 'static,
    {
        if self.is_capturing() {
            tracing::warn!("Audio capture already in progress");
            return Ok(());
        }

        let channels = self.config.channels as usize;

        // Build the input stream
        let stream = self
            .device
            .build_input_stream(
                &self.config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Write samples to ring buffer
                    // Note: For stereo input, we store interleaved samples
                    // The pipeline will handle channel conversion
                    for &sample in data {
                        if producer.try_push(sample).is_err() {
                            // Buffer overflow - drop samples
                            // Using trace level to avoid log spam
                        }
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
            self.config.sample_rate.0
        );

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
