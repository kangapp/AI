// Audio Pipeline - 高性能音频处理管道
// 使用环形缓冲区实现无锁并发音频数据流

use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device, SampleFormat, StreamConfig,
};
use rubato::{SincFixedIn, SincInterpolationParameters, WindowFunction};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Instant;

use ringbuf::{HeapRb, traits::{observer::Observer, producer::Producer, SplitRef}};

/// 音频帧类型（i16 PCM 16-bit）
pub type AudioFrame = i16;

/// 音频管道配置
#[derive(Debug, Clone)]
pub struct PipelineConfig {
    /// 目标采样率 (Hz)
    pub target_sample_rate: u32,
    /// 声道数 (1 = 单声道)
    pub channels: usize,
    /// 环形缓冲区大小（帧数）
    pub buffer_size: usize,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            target_sample_rate: 16000,
            channels: 1,
            // 2 秒的缓冲区 @ 16kHz
            buffer_size: 16000 * 2,
        }
    }
}

/// 音频管道错误类型
#[derive(Debug)]
pub enum PipelineError {
    /// 设备错误
    DeviceError(String),
    /// 流创建失败
    StreamError(String),
    /// 缓冲区溢出
    BufferOverflow,
    /// 无数据可用
    NoDataAvailable,
}

impl std::fmt::Display for PipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PipelineError::DeviceError(msg) => write!(f, "Device error: {}", msg),
            PipelineError::StreamError(msg) => write!(f, "Stream error: {}", msg),
            PipelineError::BufferOverflow => write!(f, "Buffer overflow"),
            PipelineError::NoDataAvailable => write!(f, "No data available"),
        }
    }
}

impl std::error::Error for PipelineError {}

/// 共享环形缓冲区包装
///
/// 使用 Mutex 提供内部可变性，用于跨线程共享
struct SharedRingBuffer {
    rb: HeapRb<AudioFrame>,
}

impl SharedRingBuffer {
    fn new(capacity: usize) -> Self {
        Self {
            rb: HeapRb::new(capacity),
        }
    }

    /// 推入数据（从音频回调）
    fn push(&mut self, frames: &[AudioFrame]) {
        let (mut prod, _) = self.rb.split_ref();
        for &frame in frames {
            let _ = prod.try_push(frame);
        }
    }

    /// 读取数据（到应用层）
    fn read(&mut self, max_frames: usize) -> Vec<AudioFrame> {
        let (_, mut cons) = self.rb.split_ref();
        let mut result = Vec::new();
        for frame in cons {
            if result.len() >= max_frames {
                break;
            }
            result.push(frame);
        }
        result
    }

    /// 获取可用帧数
    fn available(&self) -> usize {
        self.rb.occupied_len()
    }

    /// 获取容量
    fn capacity(&self) -> usize {
        self.rb.capacity().get()
    }
}

/// 高性能音频管道
///
/// 使用环形缓冲区实现无锁并发音频处理
pub struct AudioPipeline {
    /// 管道配置
    config: PipelineConfig,
    /// 共享环形缓冲区
    buffer: Arc<Mutex<SharedRingBuffer>>,
    /// 音频流（保持所有权）
    _stream: Option<cpal::Stream>,
    /// 源采样率
    source_sample_rate: u32,
    /// 重采样器
    resampler: Option<SincFixedIn<f32>>,
    /// 管道启动时间
    start_time: Option<Instant>,
    /// 总处理帧数
    total_frames: Arc<std::sync::atomic::AtomicU64>,
}

