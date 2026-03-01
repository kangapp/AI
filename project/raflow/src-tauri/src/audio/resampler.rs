//! Audio resampling from 48kHz to 16kHz
//!
//! This module provides audio resampling functionality to convert
//! microphone audio (48kHz) to the format required by ElevenLabs API (16kHz).

use rubato::{FftFixedIn, Resampler as RubatoResampler};
use thiserror::Error;

/// Resampler errors
#[derive(Error, Debug)]
pub enum ResamplerError {
    /// Failed to create resampler
    #[error("Failed to create resampler: {0}")]
    Creation(String),

    /// Failed to process audio
    #[error("Failed to process audio: {0}")]
    Process(String),

    /// Insufficient input samples
    #[error("Insufficient input samples: required {required}, got {got}")]
    InsufficientInput {
        /// Required number of samples
        required: usize,
        /// Actual number of samples provided
        got: usize,
    },
}

/// Audio resampler: converts sample rate from input to output
///
/// Default configuration: 48kHz → 16kHz for mono audio
///
/// # Example
///
/// ```ignore
/// use raflow_lib::audio::resampler::{Resampler, ResamplerError};
///
/// let mut resampler = Resampler::new(48000, 16000, 1024)?;
/// let input = vec![0.0f32; 1024]; // 1024 samples at 48kHz
/// let output = resampler.process(&input)?; // ~341 samples at 16kHz
/// ```
pub struct Resampler {
    /// Inner FFT-based resampler
    inner: FftFixedIn<f32>,
    /// Number of input frames required per processing call
    chunk_size: usize,
    /// Input sample rate in Hz
    input_rate: u32,
    /// Output sample rate in Hz
    output_rate: u32,
}

impl Resampler {
    /// Create a new resampler
    ///
    /// # Arguments
    ///
    /// * `input_rate` - Input sample rate in Hz (e.g., 48000)
    /// * `output_rate` - Output sample rate in Hz (e.g., 16000)
    /// * `chunk_size` - Number of input frames per processing call
    ///
    /// # Errors
    ///
    /// Returns `ResamplerError::Creation` if the resampler fails to initialize
    pub fn new(
        input_rate: u32,
        output_rate: u32,
        chunk_size: usize,
    ) -> Result<Self, ResamplerError> {
        // FftFixedIn requires sub-chunks parameter (2 is a reasonable default for quality)
        let sub_chunks = 2;

        let inner = FftFixedIn::<f32>::new(
            input_rate as usize,
            output_rate as usize,
            chunk_size,
            sub_chunks,
            1, // 1 channel (mono)
        )
        .map_err(|e| ResamplerError::Creation(e.to_string()))?;

        Ok(Self {
            inner,
            chunk_size,
            input_rate,
            output_rate,
        })
    }

    /// Get required input chunk size
    ///
    /// Returns the number of input frames required for each `process` call
    #[must_use]
    pub const fn chunk_size(&self) -> usize {
        self.chunk_size
    }

    /// Get the input sample rate
    #[must_use]
    pub const fn input_rate(&self) -> u32 {
        self.input_rate
    }

    /// Get the output sample rate
    #[must_use]
    pub const fn output_rate(&self) -> u32 {
        self.output_rate
    }

    /// Get the expected output size for a given input
    ///
    /// This is an approximation based on the sample rate ratio
    #[must_use]
    pub fn output_size(&self, input_len: usize) -> usize {
        let ratio = self.output_rate as f64 / self.input_rate as f64;
        (input_len as f64 * ratio) as usize
    }

    /// Resample a chunk of audio data
    ///
    /// # Arguments
    ///
    /// * `input` - f32 samples at input_rate (normalized to -1.0 to 1.0)
    ///
    /// # Returns
    ///
    /// i16 PCM samples at output_rate
    ///
    /// # Errors
    ///
    /// Returns `ResamplerError::InsufficientInput` if input is smaller than chunk_size
    /// Returns `ResamplerError::Process` if resampling fails
    pub fn process(&mut self, input: &[f32]) -> Result<Vec<i16>, ResamplerError> {
        if input.len() < self.chunk_size {
            return Err(ResamplerError::InsufficientInput {
                required: self.chunk_size,
                got: input.len(),
            });
        }

        // Wrap input in Vec<Vec<f32>> format (1 channel)
        // Only use chunk_size samples
        let input_wrapped: Vec<Vec<f32>> = vec![input[..self.chunk_size].to_vec()];

        // Process resampling
        let output = self
            .inner
            .process(&input_wrapped, None)
            .map_err(|e| ResamplerError::Process(e.to_string()))?;

        // Convert f32 to i16 PCM
        let pcm: Vec<i16> = output[0]
            .iter()
            .map(|&s| {
                let clamped = s.clamp(-1.0, 1.0);
                if clamped >= 0.0 {
                    (clamped * 32767.0) as i16
                } else {
                    (clamped * 32768.0) as i16
                }
            })
            .collect();

        Ok(pcm)
    }

