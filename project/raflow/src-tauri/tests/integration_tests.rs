// 端到端集成测试 - RaFlow
// 测试完整的音频录制 → 性能监控流程

#[cfg(test)]
mod integration_tests {
    use raflow::audio::pipeline::{AudioPipeline, PipelineConfig};
    use raflow::perf::{Metrics, MetricType};
    use std::time::Duration;
    use std::thread;

    #[test]
    fn test_audio_pipeline_lifecycle() {
        // 测试音频管道的完整生命周期
        let mut pipeline = AudioPipeline::with_default_config();

        // 初始状态
        assert!(!pipeline.is_running());
        assert_eq!(pipeline.total_frames(), 0);
        assert_eq!(pipeline.available_frames(), 0);
        assert_eq!(pipeline.buffer_usage(), 0.0);

        // 启动管道（如果可用音频设备）
        let start_result = pipeline.start();
        if start_result.is_ok() {
            assert!(pipeline.is_running());
            assert!(pipeline.elapsed_seconds().is_some());

            // 等待一小段时间收集数据
            thread::sleep(Duration::from_millis(100));

            // 读取数据
            let read_result = pipeline.read(100);
            if read_result.is_ok() {
                let data = read_result.unwrap();
                // 可能有一些数据，也可能没有
                println!("Read {} frames from pipeline", data.len());
            }

            // 停止管道
            pipeline.stop();
            assert!(!pipeline.is_running());
        } else {
            println!("Skipping audio pipeline test - no audio device available");
        }
    }

    #[test]
    fn test_metrics_recording() {
        // 测试指标记录功能
        let metrics = Metrics::new();

        // 记录各种延迟
        {
            let _timer = metrics.timer(MetricType::AudioLatency);
            thread::sleep(Duration::from_millis(10));
        }

        {
            let _timer = metrics.timer(MetricType::TranscriptionLatency);
            thread::sleep(Duration::from_millis(50));
        }

        {
            let _timer = metrics.timer(MetricType::E2ELatency);
            thread::sleep(Duration::from_millis(100));
        }

        // 记录吞吐量
        metrics.record_frames(1000);
        metrics.record_words(50);

        // 获取快照
        let snapshot = metrics.snapshot();

        // 验证延迟指标
        assert!(snapshot.audio_latency.is_some());
        assert!(snapshot.transcription_latency.is_some());
        assert!(snapshot.e2e_latency.is_some());

        // 验证吞吐量
        assert_eq!(snapshot.total_frames, 1000);
        assert_eq!(snapshot.total_words, 50);
        assert!(snapshot.uptime_seconds > 0.0);

        // 验证延迟统计
        let audio_latency = snapshot.audio_latency.unwrap();
        assert_eq!(audio_latency.count, 1);
        assert!(audio_latency.min.is_some());
        assert!(audio_latency.max.is_some());

        let transcription_latency = snapshot.transcription_latency.unwrap();
        assert_eq!(transcription_latency.count, 1);

        let e2e_latency = snapshot.e2e_latency.unwrap();
        assert_eq!(e2e_latency.count, 1);
    }

    #[test]
    fn test_metrics_percentiles() {
        // 测试百分位数计算
        let metrics = Metrics::new();

        // 记录一系列延迟值（使用更大的值以确保落在不同的桶中）
        for i in 1..=100 {
            // 将值放大到毫秒级别，确保分布在直方图的各个桶中
            metrics.record_audio_latency(i * 100);
        }

        let snapshot = metrics.snapshot();
        let audio_latency = snapshot.audio_latency.unwrap();

        // 验证百分位数存在
        let p50 = audio_latency.p50;
        let p95 = audio_latency.p95;
        let p99 = audio_latency.p99;

        assert!(p50.is_some(), "P50 should be calculated");
        assert!(p95.is_some(), "P95 should be calculated");
        assert!(p99.is_some(), "P99 should be calculated");

        // P50 应该大于等于 5000ms（50 * 100）
        assert!(p50.unwrap() >= 5000, "P50 = {}, expected >= 5000", p50.unwrap());

        // 验证有数据被记录
        assert_eq!(audio_latency.count, 100);
    }

    #[test]
    fn test_metrics_reset() {
        // 测试指标重置功能
        let metrics = Metrics::new();

        // 记录一些数据
        metrics.record_audio_latency(50);
        metrics.record_transcription_latency(100);
        metrics.record_e2e_latency(150);
        metrics.record_frames(1000);
        metrics.record_words(50);

        // 验证数据已记录
        let snapshot1 = metrics.snapshot();
        assert!(snapshot1.audio_latency.is_some());
        assert_eq!(snapshot1.total_frames, 1000);

        // 重置指标
        metrics.reset();

        // 验证数据已清除
        let snapshot2 = metrics.snapshot();
        assert!(snapshot2.audio_latency.is_none());
        assert_eq!(snapshot2.total_frames, 0);
        assert_eq!(snapshot2.total_words, 0);
    }

    #[test]
    fn test_timer_cancellation() {
        // 测试计时器取消功能
        let metrics = Metrics::new();

        // 创建并取消计时器
        {
            let timer = metrics.timer(MetricType::AudioLatency);
            thread::sleep(Duration::from_millis(10));
            timer.cancel(); // 取消计时，不记录延迟
        }

        // 验证没有记录任何延迟
        let snapshot = metrics.snapshot();
        assert!(snapshot.audio_latency.is_none());
    }

    #[test]
    fn test_concurrent_metrics_recording() {
        // 测试并发指标记录
        let metrics = std::sync::Arc::new(Metrics::new());
        let mut handles = vec![];

        // 创建多个线程同时记录指标
        for i in 0..10 {
            let metrics_clone = metrics.clone();
            let handle = thread::spawn(move || {
                for j in 0..100 {
                    metrics_clone.record_audio_latency((i * 100 + j) as u64);
                }
            });
            handles.push(handle);
        }

        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }

        // 验证所有数据都被记录
        let snapshot = metrics.snapshot();
        let audio_latency = snapshot.audio_latency.unwrap();
        assert_eq!(audio_latency.count, 1000); // 10 threads * 100 records
    }

    #[test]
    fn test_pipeline_config() {
        // 测试管道配置
        let config = PipelineConfig {
            target_sample_rate: 44100,
            channels: 2,
            buffer_size: 8192,
        };

        let pipeline = AudioPipeline::new(config.clone());

        assert_eq!(pipeline.config().target_sample_rate, 44100);
        assert_eq!(pipeline.config().channels, 2);
        assert_eq!(pipeline.config().buffer_size, 8192);
    }

    #[test]
    fn test_default_pipeline_config() {
        // 测试默认管道配置
        let pipeline = AudioPipeline::with_default_config();

        assert_eq!(pipeline.config().target_sample_rate, 16000);
        assert_eq!(pipeline.config().channels, 1);
        assert_eq!(pipeline.config().buffer_size, 16000 * 2);
    }
}
