// 性能指标面板组件 - 显示实时性能数据
import { useEffect, useState } from 'react';
import { metricsCommands, audioCommands } from '../lib/tauri';
import type { MetricsSnapshot, PipelineStatus, HistogramSnapshot } from '../types';

interface MetricsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MetricsPanel({ isOpen, onClose }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);

  // 每秒更新一次指标
  useEffect(() => {
    if (!isOpen) return;

    const updateMetrics = async () => {
      try {
        const [metricsData, pipelineData] = await Promise.all([
          metricsCommands.getMetrics(),
          audioCommands.getPipelineStatus(),
        ]);
        setMetrics(metricsData);
        setPipeline(pipelineData);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleReset = async () => {
    try {
      await metricsCommands.resetMetrics();
      const [metricsData, pipelineData] = await Promise.all([
        metricsCommands.getMetrics(),
        audioCommands.getPipelineStatus(),
      ]);
      setMetrics(metricsData);
      setPipeline(pipelineData);
    } catch (error) {
      console.error('Failed to reset metrics:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">性能指标</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {metrics && pipeline && (
          <div className="space-y-6">
            {/* 音频管道状态 */}
            <section className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">音频管道</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">状态:</span>{' '}
                  <span className={pipeline.is_running ? 'text-green-400' : 'text-gray-400'}>
                    {pipeline.is_running ? '运行中' : '已停止'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">运行时间:</span>{' '}
                  <span className="text-white">
                    {pipeline.elapsed_seconds ? `${pipeline.elapsed_seconds.toFixed(1)}s` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">总帧数:</span>{' '}
                  <span className="text-white">{pipeline.total_frames.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">可用帧数:</span>{' '}
                  <span className="text-white">{pipeline.available_frames.toLocaleString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">缓冲区使用率:</span>{' '}
                  <span className="text-white">
                    {(pipeline.buffer_usage * 100).toFixed(1)}%
                  </span>
                  <div className="mt-1 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${pipeline.buffer_usage * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 延迟指标 */}
            <section className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">延迟指标</h3>
              <div className="space-y-4">
                {metrics.audio_latency && (
                  <LatencyCard title="音频采集延迟" histogram={metrics.audio_latency} />
                )}
                {metrics.transcription_latency && (
                  <LatencyCard title="转录延迟" histogram={metrics.transcription_latency} />
                )}
                {metrics.e2e_latency && (
                  <LatencyCard title="端到端延迟" histogram={metrics.e2e_latency} />
                )}
                {!metrics.audio_latency && !metrics.transcription_latency && !metrics.e2e_latency && (
                  <p className="text-gray-500 text-sm">暂无延迟数据</p>
                )}
              </div>
            </section>

            {/* 吞吐量指标 */}
            <section className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">吞吐量</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">总帧数:</span>{' '}
                  <span className="text-white">{metrics.total_frames.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">总字数:</span>{' '}
                  <span className="text-white">{metrics.total_words.toLocaleString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">运行时间:</span>{' '}
                  <span className="text-white">{metrics.uptime_seconds.toFixed(1)}s</span>
                </div>
              </div>
            </section>

            {/* 操作按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                重置指标
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface LatencyCardProps {
  title: string;
  histogram: HistogramSnapshot;
}

function LatencyCard({ title, histogram }: LatencyCardProps) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <h4 className="text-xs font-medium text-gray-400 mb-2">{title}</h4>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-gray-500">P50:</span>{' '}
          <span className="text-white">{histogram.p50 ?? '-'}ms</span>
        </div>
        <div>
          <span className="text-gray-500">P95:</span>{' '}
          <span className="text-white">{histogram.p95 ?? '-'}ms</span>
        </div>
        <div>
          <span className="text-gray-500">P99:</span>{' '}
          <span className="text-white">{histogram.p99 ?? '-'}ms</span>
        </div>
        <div>
          <span className="text-gray-500">平均:</span>{' '}
          <span className="text-white">
            {histogram.avg ? histogram.avg.toFixed(1) : '-'}ms
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">最小:</span>{' '}
          <span className="text-white">{histogram.min ?? '-'}ms</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">最大:</span>{' '}
          <span className="text-white">{histogram.max ?? '-'}ms</span>
        </div>
        <div className="col-span-4">
          <span className="text-gray-500">样本数:</span>{' '}
          <span className="text-white">{histogram.count.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
