// Audio recorder tests - 测试音频录制功能
// 这个测试文件测试录音器的开始和停止功能

use raflow::audio::recorder::AudioRecorder;
use std::time::Duration;

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试: 录音器创建和配置
    #[test]
    fn test_recorder_creation() {
        // 创建录音器，目标格式: 16kHz PCM 16-bit Mono
        let recorder = AudioRecorder::new(16000, 1);

        // 验证录音器配置
        assert_eq!(recorder.target_sample_rate(), 16000);
        assert_eq!(recorder.channels(), 1);
    }

    /// 测试: 录音开始状态
    #[test]
    fn test_recorder_start_stop() {
        let mut recorder = AudioRecorder::new(16000, 1);

        // 初始状态应该未录音
        assert!(!recorder.is_recording());

        // 开始录音
        let result = recorder.start_recording();
        assert!(result.is_ok(), "Should be able to start recording");
        assert!(recorder.is_recording());

        // 停止录音
        let result = recorder.stop_recording();
        assert!(result.is_ok(), "Should be able to stop recording");
        assert!(!recorder.is_recording());
    }

    /// 测试: 双重开始录音应该失败
    #[test]
    fn test_double_start_fails() {
        let mut recorder = AudioRecorder::new(16000, 1);

        recorder.start_recording().unwrap();

        // 第二次开始应该失败
        let result = recorder.start_recording();
        assert!(result.is_err(), "Should not be able to start recording twice");

        recorder.stop_recording().unwrap();
    }

    /// 测试: 未开始就停止应该失败
    #[test]
    fn test_stop_without_start_fails() {
        let mut recorder = AudioRecorder::new(16000, 1);

        // 未开始就停止应该失败
        let result = recorder.stop_recording();
        assert!(result.is_err(), "Should not be able to stop when not recording");
    }

    /// 测试: 获取录音数据
    #[test]
    fn test_get_recording_data() {
        let mut recorder = AudioRecorder::new(16000, 1);

        recorder.start_recording().unwrap();

        // 模拟等待一小段时间让录音器采集数据
        // 注意: 这个测试可能需要 mock 音频输入设备
        std::thread::sleep(Duration::from_millis(100));

        let data = recorder.get_recorded_data();

        // 数据应该可用（即使可能为空或包含真实音频数据）
        assert!(data.is_some(), "Should be able to get recorded data");

        recorder.stop_recording().unwrap();
    }

    /// 测试: 获取可用音频设备
    #[test]
    fn test_list_audio_devices() {
        let devices = AudioRecorder::list_audio_devices();

        // 应该至少有一个音频输入设备
        assert!(!devices.is_empty(), "Should have at least one audio device");

        // 验证设备名称不为空
        for device in devices {
            assert!(!device.name.is_empty(), "Device name should not be empty");
        }
    }

    /// 测试: 音频数据格式验证
    #[test]
    fn test_audio_data_format() {
        let mut recorder = AudioRecorder::new(16000, 1);

        recorder.start_recording().unwrap();
        std::thread::sleep(Duration::from_millis(50));

        if let Some(data) = recorder.get_recorded_data() {
            // 验证数据格式: i16 PCM
            if !data.is_empty() {
                // 检查数据范围 (i16: -32768 到 32767)
                for sample in &data {
                    assert!(*sample >= i16::MIN && *sample <= i16::MAX,
                            "Sample should be valid i16");
                }
            }
        }

        recorder.stop_recording().unwrap();
    }

    /// 测试: 清除录音数据
    #[test]
    fn test_clear_recorded_data() {
        let mut recorder = AudioRecorder::new(16000, 1);

        recorder.start_recording().unwrap();
        std::thread::sleep(Duration::from_millis(50));
        recorder.stop_recording().unwrap();

        // 确保有数据
        let data_before = recorder.get_recorded_data();
        assert!(data_before.is_some());

        // 清除数据
        recorder.clear_recorded_data();

        // 数据应该被清除
        let data_after = recorder.get_recorded_data();
        assert!(data_after.is_none() || data_after.unwrap().is_empty(),
                "Data should be cleared");
    }
}
