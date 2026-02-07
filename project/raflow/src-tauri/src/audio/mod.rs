// Audio module - 音频处理模块
// 包含音频录制、重采样和高性能管道功能

pub mod recorder;
pub mod resampler;
pub mod pipeline;

// Re-export commonly used types
pub use recorder::{AudioRecorder, AudioDevice};
pub use resampler::AudioResampler;
pub use pipeline::{AudioPipeline, PipelineConfig, PipelineError, AudioFrame};