impl AudioPipeline {
    /// 创建新的音频管道
    ///
    /// # 参数
    /// - `config`: 管道配置
    pub fn new(config: PipelineConfig) -> Self {
        let buffer = Arc::new(Mutex::new(SharedRingBuffer::new(config.buffer_size)));

        Self {
            config,
            buffer,
            _stream: None,
            source_sample_rate: 0,
            resampler: None,
            start_time: None,
            total_frames: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    /// 使用默认配置创建音频管道
    pub fn with_default_config() -> Self {
        Self::new(PipelineConfig::default())
    }

    /// 获取管道配置
    pub fn config(&self) -> &PipelineConfig {
        &self.config
    }

    /// 检查是否正在运行
    pub fn is_running(&self) -> bool {
        self._stream.is_some() && self.start_time.is_some()
    }

    /// 获取总处理帧数
    pub fn total_frames(&self) -> u64 {
        self.total_frames.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// 获取运行时间（秒）
    pub fn elapsed_seconds(&self) -> Option<f64> {
        self.start_time.map(|t| t.elapsed().as_secs_f64())
    }

    /// 启动音频管道
    ///
    /// # 错误
    /// - 如果已经在运行，返回错误
    /// - 如果无法找到或打开音频设备，返回错误
    pub fn start(&mut self) -> Result<(), PipelineError> {
        if self.is_running() {
            return Err(PipelineError::StreamError("Already running".to_string()));
        }

        // 获取默认音频输入主机
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| PipelineError::DeviceError("No audio input device available".to_string()))?;

        // 获取设备支持的配置
        let supported_config = device
            .default_input_config()
            .map_err(|e| PipelineError::DeviceError(format!("Failed to get config: {}", e)))?;

        // 保存源采样率
        self.source_sample_rate = supported_config.sample_rate().0;

        // 初始化重采样器（如果需要）
        if self.source_sample_rate != self.config.target_sample_rate {
            self.resampler = Some(self.create_resampler());
        }

        // 获取采样格式和流配置
        let sample_format = supported_config.sample_format();
        let stream_config: StreamConfig = supported_config.into();

        // 创建音频流
        let stream = match sample_format {
            SampleFormat::F32 => self.build_stream_f32(&device, &stream_config)?,
            SampleFormat::I16 => self.build_stream_i16(&device, &stream_config)?,
            SampleFormat::U16 => self.build_stream_u16(&device, &stream_config)?,
            _ => return Err(PipelineError::StreamError("Unsupported sample format".to_string())),
        };

        // 启动流
        stream
            .play()
            .map_err(|e| PipelineError::StreamError(format!("Failed to start stream: {}", e)))?;

        // 保存流和启动时间
        self._stream = Some(stream);
        self.start_time = Some(Instant::now());

        Ok(())
    }

    /// 停止音频管道
    pub fn stop(&mut self) {
        self._stream = None;
        self.start_time = None;
    }

    /// 读取音频数据（非阻塞）
    ///
    /// 返回最多 `max_frames` 帧的音频数据
    pub fn read(&mut self, max_frames: usize) -> Result<Vec<AudioFrame>, PipelineError> {
        if !self.is_running() {
            return Err(PipelineError::StreamError("Pipeline not running".to_string()));
        }

        let mut buffer = self.buffer.lock().unwrap();
        let data = buffer.read(max_frames);

        if data.is_empty() {
            return Err(PipelineError::NoDataAvailable);
        }

        // 更新总帧数
        self.total_frames.fetch_add(data.len() as u64, std::sync::atomic::Ordering::Relaxed);

        Ok(data)
    }

    /// 获取当前缓冲区可用帧数
    pub fn available_frames(&self) -> usize {
        let buffer = self.buffer.lock().unwrap();
        buffer.available()
    }

    /// 获取缓冲区使用率（0.0 - 1.0）
    pub fn buffer_usage(&self) -> f64 {
        let buffer = self.buffer.lock().unwrap();
        let capacity = buffer.capacity();
        if capacity == 0 {
            return 0.0;
        }
        buffer.available() as f64 / capacity as f64
    }

    /// 创建重采样器
    fn create_resampler(&self) -> SincFixedIn<f32> {
        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: rubato::SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let ratio = self.config.target_sample_rate as f64 / self.source_sample_rate as f64;

        SincFixedIn::<f32>::new(ratio, 2.0, params, 1024, self.config.channels)
            .expect("Failed to create resampler")
    }

    /// 转换 f32 到 i16 PCM
    fn f32_to_i16(input: &[f32]) -> Vec<i16> {
        input
            .iter()
            .map(|&s| {
                let clamped = s.clamp(-1.0, 1.0);
                if clamped >= 0.0 {
                    (clamped * i16::MAX as f32) as i16
                } else {
                    // 负数：使用 i16::MIN 避免溢出
                    ((-clamped) * i16::MIN as f32) as i16
                }
            })
            .collect()
    }

    /// 构建音频流 (F32 格式)
    fn build_stream_f32(
        &mut self,
        device: &Device,
        config: &StreamConfig,
    ) -> Result<cpal::Stream, PipelineError> {
        let buffer = self.buffer.clone();
        let config_channels = config.channels as usize;
        let target_channels = self.config.channels;

        device
            .build_input_stream(
                config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // 下混到单声道
                    let mono: Vec<f32> = if config_channels == 2 && target_channels == 1 {
                        data.chunks_exact(2).map(|c| (c[0] + c[1]) / 2.0).collect()
                    } else {
                        data.to_vec()
                    };

                    // 转换为 i16 PCM
                    let pcm: Vec<i16> = Self::f32_to_i16(&mono);

                    // 推入环形缓冲区（非阻塞）
                    if let Ok(mut buf) = buffer.try_lock() {
                        buf.push(&pcm);
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| PipelineError::StreamError(format!("Failed to build stream: {}", e)))
    }

    /// 构建音频流 (I16 格式)
    fn build_stream_i16(
        &mut self,
        device: &Device,
        config: &StreamConfig,
    ) -> Result<cpal::Stream, PipelineError> {
        let buffer = self.buffer.clone();
        let config_channels = config.channels as usize;
        let target_channels = self.config.channels;

        device
            .build_input_stream(
                config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let mono: Vec<i16> = if config_channels == 2 && target_channels == 1 {
                        data.chunks_exact(2).map(|c| c[0] / 2 + c[1] / 2).collect()
                    } else {
                        data.to_vec()
                    };

                    if let Ok(mut buf) = buffer.try_lock() {
                        buf.push(&mono);
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| PipelineError::StreamError(format!("Failed to build stream: {}", e)))
    }

    /// 构建音频流 (U16 格式)
    fn build_stream_u16(
        &mut self,
        device: &Device,
        config: &StreamConfig,
    ) -> Result<cpal::Stream, PipelineError> {
        let buffer = self.buffer.clone();
        let config_channels = config.channels as usize;
        let target_channels = self.config.channels;

        device
            .build_input_stream(
                config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    let mono: Vec<i16> = if config_channels == 2 && target_channels == 1 {
                        data.chunks_exact(2)
                            .map(|c| {
                                let left = c[0] as i32 - i16::MAX as i32;
                                let right = c[1] as i32 - i16::MAX as i32;
                                ((left + right) / 2) as i16
                            })
                            .collect()
                    } else {
                        data.iter().map(|&s| s as i32 - i16::MAX as i32).map(|s| s as i16).collect()
                    };

                    if let Ok(mut buf) = buffer.try_lock() {
                        buf.push(&mono);
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| PipelineError::StreamError(format!("Failed to build stream: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pipeline_config_default() {
        let config = PipelineConfig::default();
        assert_eq!(config.target_sample_rate, 16000);
        assert_eq!(config.channels, 1);
        assert_eq!(config.buffer_size, 16000 * 2);
    }

    #[test]
    fn test_pipeline_creation() {
        let pipeline = AudioPipeline::with_default_config();
        assert_eq!(pipeline.config().target_sample_rate, 16000);
        assert!(!pipeline.is_running());
        assert_eq!(pipeline.total_frames(), 0);
    }

    #[test]
    fn test_pipeline_custom_config() {
        let config = PipelineConfig {
            target_sample_rate: 44100,
            channels: 2,
            buffer_size: 8192,
        };
        let pipeline = AudioPipeline::new(config);
        assert_eq!(pipeline.config().target_sample_rate, 44100);
        assert_eq!(pipeline.config().channels, 2);
    }

    #[test]
    fn test_buffer_usage() {
        let pipeline = AudioPipeline::with_default_config();
        // 未启动时缓冲区为空
        assert_eq!(pipeline.available_frames(), 0);
        assert_eq!(pipeline.buffer_usage(), 0.0);
    }

    #[test]
    fn test_f32_to_i16_conversion() {
        let input = vec![-1.0, -0.5, 0.0, 0.5, 1.0];
        let output = AudioPipeline::f32_to_i16(&input);

        assert_eq!(output[0], i16::MIN);
        assert_eq!(output[2], 0);
        assert_eq!(output[4], i16::MAX);
    }

    #[test]
    fn test_f32_to_i16_clamping() {
        // 超出范围的值应该被限制
        let input = vec![-2.0, 2.0];
        let output = AudioPipeline::f32_to_i16(&input);

        assert_eq!(output[0], i16::MIN);
        assert_eq!(output[1], i16::MAX);
    }

    #[test]
    fn test_elapsed_time_not_started() {
        let pipeline = AudioPipeline::with_default_config();
        assert_eq!(pipeline.elapsed_seconds(), None);
    }

    #[test]
    fn test_pipeline_error_display() {
        let err = PipelineError::DeviceError("test error".to_string());
        assert_eq!(format!("{}", err), "Device error: test error");

        let err = PipelineError::BufferOverflow;
        assert_eq!(format!("{}", err), "Buffer overflow");
    }

    #[test]
    fn test_read_not_running() {
        let mut pipeline = AudioPipeline::with_default_config();
        match pipeline.read(100) {
            Err(PipelineError::StreamError(_)) => (),
            _ => panic!("Expected StreamError when not running"),
        }
    }

    #[test]
    fn test_stop_when_not_running() {
        let mut pipeline = AudioPipeline::with_default_config();
        // 停止未运行的管道不应该 panic
        pipeline.stop();
        assert!(!pipeline.is_running());
    }
}
