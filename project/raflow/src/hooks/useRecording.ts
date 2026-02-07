// 录音控制 Hook - 封装录音和转录逻辑
import { useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useTranscriptionStore } from '../stores/useTranscriptionStore';
import { useApiConfigStore } from '../stores/useApiConfigStore';
import { audioCommands, transcriptionCommands } from '../lib/tauri';

/**
 * 录音控制 Hook
 * 提供开始/停止录音的功能，并处理错误状态
 */
export function useRecording() {
  const { isRecording, setRecording, setError, clearError } = useRecordingStore();
  const { setPartialTranscript, setCommittedTranscript, setConnected } = useTranscriptionStore();
  const { configStatus } = useApiConfigStore();

  /**
   * 监听转录事件
   */
  const setupTranscriptionListener = useCallback(() => {
    // 监听部分转录（实时）
    const unlistenPartial = listen('partial-transcript', (event: { payload: string }) => {
      setPartialTranscript(event.payload);
    });

    // 监听确认转录（最终结果）
    const unlistenCommitted = listen('committed-transcript', (event: { payload: string }) => {
      setCommittedTranscript(event.payload);
    });

    // 监听连接状态
    const unlistenConnected = listen('transcription-connected', () => {
      setConnected(true);
      clearError();
    });

    // 监听断开连接
    const unlistenDisconnected = listen('transcription-disconnected', () => {
      setConnected(false);
    });

    // 监听错误
    const unlistenError = listen('transcription-error', (event: { payload: string }) => {
      setError(event.payload);
    });

    return () => {
      unlistenPartial.then(fn => fn());
      unlistenCommitted.then(fn => fn());
      unlistenConnected.then(fn => fn());
      unlistenDisconnected.then(fn => fn());
      unlistenError.then(fn => fn());
    };
  }, [setPartialTranscript, setCommittedTranscript, setConnected, setError, clearError]);

  /**
   * 开始录音
   */
  const startRecording = useCallback(async () => {
    clearError();

    // 检查 API 配置
    if (!configStatus?.has_api_key) {
      setError('请先配置 ElevenLabs API 密钥');
      return;
    }

    try {
      // 启动音频录制
      await audioCommands.startRecording();

      // 启动转录
      await transcriptionCommands.startTranscription('default');

      // 设置事件监听
      const cleanup = setupTranscriptionListener();

      setRecording(true);
      return cleanup;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '开始录音失败';
      setError(errorMessage);
      console.error('Start recording error:', error);
      throw error;
    }
  }, [configStatus, clearError, setRecording, setupTranscriptionListener]);

  /**
   * 停止录音
   */
  const stopRecording = useCallback(async () => {
    clearError();
    try {
      // 停止转录
      await transcriptionCommands.stopTranscription();

      // 停止音频录制
      await audioCommands.stopRecording();

      setRecording(false);
      setConnected(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '停止录音失败';
      setError(errorMessage);
      console.error('Stop recording error:', error);
    }
  }, [setRecording, setConnected, setError, clearError]);

  /**
   * 切换录音状态
   */
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
