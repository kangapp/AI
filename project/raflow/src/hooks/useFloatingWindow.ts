// 悬浮窗控制 Hook - 整合录音和转录功能
import { useCallback } from 'react';
import { useRecording } from './useRecording';
import { useTranscription } from './useTranscription';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useTranscriptionStore } from '../stores/useTranscriptionStore';
import { useAppStore } from '../stores/useAppStore';
import { injectionCommands } from '../lib/tauri';

/**
 * 悬浮窗控制 Hook
 * 整合录音和转录功能，提供完整的用户交互逻辑
 */
export function useFloatingWindow() {
  const { isRecording, startRecording, stopRecording } = useRecording();
  const { isConnected, startTranscription, stopTranscription } =
    useTranscription();
  const { apiKey, setPermissionGuideOpen } = useAppStore();
  const { partialTranscript, committedTranscript, error: transcriptionError } =
    useTranscriptionStore();
  const { error: recordingError } = useRecordingStore();

  /**
   * 开始录音和转录
   */
  const start = useCallback(async () => {
    // 检查 API 密钥
    if (!apiKey) {
      setPermissionGuideOpen(true);
      return;
    }

    await startRecording();
    await startTranscription();
  }, [apiKey, startRecording, startTranscription, setPermissionGuideOpen]);

  /**
   * 停止录音和转录
   */
  const stop = useCallback(async () => {
    await stopRecording();
    await stopTranscription();
  }, [stopRecording, stopTranscription]);

  /**
   * 切换录音状态
   */
  const toggle = useCallback(async () => {
    if (isRecording) {
      await stop();
    } else {
      await start();
    }
  }, [isRecording, start, stop]);

  /**
   * 注入文本到剪贴板
   */
  const injectTranscript = useCallback(async () => {
    if (!committedTranscript) return;

    try {
      const result = await injectionCommands.injectText(committedTranscript);
      console.log('Inject result:', result);
    } catch (error) {
      console.error('Inject text error:', error);
    }
  }, [committedTranscript]);

  /**
   * 清空转录内容
   */
  const clearTranscript = useCallback(() => {
    const { setPartialTranscript, setCommittedTranscript } =
      useTranscriptionStore.getState();
    setPartialTranscript('');
    setCommittedTranscript('');
  }, []);

  return {
    // 状态
    isRecording,
    isConnected,
    partialTranscript,
    committedTranscript,
    error: recordingError || transcriptionError,
    apiKey,

    // 操作
    start,
    stop,
    toggle,
    injectTranscript,
    clearTranscript,
  };
}
