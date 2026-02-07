// 录音状态管理 - Zustand Store
import { create } from 'zustand';
import type { RecordingState } from '../types';

interface RecordingActions {
  setRecording: (isRecording: boolean) => void;
  setAudioLevel: (level: number) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

type RecordingStore = RecordingState & RecordingActions;

const initialState: RecordingState = {
  isRecording: false,
  audioLevel: 0,
  error: null,
};

export const useRecordingStore = create<RecordingStore>((set) => ({
  ...initialState,

  setRecording: (isRecording) => set({ isRecording }),

  setAudioLevel: (audioLevel) => {
    // 限制范围在 0-1
    const clampedLevel = Math.max(0, Math.min(1, audioLevel));
    set({ audioLevel: clampedLevel });
  },

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
