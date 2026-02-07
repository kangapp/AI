// 转录状态管理 - Zustand Store
import { create } from 'zustand';
import type { TranscriptionState } from '../types';

interface TranscriptionActions {
  setConnected: (isConnected: boolean) => void;
  setPartialTranscript: (text: string) => void;
  setCommittedTranscript: (text: string) => void;
  appendCommittedTranscript: (text: string) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

type TranscriptionStore = TranscriptionState & TranscriptionActions;

const initialState: TranscriptionState = {
  isConnected: false,
  partialTranscript: '',
  committedTranscript: '',
  error: null,
};

export const useTranscriptionStore = create<TranscriptionStore>((set) => ({
  ...initialState,

  setConnected: (isConnected) => set({ isConnected }),

  setPartialTranscript: (partialTranscript) => set({ partialTranscript }),

  setCommittedTranscript: (committedTranscript) => set({ committedTranscript }),

  appendCommittedTranscript: (text) =>
    set((state) => ({
      committedTranscript: state.committedTranscript + text,
    })),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