    /// Process with input buffering for partial chunks
    ///
    /// This method buffers input samples until enough are available,
    /// then processes and returns any available output.
    ///
    /// # Arguments
    ///
    /// * `input` - New input samples
    /// * `buffer` - Internal buffer to accumulate partial chunks
    ///
    /// # Returns
    ///
    /// Output samples (may be empty if not enough input accumulated)
    pub fn process_buffered(
        &mut self,
        input: &[f32],
        buffer: &mut Vec<f32>,
    ) -> Result<Vec<i16>, ResamplerError> {
        buffer.extend_from_slice(input);

        let mut all_output = Vec::new();

        while buffer.len() >= self.chunk_size {
            // Process one chunk
            let output = self.process(buffer)?;
            all_output.extend(output);

            // Remove processed samples from buffer
            buffer.drain(..self.chunk_size);
        }

        Ok(all_output)
    }
}

impl Default for Resampler {
    fn default() -> Self {
        Self::new(48000, 16000, 1024).expect("Failed to create default resampler")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resampler_creation() {
        let resampler = Resampler::new(48000, 16000, 1024);
        assert!(resampler.is_ok());

        let resampler = resampler.unwrap();
        assert_eq!(resampler.input_rate(), 48000);
        assert_eq!(resampler.output_rate(), 16000);
        assert_eq!(resampler.chunk_size(), 1024);
    }

    #[test]
    fn test_resampler_default() {
        let resampler = Resampler::default();
        assert_eq!(resampler.input_rate(), 48000);
        assert_eq!(resampler.output_rate(), 16000);
        assert_eq!(resampler.chunk_size(), 1024);
    }

    #[test]
    fn test_insufficient_input() {
        let mut resampler = Resampler::default();
        let input = vec![0.0f32; 512]; // Less than chunk_size (1024)

        let result = resampler.process(&input);
        assert!(result.is_err());

        if let Err(ResamplerError::InsufficientInput { required, got }) = result {
            assert_eq!(required, 1024);
            assert_eq!(got, 512);
        } else {
            panic!("Expected InsufficientInput error");
        }
    }

    #[test]
    fn test_silence_resampling() {
        let mut resampler = Resampler::default();
        let input = vec![0.0f32; 1024];

        let output = resampler.process(&input).unwrap();

        // 48kHz to 16kHz = 1/3 ratio, but FFT resampling may produce different sizes
        // Just verify we get some output
        println!("Output length: {}", output.len());
        assert!(!output.is_empty(), "Output should not be empty");

        // All samples should be zero or near-zero (silence)
        for sample in &output {
            assert!(
                sample.abs() < 10,
                "Expected silence but got {}",
                sample
            );
        }
    }

    #[test]
    fn test_pcm_conversion() {
        let mut resampler = Resampler::default();

        // Create input with maximum positive values
        let input = vec![1.0f32; 1024];
        let output = resampler.process(&input).unwrap();

        // Check that values are converted correctly (should be close to 32767)
        // Note: Due to resampling, not all values will be exactly 32767
        let max_val = output.iter().max().copied().unwrap_or(0);
        assert!(max_val > 30000, "Expected max value > 30000, got {}", max_val);
    }

    #[test]
    fn test_negative_pcm_conversion() {
        let mut resampler = Resampler::default();

        // Create input with maximum negative values
        let input = vec![-1.0f32; 1024];
        let output = resampler.process(&input).unwrap();

        // Check that values are converted correctly (should be close to -32768)
        let min_val = output.iter().min().copied().unwrap_or(0);
        assert!(min_val < -30000, "Expected min value < -30000, got {}", min_val);
    }

    #[test]
    fn test_output_size_estimation() {
        let resampler = Resampler::default();

        // 48kHz to 16kHz = 1/3 ratio
        assert_eq!(resampler.output_size(1024), 341);
        assert_eq!(resampler.output_size(48000), 16000);
    }

    #[test]
    fn test_buffered_processing() {
        let mut resampler = Resampler::default();
        let mut buffer = Vec::new();

        // Send partial chunk
        let input1 = vec![0.0f32; 512];
        let output1 = resampler.process_buffered(&input1, &mut buffer).unwrap();
        assert!(output1.is_empty()); // Not enough data yet

        // Send another partial chunk to complete
        let input2 = vec![0.0f32; 512];
        let output2 = resampler.process_buffered(&input2, &mut buffer).unwrap();
        assert!(!output2.is_empty()); // Should have output now
    }
}
