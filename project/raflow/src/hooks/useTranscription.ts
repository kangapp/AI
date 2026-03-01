import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * 录音状态枚举
 * - idle: 空闲状态
 * - recording: 录音中
 * - processing: 处理中
 */
export type RecordingStatus = "idle" | "recording" | "processing";

/**
 * 转录状态接口
 */
export interface TranscriptionState {
  /** 当前录音状态 */
  status: RecordingStatus;
  /** 部分转录文本 (实时更新) */
  partialText: string;
  /** 已确认的转录文本 */
  committedText: string;
  /** 音频电平 (0-1) */
  audioLevel: number;
}

/**
 * 转录状态管理 Hook
 *
 * 监听后端发送的转录事件，提供统一的转录状态管理
 *
 * @returns {TranscriptionState} 当前转录状态
 *
 * @example
 * ```tsx
 * function TranscriptionDisplay() {
 *   const { status, partialText, committedText, audioLevel } = useTranscription();
 *
 *   return (
 *     <div>
 *       <p>Status: {status}</p>
 *       <p>Partial: {partialText}</p>
 *       <p>Committed: {committedText}</p>
 *       <p>Audio Level: {audioLevel}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranscription(): TranscriptionState {
  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    partialText: "",
    committedText: "",
    audioLevel: 0,
  });

  useEffect(() => {
    // 监听录音状态变化事件
    const unlistenRecordingState = listen<boolean>(
      "recording-state-changed",
      (event) => {
        setState((prev) => ({
          ...prev,
          status: event.payload ? "recording" : "idle",
        }));
      }
    );

    // 监听部分转录事件
    const unlistenPartialTranscript = listen<string>(
      "partial-transcript",
      (event) => {
        setState((prev) => ({
          ...prev,
          partialText: event.payload,
        }));
      }
    );

    // 监听已确认转录事件
    const unlistenCommittedTranscript = listen<string>(
      "committed-transcript",
      (event) => {
        setState((prev) => ({
          ...prev,
          committedText: event.payload,
          partialText: "",
        }));
      }
    );

    // 监听音频电平事件
    const unlistenAudioLevel = listen<number>("audio-level", (event) => {
      setState((prev) => ({
        ...prev,
        audioLevel: event.payload,
      }));
    });

    // 清理函数：取消所有事件监听
    return () => {
      unlistenRecordingState.then((f) => f());
      unlistenPartialTranscript.then((f) => f());
      unlistenCommittedTranscript.then((f) => f());
      unlistenAudioLevel.then((f) => f());
    };
  }, []);

  return state;
}
