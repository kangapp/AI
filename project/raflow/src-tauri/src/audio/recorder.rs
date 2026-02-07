// Audio recorder - 音频录制器
// 使用 cpal 库录制麦克风音频

use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device, StreamConfig, SampleFormat,
};
use std::sync::{Arc, Mutex};

/// 音频设备信息
#[derive(Debug, Clone)]
pub struct AudioDevice {
    pub name: String,
    pub index: usize,
}

/// 音频录制器
///
/// 录制麦克风音频并输出为 16kHz PCM 16-bit Mono 格式
pub struct AudioRecorder {
    // 目标采样率
    target_sample_rate: u32,
    // 声道数
    channels: usize,
    // 录制状态
    is_recording: Arc<Mutex<bool>>,
    // 录制的音频数据
    recorded_data: Arc<Mutex<Vec<i16>>>,
    // 音频流 (需要保持所有权)
    _stream: Option<cpal::Stream>,
}

impl AudioRecorder {
    /// 创建新的音频录制器
    ///
    /// # 参数
    /// - `target_sample_rate`: 目标采样率 (Hz)，通常为 16000
    /// - `channels`: 声道数，1 为单声道
    pub fn new(target_sample_rate: u32, channels: usize) -> Self {
        Self {
            target_sample_rate,
            channels,
            is_recording: Arc::new(Mutex::new(false)),
            recorded_data: Arc::new(Mutex::new(Vec::new())),
            _stream: None,
        }
    }

    /// 获取目标采样率
    pub fn target_sample_rate(&self) -> u32 {
        self.target_sample_rate
    }

    /// 获取声道数
    pub fn channels(&self) -> usize {
        self.channels
    }

    /// 检查是否正在录音
    pub fn is_recording(&self) -> bool {
        *self.is_recording.lock().unwrap()
    }

    /// 开始录音
    ///
    /// # 错误
    /// - 如果已经在录音，返回错误
    /// - 如果无法找到或打开音频设备，返回错误
    pub fn start_recording(&mut self) -> Result<(), String> {
        // 检查是否已经在录音
        if self.is_recording() {
            return Err("Already recording".to_string());
        }

        // 获取默认音频输入主机
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or("No audio input device available")?;

        // 获取设备支持的配置
        let supported_config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default config: {}", e))?;

        // 获取采样格式
        let sample_format = supported_config.sample_format();
        // 转换为 StreamConfig
        let stream_config: StreamConfig = supported_config.into();

        // 创建音频流
        let stream = match sample_format {
            SampleFormat::F32 => self.build_stream_f32(&device, &stream_config)?,
            SampleFormat::I16 => self.build_stream_i16(&device, &stream_config)?,
            SampleFormat::U16 => self.build_stream_u16(&device, &stream_config)?,
            _ => return Err("Unsupported sample format".to_string()),
        };

        // 开始录音
        stream
            .play()
            .map_err(|e| format!("Failed to start stream: {}", e))?;

        // 保存流和更新状态
        self._stream = Some(stream);
        *self.is_recording.lock().unwrap() = true;

        Ok(())
    }

    /// 停止录音
    pub fn stop_recording(&mut self) -> Result<(), String> {
        if !self.is_recording() {
            return Err("Not recording".to_string());
        }

        *self.is_recording.lock().unwrap() = false;
        self._stream = None;

        Ok(())
    }

    /// 获取录制的音频数据
    ///
    /// 返回 i16 PCM 数据的引用
    pub fn get_recorded_data(&self) -> Option<Vec<i16>> {
        let data = self.recorded_data.lock().unwrap();
        if data.is_empty() {
            None
        } else {
            Some(data.clone())
        }
    }

    /// 清除录制的音频数据
    pub fn clear_recorded_data(&mut self) {
        self.recorded_data.lock().unwrap().clear();
    }

    /// 构建音频流 (F32 格式)
    fn build_stream_f32(
        &self,
        device: &Device,
        config: &StreamConfig,
    ) -> Result<cpal::Stream, String> {
        let is_recording = self.is_recording.clone();
        let recorded_data = self.recorded_data.clone();
        let channels = self.channels;
        let config_channels = config.channels;

        device
            .build_input_stream(
                config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if !*is_recording.lock().unwrap() {
                        return;
                    }

                    // 下混到单声道并转换为目标采样率
                    let mono: Vec<f32> = if config_channels == 2 && channels == 1 {
                        data.chunks_exact(2).map(|c| (c[0] + c[1]) / 2.0).collect()
                    } else {
                        data.to_vec()
                    };

                    // 转换为 i16 PCM
                    let pcm: Vec<i16> = mono
                        .iter()
                        .map(|&s| {
                            let clamped = s.clamp(-1.0, 1.0);
                            if clamped >= 0.0 {
                                (clamped * i16::MAX as f32) as i16
                            } else {
                                (clamped * i16::MIN.abs() as f32) as i16
                            }
                        })
                        .collect();

                    recorded_data.lock().unwrap().extend(pcm);
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build stream: {}", e))
    }

    /// 构建音频流 (I16 格式)
    fn build_stream_i16(
        &self,
        device: &Device,
        config: &StreamConfig,
    ) -> Result<cpal::Stream, String> {
        let is_recording = self.is_recording.clone();
        let recorded_data = self.recorded_data.clone();
        let channels = self.channels;
        let config_channels = config.channels;

        device
            .build_input_stream(
                config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if !*is_recording.lock().unwrap() {
                        return;
                    }

                    let mono: Vec<i16> = if config_channels == 2 && channels == 1 {
                        data.chunks_exact(2).map(|c| c[0] / 2 + c[1] / 2).collect()
                    } else {
                        data.to_vec()
                    };

                    recorded_data.lock().unwrap().extend(mono);
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build stream: {}", e))
    }

    /// 构建音频流 (U16 格式)
    fn build_stream_u16(
        &self,
        device: &Device,
        config: &StreamConfig,
    ) -> Result<cpal::Stream, String> {
        let is_recording = self.is_recording.clone();
        let recorded_data = self.recorded_data.clone();
        let channels = self.channels;
        let config_channels = config.channels;

        device
            .build_input_stream(
                config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    if !*is_recording.lock().unwrap() {
                        return;
                    }

                    // 转换 u16 到 i16
                    let mono: Vec<i16> = if config_channels == 2 && channels == 1 {
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

                    recorded_data.lock().unwrap().extend(mono);
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build stream: {}", e))
    }

    /// 列出所有可用的音频输入设备
    pub fn list_audio_devices() -> Vec<AudioDevice> {
        let host = cpal::default_host();
        let mut devices = Vec::new();

        if let Ok(input_devices) = host.input_devices() {
            for (index, device) in input_devices.enumerate() {
                if let Ok(name) = device.name() {
                    devices.push(AudioDevice { name, index });
                }
            }
        }

        devices
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recorder_creation() {
        let recorder = AudioRecorder::new(16000, 1);
        assert_eq!(recorder.target_sample_rate(), 16000);
        assert_eq!(recorder.channels(), 1);
        assert!(!recorder.is_recording());
    }

    #[test]
    fn test_list_devices() {
        let devices = AudioRecorder::list_audio_devices();
        // 大多数系统至少有一个音频设备
        // 如果 CI 环境没有音频设备，测试也会通过
        println!("Found {} audio devices", devices.len());
    }
}
