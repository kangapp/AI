// API 配置状态管理
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ApiConfigStatus {
  has_api_key: boolean;
  key_preview: string;
}

interface ApiConfigState {
  // 状态
  configStatus: ApiConfigStatus | null;
  isValidating: boolean;
  isSaving: boolean;
  validationError: string | null;
  saveError: string | null;

  // 操作
  loadConfigStatus: () => Promise<void>;
  saveApiKey: (apiKey: string) => Promise<void>;
  validateApiKey: (apiKey: string) => Promise<boolean>;
  clearErrors: () => void;
}

export const useApiConfigStore = create<ApiConfigState>((set) => ({
  // 初始状态
  configStatus: null,
  isValidating: false,
  isSaving: false,
  validationError: null,
  saveError: null,

  // 加载配置状态
  loadConfigStatus: async () => {
    try {
      const status = await invoke<ApiConfigStatus>('get_api_config_status');
      set({ configStatus: status });
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  },

  // 保存 API 密钥
  saveApiKey: async (apiKey: string) => {
    set({ isSaving: true, saveError: null });

    try {
      const status = await invoke<ApiConfigStatus>('save_api_key', { apiKey });
      set({ configStatus: status, isSaving: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ saveError: errorMessage, isSaving: false });
      throw error;
    }
  },

  // 验证 API 密钥
  validateApiKey: async (apiKey: string) => {
    set({ isValidating: true, validationError: null });

    try {
      const isValid = await invoke<boolean>('validate_api_key', { apiKey });
      set({ isValidating: false });

      if (!isValid) {
        set({ validationError: 'API 密钥格式无效' });
      }

      return isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ validationError: errorMessage, isValidating: false });
      return false;
    }
  },

  // 清除错误
  clearErrors: () => {
    set({ validationError: null, saveError: null });
  },
}));
