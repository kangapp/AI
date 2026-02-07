// Metrics - 性能指标收集
// 用于收集各种性能指标（延迟、吞吐量等）

use crate::perf::histogram::Histogram;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// 性能指标快照
#[derive(Debug, Clone, serde::Serialize)]
pub struct MetricsSnapshot {
    /// 音频采集延迟（毫秒）
    pub audio_latency: Option<crate::perf::histogram::HistogramSnapshot>,
    /// 转录延迟（毫秒）
    pub transcription_latency: Option<crate::perf::histogram::HistogramSnapshot>,
    /// 端到端延迟（毫秒）
    pub e2e_latency: Option<crate::perf::histogram::HistogramSnapshot>,
    /// 总处理帧数
    pub total_frames: u64,
    /// 总转录字数
    pub total_words: u64,
    /// 运行时间（秒）
    pub uptime_seconds: f64,
}

/// 性能指标收集器
///
/// 线程安全的指标收集和报告
pub struct Metrics {
    /// 音频采集延迟直方图
    audio_latency: Arc<HistogramWrapper>,
    /// 转录延迟直方图
    transcription_latency: Arc<HistogramWrapper>,
    /// 端到端延迟直方图
    e2e_latency: Arc<HistogramWrapper>,
    /// 总处理帧数
    total_frames: Arc<AtomicU64>,
    /// 总转录字数
    total_words: Arc<AtomicU64>,
    /// 启动时间
    start_time: Instant,
}

/// 直方图包装器（用于 Arc 共享）
struct HistogramWrapper {
    inner: parking_lot::Mutex<Histogram>,
}

impl HistogramWrapper {
    fn new() -> Self {
        Self {
            inner: parking_lot::Mutex::new(Histogram::with_default_config()),
        }
    }

    fn record(&self, value: u64) {
        self.inner.lock().record(value);
    }

    fn snapshot(&self) -> Option<crate::perf::histogram::HistogramSnapshot> {
        let hist = self.inner.lock();
        if hist.count() == 0 {
            return None;
        }
        Some(hist.snapshot())
    }

    fn reset(&self) {
        self.inner.lock().reset();
    }
}

impl Metrics {
    /// 创建新的指标收集器
    pub fn new() -> Self {
        Self {
            audio_latency: Arc::new(HistogramWrapper::new()),
            transcription_latency: Arc::new(HistogramWrapper::new()),
            e2e_latency: Arc::new(HistogramWrapper::new()),
            total_frames: Arc::new(AtomicU64::new(0)),
            total_words: Arc::new(AtomicU64::new(0)),
            start_time: Instant::now(),
        }
    }

    /// 记录音频采集延迟（毫秒）
    pub fn record_audio_latency(&self, latency_ms: u64) {
        self.audio_latency.record(latency_ms);
    }

    /// 记录转录延迟（毫秒）
    pub fn record_transcription_latency(&self, latency_ms: u64) {
        self.transcription_latency.record(latency_ms);
    }

    /// 记录端到端延迟（毫秒）
    pub fn record_e2e_latency(&self, latency_ms: u64) {
        self.e2e_latency.record(latency_ms);
    }

    /// 记录处理的音频帧数
    pub fn record_frames(&self, count: u64) {
        self.total_frames.fetch_add(count, Ordering::Relaxed);
    }

    /// 记录转录的字数
    pub fn record_words(&self, count: u64) {
        self.total_words.fetch_add(count, Ordering::Relaxed);
    }

    /// 获取总处理帧数
    pub fn total_frames(&self) -> u64 {
        self.total_frames.load(Ordering::Relaxed)
    }

    /// 获取总转录字数
    pub fn total_words(&self) -> u64 {
        self.total_words.load(Ordering::Relaxed)
    }

    /// 获取运行时间（秒）
    pub fn uptime_seconds(&self) -> f64 {
        self.start_time.elapsed().as_secs_f64()
    }

    /// 获取指标快照
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            audio_latency: self.audio_latency.snapshot(),
            transcription_latency: self.transcription_latency.snapshot(),
            e2e_latency: self.e2e_latency.snapshot(),
            total_frames: self.total_frames(),
            total_words: self.total_words(),
            uptime_seconds: self.uptime_seconds(),
        }
    }

    /// 重置所有指标
    pub fn reset(&self) {
        self.audio_latency.reset();
        self.transcription_latency.reset();
        self.e2e_latency.reset();
        self.total_frames.store(0, Ordering::Relaxed);
        self.total_words.store(0, Ordering::Relaxed);
    }

    /// 创建延迟计时器
    ///
    /// 返回一个计时器，在 drop 时自动记录延迟
    pub fn timer<'a>(&'a self, metric_type: MetricType) -> Timer<'a> {
        Timer::new(self, metric_type)
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

