//! Complete audio pipeline: capture -> resample -> output
//!
//! This module integrates audio capture and resampling into a unified pipeline.
//! It captures audio from the microphone, resamples it to 16kHz, and delivers
//! the processed PCM data via a callback.
//!
//! # Architecture
//!
//! ```text
//! [Microphone] -> [AudioCapture] -> [Ring Buffer] -> [Processor Thread] -> [Callback]
//!                   (48kHz)                          (Resample to 16kHz)
//! ```
//!
//! # Example
//!
//! ```ignore
//! use raflow_lib::audio::AudioPipeline;
//!
//! let mut pipeline = AudioPipeline::new()?;
//! pipeline.start(|pcm_data| {
//!     // pcm_data is 16kHz i16 PCM
//!     println!("Received {} samples", pcm_data.len());
//! })?;
//!
//! // Later...
//! pipeline.stop();
//! # Ok::<(), raflow_lib::audio::PipelineError>(())
//! ```

use crate::audio::{AudioCapture, CaptureError, Resampler, ResamplerError};
// Ring buffer traits no longer needed
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;
use thiserror::Error;

/// Pipeline errors
#[derive(Error, Debug)]
pub enum PipelineError {
    /// Error from audio capture
    #[error("Capture error: {0}")]
    Capture(#[from] CaptureError),

    /// Error from resampler
    #[error("Resampler error: {0}")]
    Resampler(#[from] ResamplerError),

    /// Pipeline is already running
    #[error("Pipeline already running")]
    AlreadyRunning,

    /// Pipeline is not running
    #[error("Pipeline not running")]
    NotRunning,
}

/// Callback type for processed audio data
///
/// The callback receives resampled 16kHz mono PCM data as i16 samples.
pub type AudioCallback = Box<dyn Fn(Vec<i16>) + Send + 'static>;

/// Audio pipeline state
///
/// Manages the complete audio processing pipeline from capture to output.
/// The pipeline runs asynchronously with capture and processing on separate threads.
pub struct AudioPipeline {
    /// Audio capture handle
    capture: AudioCapture,
    /// Flag indicating if pipeline is running
    is_running: Arc<AtomicBool>,
    /// Handle to the processor thread
    processor_handle: Option<JoinHandle<()>>,
}

impl AudioPipeline {
    /// Create a new audio pipeline
    ///
    /// Initializes the audio capture device but does not start capturing.
    ///
    /// # Errors
    ///
    /// Returns [`PipelineError::Capture`] if the audio device cannot be initialized.
    ///
    /// # Example
    ///
    /// ```ignore
    /// use raflow_lib::audio::AudioPipeline;
    ///
    /// let pipeline = AudioPipeline::new()?;
    /// # Ok::<(), raflow_lib::audio::PipelineError>(())
    /// ```
    pub fn new() -> Result<Self, PipelineError> {
        let capture = AudioCapture::new()?;
        Ok(Self {
            capture,
            is_running: Arc::new(AtomicBool::new(false)),
            processor_handle: None,
        })
    }

    /// Get the input sample rate
    ///
    /// Returns the sample rate of the capture device in Hz.
    #[must_use]
    pub fn sample_rate(&self) -> u32 {
        self.capture.sample_rate()
    }

    /// Check if the pipeline is currently running
    #[must_use]
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Start the audio pipeline
    ///
    /// Begins capturing audio and processing it through the resampler.
    /// The callback is invoked with resampled 16kHz PCM data.
    ///
    /// # Arguments
    ///
    /// * `callback` - Function called with resampled 16kHz i16 PCM data
    ///
    /// # Errors
    ///
    /// - [`PipelineError::AlreadyRunning`] if pipeline is already running
    /// - [`PipelineError::Capture`] if audio capture fails to start
    /// - [`PipelineError::Resampler`] if resampler fails to initialize
    ///
    /// # Example
    ///
    /// ```ignore
    /// use raflow_lib::audio::AudioPipeline;
    ///
    /// let mut pipeline = AudioPipeline::new()?;
    /// pipeline.start(|pcm| {
    ///     // Process 16kHz PCM data
    /// })?;
    /// # Ok::<(), raflow_lib::audio::PipelineError>(())
    /// ```
    pub fn start<F>(&mut self, callback: F) -> Result<(), PipelineError>
    where
        F: Fn(Vec<i16>) + Send + 'static,
    {
        if self.is_running.load(Ordering::SeqCst) {
            return Err(PipelineError::AlreadyRunning);
        }

        let input_rate = self.capture.sample_rate();
        let output_rate = 16000; // Target sample rate for ElevenLabs
        let chunk_size = 1024;

        // Mark as running before starting capture
        self.is_running.store(true, Ordering::SeqCst);

        // Start audio capture (creates internal buffer)
        if let Err(e) = self.capture.start() {
            self.is_running.store(false, Ordering::SeqCst);
            return Err(e.into());
        }

        // Get buffer reference from capture
        let buffer = self.capture.buffer();

        // Spawn processor thread
        let is_running = self.is_running.clone();
        let handle = thread::spawn(move || {
            // Create resampler in processor thread
            let mut resampler = match Resampler::new(input_rate, output_rate, chunk_size) {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to create resampler: {}", e);
                    return;
                }
            };

            // Internal resampler buffer for partial chunks (persisted across calls)
            let mut resampler_internal_buffer = Vec::with_capacity(chunk_size * 2);

            // Temporary buffer for collecting samples from ring buffer
            let mut input_chunk = Vec::with_capacity(chunk_size);

            tracing::info!(
                "Audio processor started: {}Hz -> {}Hz, chunk_size={}",
                input_rate,
                output_rate,
                chunk_size
            );

            // DEBUG: Track if we ever get data from buffer
            let mut debug_samples_count = 0usize;

            while is_running.load(Ordering::SeqCst) {
                // Collect samples from capture buffer
                input_chunk.clear();
                {
                    let mut buf = buffer.lock().unwrap();
                    while let Some(sample) = buf.pop() {
                        input_chunk.push(sample);
                    }
                    if !input_chunk.is_empty() && debug_samples_count < 3 {
                        debug_samples_count += 1;
                        let sum: f32 = input_chunk.iter().sum();
                        let first5: Vec<f32> = input_chunk.iter().take(5).copied().collect();
                        tracing::info!("[PIPELINE] Got {} samples from buffer, sum={:.6}, first5={:?}",
                            input_chunk.len(), sum, first5);
                    }
                }

                // Process using buffered method - handles partial chunks internally
                if !input_chunk.is_empty() {
                    match resampler.process_buffered(&input_chunk, &mut resampler_internal_buffer) {
                        Ok(pcm) => {
                            if !pcm.is_empty() {
                                if debug_samples_count <= 3 {
                                    let pcm_sum: i16 = pcm.iter().sum();
                                    tracing::info!("[PIPELINE] PCM output: {} samples, sum={}", pcm.len(), pcm_sum);
                                }
                                callback(pcm);
                            }
                        }
                        Err(e) => {
                            tracing::error!("Resampler error: {}", e);
                        }
                    }
                } else {
                    // No data available, yield to avoid busy spinning
                    thread::sleep(Duration::from_millis(1));
                }
            }

            tracing::info!("Audio processor stopped");
        });

        self.processor_handle = Some(handle);
        tracing::info!("Audio pipeline started");
        Ok(())
    }

    /// Stop the audio pipeline
    ///
    /// Stops audio capture and waits for the processor thread to finish.
    /// This method is idempotent - calling it when not running is safe.
    pub fn stop(&mut self) {
        if !self.is_running.load(Ordering::SeqCst) {
            return;
        }

        tracing::info!("Stopping audio pipeline...");

        // Signal threads to stop
        self.is_running.store(false, Ordering::SeqCst);

        // Stop capture
        self.capture.stop();

        // Wait for processor thread to finish
        if let Some(handle) = self.processor_handle.take() {
            if let Err(e) = handle.join() {
                tracing::error!("Processor thread panicked: {:?}", e);
            }
        }

        tracing::info!("Audio pipeline stopped");
    }
}

impl Default for AudioPipeline {
    fn default() -> Self {
        Self::new().expect("Failed to initialize default audio pipeline")
    }
}

impl Drop for AudioPipeline {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pipeline_error_display() {
        let err = PipelineError::AlreadyRunning;
        assert_eq!(err.to_string(), "Pipeline already running");

        let err = PipelineError::NotRunning;
        assert_eq!(err.to_string(), "Pipeline not running");

        let err = PipelineError::Capture(CaptureError::NoInputDevice);
        assert_eq!(err.to_string(), "Capture error: No input device available");

        let err = PipelineError::Resampler(ResamplerError::Creation("test".to_string()));
        assert_eq!(err.to_string(), "Resampler error: Failed to create resampler: test");
    }

    #[test]
    fn test_pipeline_creation() {
        // Note: This test may fail in CI environments without audio devices
        if let Ok(pipeline) = AudioPipeline::new() {
            assert!(!pipeline.is_running());
        }
    }

    #[test]
    fn test_already_running_error() {
        if let Ok(mut pipeline) = AudioPipeline::new() {
            // Try to start twice without stopping
            // Note: First start may fail in CI, so we only test the error case
            // if the first start succeeds
            let callback = |_: Vec<i16>| {};
            if pipeline.start(callback).is_ok() {
                let result = pipeline.start(|_: Vec<i16>| {});
                assert!(matches!(result, Err(PipelineError::AlreadyRunning)));
                pipeline.stop();
            }
        }
    }
}
