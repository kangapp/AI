// Audio resampler - 音频重采样器
// 将不同采样率的音频转换到目标采样率

use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, WindowFunction};

/// 音频重采样器
///
/// 将输入音频从源采样率转换到目标采样率（16kHz）
pub struct AudioResampler {
    // rubato 重采样器
    resampler: Option<SincFixedIn<f32>>,
    // 源采样率
    source_rate: u32,
    // 目标采样率
    target_rate: u32,
    // 声道数
    channels: usize,
}

impl AudioResampler {
    /// 创建新的重采样器
    ///
    /// # 参数
    /// - `source_rate`: 源采样率 (Hz)
    /// - `target_rate`: 目标采样率 (Hz)
    /// - `channels`: 声道数 (1 = 单声道, 2 = 立体声)
    pub fn new(source_rate: u32, target_rate: u32, channels: usize) -> Self {
        // 如果源和目标采样率相同，不需要重采样器
        let resampler = if source_rate != target_rate {
            // 配置重采样参数
            let params = SincInterpolationParameters {
                sinc_len: 256,
                f_cutoff: 0.95,
                interpolation: rubato::SincInterpolationType::Linear,
                oversampling_factor: 256,
                window: WindowFunction::BlackmanHarris2,
            };

            // 计算重采样比例
            let ratio = target_rate as f64 / source_rate as f64;

            // 创建重采样器 (1024 是输入块大小)
            match SincFixedIn::<f32>::new(ratio, 2.0, params, 1024, channels) {
                Ok(r) => Some(r),
                Err(_) => None,
            }
        } else {
            None
        };

        Self {
            resampler,
            source_rate,
            target_rate,
            channels,
        }
    }

    /// 处理音频数据
    ///
    /// 将输入的 f32 音频数据重采样到目标采样率
    /// 如果是立体声输入，会自动下混到单声道
    pub fn process(&mut self, input: &[f32]) -> Vec<f32> {
        if input.is_empty() {
            return Vec::new();
        }

        // 如果源和目标采样率相同，直接返回输入
        if self.source_rate == self.target_rate {
            // 处理立体声下混
            if self.channels == 2 {
                return self.downmix_to_mono(input);
            }
            return input.to_vec();
        }

        // 立体声下混
        let mono_input = if self.channels == 2 {
            self.downmix_to_mono(input)
        } else {
            input.to_vec()
        };

        // 使用重采样器处理
        if let Some(ref mut resampler) = self.resampler {
            // 准备输入数据 (rubato 需要每个声道单独的向量)
            let input_frames = vec![mono_input.as_slice()];

            // 执行重采样
            match resampler.process(&input_frames, None) {
                Ok(output) => {
                    // rubato 返回 Vec<Vec<f32>>，我们需要展平它
                    output.into_iter().flatten().collect()
                }
                Err(_) => {
                    // 重采样失败，返回原始数据
                    mono_input
                }
            }
        } else {
            mono_input
        }
    }

    /// 立体声下混到单声道
    ///
    /// 取左右声道的平均值
    fn downmix_to_mono(&self, stereo_input: &[f32]) -> Vec<f32> {
        if self.channels != 2 {
            return stereo_input.to_vec();
        }

        stereo_input
            .chunks_exact(2)
            .map(|chunk| (chunk[0] + chunk[1]) / 2.0)
            .collect()
    }

    /// 将 f32 音频数据转换为 i16 PCM 格式
    ///
    /// f32 范围: -1.0 到 1.0
    /// i16 范围: -32768 到 32767
    pub fn to_pcm_16(&self, input: &[f32]) -> Vec<i16> {
        input
            .iter()
            .map(|&sample| {
                // 限制范围并转换
                let clamped = sample.clamp(-1.0, 1.0);
                // 使用 i32 中间值避免溢出
                let sample_i32 = (clamped * 32768.0) as i32;
                // 限制在 i16 范围内
                sample_i32.max(i16::MIN as i32).min(i16::MAX as i32) as i16
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resampler_creation() {
        let resampler = AudioResampler::new(44100, 16000, 1);
        assert_eq!(resampler.source_rate, 44100);
        assert_eq!(resampler.target_rate, 16000);
    }

    #[test]
    fn test_passthrough() {
        let mut resampler = AudioResampler::new(16000, 16000, 1);
        let input = vec![0.1, 0.2, 0.3];
        let output = resampler.process(&input);
        assert_eq!(output, input);
    }

    #[test]
    fn test_pcm_conversion() {
        let resampler = AudioResampler::new(16000, 16000, 1);
        let input = vec![-1.0, 0.0, 1.0];
        let output = resampler.to_pcm_16(&input);
        assert_eq!(output[0], i16::MIN);
        assert_eq!(output[1], 0);
        assert_eq!(output[2], i16::MAX);
    }
}
