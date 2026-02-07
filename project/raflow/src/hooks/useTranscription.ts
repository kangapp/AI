// 转录控制 Hook - 封装转录逻辑
import { useCallback, useEffect, useRef } from 'react';
import { useTranscriptionStore } from '../stores/useTranscriptionStore';
import { useAppStore } from '../stores/useAppStore';
import { transcriptionCommands } from '../lib/tauri';
import { listen } from '@tauri-apps/api/event';
import type { PartialTranscript, CommittedTranscript } from '../types';

/**
 * 转录控制 Hook
 * 提供连接/断开转录服务的功能，并监听实时转录结果
 */
export function useTranscription() {
  const { isConnected, setConnected, setPartialTranscript, appendCommittedTranscript, setError, clearError } =
    useTranscriptionStore();
  const { apiKey } = useAppStore();
  const unlistenRefRef = useRef<(() => void) | null>(null);

  /**
   * 开始转录
   */
  const startTranscription = useCallback(async () => {
    if (!apiKey) {
      setError('请先设置 ElevenLabs API 密钥');
      return;
    }

    clearError();
    try {
      await transcriptionCommands.startTranscription(apiKey);
      setConnected(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '开始转录失败';
      setError(errorMessage);
      console.error('Start transcription error:', error);
    }
  }, [apiKey, setConnected, setError, clearError]);

  /**
   * 停止转录
   */
  const stopTranscription = useCallback(async () => {
    clearError();
    try {
      await transcriptionCommands.stopTranscription();
      setConnected(false);

      // 清理事件监听器
      if (unlistenRefRef.current) {
        unlistenRefRef.current();
        unlistenRefRef.current = null;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '停止转录失败';
      setError(errorMessage);
      console.error('Stop transcription error:', error);
    }
  }, [setConnected, setError, clearError]);

  /**
   * 监听转录事件
   */
  useEffect(() => {
    let unlistenPartial: (() => void) | null = null;
    let unlistenCommitted: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        // 监听实时转录事件
        unlistenPartial = await listen<PartialTranscript>(
          'partial_transcript',
          (event) => {
            setPartialTranscript(event.payload.text);
          }
        );

        // 监听确认转录事件
        unlistenCommitted = await listen<CommittedTranscript>(
          'committed_transcript',
          (event) => {
            appendCommittedTranscript(event.payload.text);
            setPartialTranscript(''); // 清空实时转录
          }
        );

        unlistenRefRef.current = () => {
          unlistenPartial?.();
          unlistenCommitted?.();
        };
      } catch (error) {
        console.error('Error setting up transcription listeners:', error);
      }
    };

    if (isConnected) {
      setupListeners();
    }

    return () => {
      unlistenPartial?.();
      unlistenCommitted?.();
    };
  }, [isConnected, setPartialTranscript, appendCommittedTranscript]);

  return {
    isConnected,
    startTranscription,
    stopTranscription,
  };
}
