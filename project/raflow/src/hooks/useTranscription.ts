import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * 录音状态枚举
 * - idle: 空闲状态
 * - connecting: 连接中 (WebSocket 建立连接)
 * - recording: 录音中 (已连接，正在转录)
 * - processing: 处理中
 * - error: 错误状态
 */
export type RecordingStatus = "idle" | "connecting" | "recording" | "processing" | "error";

/**
 * 错误类型
 */
export type TranscriptionErrorType = "auth" | "network" | "server";

/**
 * 错误信息接口
 */
export interface TranscriptionError {
  type: TranscriptionErrorType;
  message: string;
}

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
  /** 错误信息 (仅当 status 为 error 时) */
  error: TranscriptionError | null;
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
 *   const { status, partialText, committedText, audioLevel, error } = useTranscription();
 *
 *   return (
 *     <div>
 *       <p>Status: {status}</p>
 *       <p>Partial: {partialText}</p>
 *       <p>Committed: {committedText}</p>
 *       <p>Audio Level: {audioLevel}</p>
 *       {error && <p>Error: {error.message}</p>}
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
    error: null,
  });

  useEffect(() => {
    console.log("[useTranscription] Setting up event listeners...");

    // 监听录音状态变化事件 (connecting 状态)
    const unlistenRecordingState = listen<boolean>(
      "recording-state-changed",
      (event) => {
        console.log("[useTranscription] recording-state-changed:", event.payload);
        const isRecording = event.payload;
        setState((prev) => ({
          ...prev,
          // 开始时显示 connecting，停止时显示 idle
          status: isRecording ? "connecting" : "idle",
          // 新录音开始时清空所有文字和错误
          committedText: isRecording ? "" : prev.committedText,
          partialText: isRecording ? "" : prev.partialText,
          error: isRecording ? null : prev.error,
        }));
      }
    );

    // 监听连接成功事件 (connecting -> recording)
    const unlistenConnected = listen<void>("transcription-connected", () => {
      console.log("[useTranscription] transcription-connected");
      setState((prev) => ({
        ...prev,
        status: "recording",
      }));
    });

    // 监听部分转录事件
    const unlistenPartialTranscript = listen<string>(
      "partial-transcript",
      (event) => {
        setState((prev) => {
          // 只有在 recording 或 connecting 状态时才接收转录文本
          if (prev.status !== "recording" && prev.status !== "connecting") {
            console.log("[useTranscription] Ignoring partial-transcript, status:", prev.status);
            return prev;
          }
          return {
            ...prev,
            partialText: event.payload,
          };
        });
      }
    );

    // 监听已确认转录事件
    const unlistenCommittedTranscript = listen<string>(
      "committed-transcript",
      (event) => {
        setState((prev) => {
          // 只有在 recording 或 connecting 状态时才接收转录文本
          if (prev.status !== "recording" && prev.status !== "connecting") {
            console.log("[useTranscription] Ignoring committed-transcript, status:", prev.status);
            return prev;
          }
          return {
            ...prev,
            committedText: event.payload,
            partialText: "",
          };
        });
      }
    );

    // 监听音频电平事件
    const unlistenAudioLevel = listen<number>("audio-level", (event) => {
      setState((prev) => {
        // 只有在 recording 或 connecting 状态时才接收音频电平
        if (prev.status !== "recording" && prev.status !== "connecting") {
          return prev;
        }
        return {
          ...prev,
          audioLevel: event.payload,
        };
      });
    });

    // 监听错误事件
    const unlistenError = listen<TranscriptionError>("transcription-error", (event) => {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: event.payload,
      }));
    });

    // 清理函数：取消所有事件监听
    return () => {
      unlistenRecordingState.then((f) => f());
      unlistenConnected.then((f) => f());
      unlistenPartialTranscript.then((f) => f());
      unlistenCommittedTranscript.then((f) => f());
      unlistenAudioLevel.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  return state;
}
