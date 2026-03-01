import { create } from 'zustand';
import type { AppStatus } from '../types';

interface AppState {
  /** Current application status */
  status: AppStatus;
  /** Partial (tentative) transcription text - shown in gray */
  partialText: string;
  /** Committed (final) transcription text - shown in black */
  committedText: string;
  /** Error message if any */
  error: string | null;
  /** Current audio level for waveform visualization (0-1) */
  audioLevel: number;

  // Actions
  /** Set the current status */
  setStatus: (status: AppStatus) => void;
  /** Update partial text */
  setPartialText: (text: string) => void;
  /** Update committed text */
  setCommittedText: (text: string) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Set audio level */
  setAudioLevel: (level: number) => void;
  /** Reset all text */
  resetText: () => void;
  /** Reset entire state */
  reset: () => void;
}

const initialState = {
  status: 'idle' as AppStatus,
  partialText: '',
  committedText: '',
  error: null,
  audioLevel: 0,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setPartialText: (text) => set({ partialText: text }),
  setCommittedText: (text) => set({ committedText: text }),
  setError: (error) => set({ error }),
  setAudioLevel: (level) => set({ audioLevel: Math.max(0, Math.min(1, level)) }),
  resetText: () => set({ partialText: '', committedText: '' }),
  reset: () => set(initialState),
}));