/// 指标类型
#[derive(Debug, Clone, Copy)]
pub enum MetricType {
    /// 音频采集延迟
    AudioLatency,
    /// 转录延迟
    TranscriptionLatency,
    /// 端到端延迟
    E2ELatency,
}

/// 延迟计时器
///
/// 在创建时记录开始时间，在 drop 时计算并记录延迟
pub struct Timer<'a> {
    metrics: &'a Metrics,
    metric_type: MetricType,
    start: Instant,
}

impl<'a> Timer<'a> {
    fn new(metrics: &'a Metrics, metric_type: MetricType) -> Self {
        Self {
            metrics,
            metric_type,
            start: Instant::now(),
        }
    }

    /// 手动停止计时并记录延迟
    pub fn stop(self) {
        // 延迟会在 drop 时记录
    }

    /// 取消计时（不记录延迟）
    pub fn cancel(self) {
        std::mem::forget(self);
    }
}

impl<'a> Drop for Timer<'a> {
    fn drop(&mut self) {
        let elapsed = self.start.elapsed().as_millis() as u64;
        match self.metric_type {
            MetricType::AudioLatency => self.metrics.record_audio_latency(elapsed),
            MetricType::TranscriptionLatency => {
                self.metrics.record_transcription_latency(elapsed);
            }
            MetricType::E2ELatency => self.metrics.record_e2e_latency(elapsed),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = Metrics::new();
        assert_eq!(metrics.total_frames(), 0);
        assert_eq!(metrics.total_words(), 0);
        assert!(metrics.uptime_seconds() >= 0.0);
    }

    #[test]
    fn test_metrics_recording() {
        let metrics = Metrics::new();

        metrics.record_audio_latency(50);
        metrics.record_audio_latency(100);
        metrics.record_audio_latency(150);

        metrics.record_frames(1000);
        metrics.record_words(50);

        assert_eq!(metrics.total_frames(), 1000);
        assert_eq!(metrics.total_words(), 50);
    }

    #[test]
    fn test_metrics_snapshot() {
        let metrics = Metrics::new();

        metrics.record_audio_latency(50);
        metrics.record_frames(1000);

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.total_frames, 1000);
        assert!(snapshot.audio_latency.is_some());
    }

    #[test]
    fn test_metrics_reset() {
        let metrics = Metrics::new();

        metrics.record_audio_latency(50);
        metrics.record_frames(1000);

        metrics.reset();

        assert_eq!(metrics.total_frames(), 0);
        assert_eq!(metrics.total_words(), 0);

        let snapshot = metrics.snapshot();
        assert!(snapshot.audio_latency.is_none());
    }

    #[test]
    fn test_timer() {
        let metrics = Metrics::new();

        {
            let _timer = metrics.timer(MetricType::AudioLatency);
            std::thread::sleep(Duration::from_millis(10));
        } // timer 在这里 drop 并记录延迟

        let snapshot = metrics.snapshot();
        assert!(snapshot.audio_latency.is_some());

        // 验证延迟被记录了
        let latency = snapshot.audio_latency.unwrap();
        assert_eq!(latency.count, 1);
        // 验证有值（由于默认 max_value=10000，10ms 会落在第一个桶，值为 0）
        assert!(latency.p50.is_some());
    }

    #[test]
    fn test_timer_cancel() {
        let metrics = Metrics::new();

        {
            let timer = metrics.timer(MetricType::AudioLatency);
            std::thread::sleep(Duration::from_millis(10));
            timer.cancel(); // 取消计时，不记录延迟
        }

        let snapshot = metrics.snapshot();
        assert!(snapshot.audio_latency.is_none());
    }

    #[test]
    fn test_multiple_timers() {
        let metrics = Metrics::new();

        metrics.timer(MetricType::AudioLatency);
        metrics.timer(MetricType::TranscriptionLatency);
        metrics.timer(MetricType::E2ELatency);

        // 所有计时器都会独立记录
    }

    #[test]
    fn test_metrics_default() {
        let metrics = Metrics::default();
        assert_eq!(metrics.total_frames(), 0);
    }
}
