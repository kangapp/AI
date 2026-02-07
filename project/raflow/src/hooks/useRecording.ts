// 录音控制 Hook - 封装录音逻辑
import { useCallback } from 'react';
import { useRecordingStore } from '../stores/useRecordingStore';
import { audioCommands } from '../lib/tauri';

/**
 * 录音控制 Hook
 * 提供开始/停止录音的功能，并处理错误状态
 */
export function useRecording() {
  const { isRecording, setRecording, setError, clearError } =
    useRecordingStore();

  /**
   * 开始录音
   */
  const startRecording = useCallback(async () => {
    clearError();
    try {
      await audioCommands.startRecording();
      setRecording(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '开始录音失败';
      setError(errorMessage);
      console.error('Start recording error:', error);
    }
  }, [setRecording, setError, clearError]);

  /**
   * 停止录音
   */
  const stopRecording = useCallback(async () => {
    clearError();
    try {
      await audioCommands.stopRecording();
      setRecording(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '停止录音失败';
      setError(errorMessage);
      console.error('Stop recording error:', error);
    }
  }, [setRecording, setError, clearError]);

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
