// 应用状态管理 - Zustand Store
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, PermissionStatus } from '../types';

interface AppActions {
  setPermissionGuideOpen: (isOpen: boolean) => void;
  setApiKey: (apiKey: string | null) => void;
  setLanguage: (language: string) => void;
  setPermissionStatus: (permissions: Partial<PermissionStatus>) => void;
  reset: () => void;
}

type AppStore = AppState &
  AppActions & {
    permissionStatus: PermissionStatus;
  };

const initialPermissionStatus: PermissionStatus = {
  microphone: 'not-determined',
  accessibility: 'not-determined',
};

const initialState: AppState = {
  isPermissionGuideOpen: false,
  apiKey: null,
  language: 'zh-CN', // 默认中文
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...initialState,
      permissionStatus: initialPermissionStatus,

      setPermissionGuideOpen: (isPermissionGuideOpen) =>
        set({ isPermissionGuideOpen }),

      setApiKey: (apiKey) => set({ apiKey }),

      setLanguage: (language) => set({ language }),

      setPermissionStatus: (permissions) =>
        set((state) => ({
          permissionStatus: { ...state.permissionStatus, ...permissions },
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'raflow-app-storage',
      // 只持久化这些字段
      partialize: (state) => ({
        apiKey: state.apiKey,
        language: state.language,
      }),
    }
  )
);
