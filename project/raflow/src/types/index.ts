// TypeScript 类型定义 - RaFlow 前端

// 转录消息类型（与后端保持一致）
export interface PartialTranscript {
  message_type: 'partial_transcript';
  text: string;
  created_at_ts: number;
}

export interface CommittedTranscript {
  message_type: 'committed_transcript';
  text: string;
  created_at_ts: number;
}

export type TranscriptMessage = PartialTranscript | CommittedTranscript;

// 录音状态
export interface RecordingState {
  isRecording: boolean;
  audioLevel: number; // 0-1，音频电平
  error: string | null;
}

// 转录状态
export interface TranscriptionState {
  isConnected: boolean;
  partialTranscript: string; // 实时转录（灰色）
  committedTranscript: string; // 确认转录（白色）
  error: string | null;
}

// 权限状态
export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'not-determined' | 'prompt';
  accessibility: 'granted' | 'denied' | 'not-determined' | 'prompt';
}

// 注入结果（与后端保持一致）
export type InjectResult = 'Injected' | 'ClipboardOnly' | 'Failed';

// 应用状态
export interface AppState {
  isPermissionGuideOpen: boolean;
  apiKey: string | null;
  language: string;
}

// 性能指标类型
export interface HistogramSnapshot {
  p50?: number;
  p95?: number;
  p99?: number;
  avg?: number;
  min?: number;
  max?: number;
  count: number;
}

export interface MetricsSnapshot {
  audio_latency?: HistogramSnapshot;
  transcription_latency?: HistogramSnapshot;
  e2e_latency?: HistogramSnapshot;
  total_frames: number;
  total_words: number;
  uptime_seconds: number;
}

export interface PipelineStatus {
  is_running: boolean;
  total_frames: number;
  elapsed_seconds?: number;
  available_frames: number;
  buffer_usage: number;
}
