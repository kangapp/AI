// Histogram - 直方图实现
// 用于计算百分位数（P50, P95, P99 等）

/// 直方图配置
#[derive(Debug, Clone)]
pub struct HistogramConfig {
    /// 最大值（超过此值的样本会被记录在最大桶中）
    pub max_value: u64,
    /// 桶的数量
    pub num_buckets: usize,
}

impl Default for HistogramConfig {
    fn default() -> Self {
        Self {
            max_value: 10_000, // 10 秒（毫秒）
            num_buckets: 100,
        }
    }
}

/// 直方图
///
/// 用于收集和计算延迟分布的百分位数
pub struct Histogram {
    /// 桶配置
    config: HistogramConfig,
    /// 每个桶的样本计数
    buckets: Vec<u64>,
    /// 样本总数
    total_count: u64,
    /// 样本总和
    total_sum: u64,
    /// 最小值
    min_value: Option<u64>,
    /// 最大值
    max_value: Option<u64>,
}

impl Histogram {
    /// 创建新的直方图
    pub fn new(config: HistogramConfig) -> Self {
        let num_buckets = config.num_buckets;
        Self {
            config,
            buckets: vec![0; num_buckets],
            total_count: 0,
            total_sum: 0,
            min_value: None,
            max_value: None,
        }
    }

    /// 使用默认配置创建直方图
    pub fn with_default_config() -> Self {
        Self::new(HistogramConfig::default())
    }

    /// 记录一个值
    pub fn record(&mut self, value: u64) {
        let clamped = value.min(self.config.max_value);
        let bucket_index = self.bucket_index(clamped);

        if bucket_index < self.buckets.len() {
            self.buckets[bucket_index] += 1;
        } else {
            // 超出范围，记录在最后一个桶
            if let Some(last) = self.buckets.last_mut() {
                *last += 1;
            }
        }

        self.total_count += 1;
        self.total_sum += value;

        // 更新最小值和最大值
        self.min_value = Some(self.min_value.map_or(value, |m| m.min(value)));
        self.max_value = Some(self.max_value.map_or(value, |m| m.max(value)));
    }

    /// 计算百分位数
    ///
    /// # 参数
    /// - `percentile`: 百分位数 (0.0 - 100.0)，例如 95.0 表示 P95
    ///
    /// 返回该百分位数的值，如果没有样本则返回 None
    pub fn percentile(&self, percentile: f64) -> Option<u64> {
        if self.total_count == 0 {
            return None;
        }

        let target_count = (self.total_count as f64 * percentile / 100.0) as u64;
        let mut count = 0;

        for (i, &bucket_count) in self.buckets.iter().enumerate() {
            count += bucket_count;
            if count >= target_count {
                // 线性插值
                let bucket_size = self.config.max_value / self.config.num_buckets as u64;
                let bucket_start = i as u64 * bucket_size;
                return Some(bucket_start);
            }
        }

        Some(self.config.max_value)
    }

    /// 获取 P50 (中位数)
    pub fn p50(&self) -> Option<u64> {
        self.percentile(50.0)
    }

    /// 获取 P95
    pub fn p95(&self) -> Option<u64> {
        self.percentile(95.0)
    }

    /// 获取 P99
    pub fn p99(&self) -> Option<u64> {
        self.percentile(99.0)
    }

    /// 获取平均值
    pub fn avg(&self) -> Option<f64> {
        if self.total_count == 0 {
            return None;
        }
        Some(self.total_sum as f64 / self.total_count as f64)
    }

    /// 获取最小值
    pub fn min(&self) -> Option<u64> {
        self.min_value
    }

    /// 获取最大值
    pub fn max(&self) -> Option<u64> {
        self.max_value
    }

    /// 获取样本总数
    pub fn count(&self) -> u64 {
        self.total_count
    }

    /// 重置直方图
    pub fn reset(&mut self) {
        self.buckets.fill(0);
        self.total_count = 0;
        self.total_sum = 0;
        self.min_value = None;
        self.max_value = None;
    }

