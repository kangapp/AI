// Audio module - 音频处理模块
// 包含音频录制和重采样功能

pub mod recorder;
pub mod resampler;

// Re-export commonly used types
pub use recorder::{AudioRecorder, AudioDevice};
pub use resampler::AudioResampler;
