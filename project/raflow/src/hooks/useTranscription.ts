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
  /** 调试: audio-level 事件接收计数 */
  debugEventCount: number;
  /** 调试: 心跳计数 */
  heartbeatCount: number;
  /** 调试: 热键触发计数 */
  hotkeyCount: number;
  /** 调试: 会话启动 */
  sessionStarting: boolean;
  /** 调试: 音频线程启动 */
  audioThreadStarted: boolean;
  /** 调试: 音频 pipeline 创建 */
  audioPipelineCreated: boolean;
  /** 调试: 音频 timer 启动 */
  audioTimerStarted: boolean;
}

/**
 * 转录状态管理 Hook
 *
 * 监听后端发送的转录事件，提供统一的转录状态管理
 *
 * @returns {TranscriptionState} 当前转录状态
 */
export function useTranscription(): TranscriptionState {
  const [state, setState] = useState<TranscriptionState>({
    status: "idle",
    partialText: "",
    committedText: "",
    audioLevel: 0,
    error: null,
    debugEventCount: 0,
    heartbeatCount: 0,
    hotkeyCount: 0,
    sessionStarting: false,
    audioThreadStarted: false,
    audioPipelineCreated: false,
    audioTimerStarted: false,
  });

  useEffect(() => {
    // 使用全局 listen 监听所有事件
    const unlistenPromises = [
      // 监听心跳事件 (测试事件系统)
      listen<number>("heartbeat", (event) => {
        console.log("[FRONTEND] Heartbeat received:", event.payload);
        setState((prev) => ({
          ...prev,
          heartbeatCount: event.payload,
        }));
      }),

      // 监听热键触发事件
      listen<number>("hotkey-triggered", (event) => {
        console.log("[FRONTEND] Hotkey triggered:", event.payload);
        setState((prev) => ({
          ...prev,
          hotkeyCount: prev.hotkeyCount + 1,
        }));
      }),

      // 监听会话启动事件
      listen<number>("session-starting", () => {
        console.log("[FRONTEND] Session starting");
        setState((prev) => ({
          ...prev,
          sessionStarting: true,
        }));
      }),

      // 监听音频线程启动事件
      listen<number>("audio-thread-started", () => {
        console.log("[FRONTEND] Audio thread started");
        setState((prev) => ({
          ...prev,
          audioThreadStarted: true,
        }));
      }),

      // 监听音频 pipeline 创建事件
      listen<number>("audio-pipeline-created", () => {
        console.log("[FRONTEND] Audio pipeline created");
        setState((prev) => ({
          ...prev,
          audioPipelineCreated: true,
        }));
      }),

      // 监听音频 timer 启动事件
      listen<number>("audio-timer-started", () => {
        console.log("[FRONTEND] Audio timer started");
        setState((prev) => ({
          ...prev,
          audioTimerStarted: true,
        }));
      }),

      // 监听录音状态变化事件
      listen<boolean>("recording-state-changed", (event) => {
        const isRecording = event.payload;
        setState((prev) => ({
          ...prev,
          status: isRecording ? "connecting" : "idle",
          committedText: isRecording ? "" : prev.committedText,
          partialText: isRecording ? "" : prev.partialText,
          error: isRecording ? null : prev.error,
        }));
      }),

      // 监听连接成功事件
      listen<void>("transcription-connected", () => {
        setState((prev) => ({
          ...prev,
          status: "recording",
        }));
      }),

      // 监听部分转录事件
      listen<string>("partial-transcript", (event) => {
        setState((prev) => ({
          ...prev,
          partialText: event.payload,
        }));
      }),

      // 监听已确认转录事件
      listen<string>("committed-transcript", (event) => {
        setState((prev) => ({
          ...prev,
          committedText: event.payload,
          partialText: "",
        }));
      }),

      // 监听音频电平事件
      listen<number>("audio-level", (event) => {
        console.log("[audio-level] received:", event.payload);
        setState((prev) => ({
          ...prev,
          audioLevel: event.payload,
          debugEventCount: prev.debugEventCount + 1,
        }));
      }),

      // 监听错误事件
      listen<TranscriptionError>("transcription-error", (event) => {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: event.payload,
        }));
      }),
    ];

    // 清理函数：取消所有事件监听
    return () => {
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten());
      });
    };
  }, []);

  return state;
}