    /// 获取快照（用于导出）
    pub fn snapshot(&self) -> HistogramSnapshot {
        HistogramSnapshot {
            p50: self.p50(),
            p95: self.p95(),
            p99: self.p99(),
            avg: self.avg(),
            min: self.min(),
            max: self.max(),
            count: self.count(),
        }
    }

    /// 计算值对应的桶索引
    fn bucket_index(&self, value: u64) -> usize {
        if value >= self.config.max_value {
            return self.config.num_buckets - 1;
        }

        let bucket_size = self.config.max_value / self.config.num_buckets as u64;
        (value / bucket_size) as usize
    }
}

/// 直方图快照
#[derive(Debug, Clone, serde::Serialize)]
pub struct HistogramSnapshot {
    pub p50: Option<u64>,
    pub p95: Option<u64>,
    pub p99: Option<u64>,
    pub avg: Option<f64>,
    pub min: Option<u64>,
    pub max: Option<u64>,
    pub count: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_histogram_creation() {
        let hist = Histogram::with_default_config();
        assert_eq!(hist.count(), 0);
        assert_eq!(hist.min(), None);
        assert_eq!(hist.max(), None);
    }

    #[test]
    fn test_histogram_record() {
        let mut hist = Histogram::with_default_config();
        hist.record(100);
        hist.record(200);
        hist.record(300);

        assert_eq!(hist.count(), 3);
        assert_eq!(hist.min(), Some(100));
        assert_eq!(hist.max(), Some(300));
    }

    #[test]
    fn test_histogram_percentile() {
        let mut hist = Histogram::new(HistogramConfig {
            max_value: 1000,
            num_buckets: 10,
        });

        // 记录 100 个值：0-99
        for i in 0..100 {
            hist.record(i);
        }

        let p50 = hist.p50().unwrap();
        let p95 = hist.p95().unwrap();
        let p99 = hist.p99().unwrap();

        // 百分位计算依赖于桶大小
        // max_value=1000, num_buckets=10 => 每桶 100
        // 值 0-99 都落在第一个桶 (0-99)
        // P50, P95, P99 都应该是 0（第一个桶的起始值）
        assert_eq!(p50, 0);
        assert_eq!(p95, 0);
        assert_eq!(p99, 0);
    }

    #[test]
    fn test_histogram_avg() {
        let mut hist = Histogram::with_default_config();
        hist.record(100);
        hist.record(200);
        hist.record(300);

        let avg = hist.avg().unwrap();
        assert_eq!(avg, 200.0);
    }

    #[test]
    fn test_histogram_reset() {
        let mut hist = Histogram::with_default_config();
        hist.record(100);
        hist.record(200);

        assert_eq!(hist.count(), 2);

        hist.reset();
        assert_eq!(hist.count(), 0);
        assert_eq!(hist.min(), None);
        assert_eq!(hist.max(), None);
    }

    #[test]
    fn test_histogram_clamping() {
        let mut hist = Histogram::new(HistogramConfig {
            max_value: 100,
            num_buckets: 10,
        });

        // 超出 max_value 的值应该被限制
        hist.record(50);
        hist.record(150);
        hist.record(1000);

        assert_eq!(hist.count(), 3);
        assert_eq!(hist.min(), Some(50));
        // max() 记录的是实际输入值，不是限制后的值
        assert_eq!(hist.max(), Some(1000));
    }

    #[test]
    fn test_histogram_empty() {
        let hist = Histogram::with_default_config();
        assert_eq!(hist.p50(), None);
        assert_eq!(hist.p95(), None);
        assert_eq!(hist.p99(), None);
        assert_eq!(hist.avg(), None);
    }

    #[test]
    fn test_histogram_snapshot() {
        let mut hist = Histogram::with_default_config();
        hist.record(100);
        hist.record(200);

        let snapshot = hist.snapshot();
        assert_eq!(snapshot.count, 2);
        assert_eq!(snapshot.min, Some(100));
        assert_eq!(snapshot.max, Some(200));
    }
}
