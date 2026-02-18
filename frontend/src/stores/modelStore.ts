// Model Store - AI 模型选择状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/apiClient';
import { logger } from '../utils/logger';

export interface ModelConfig {
  model_id: string;
  name: string;        // i18n key
  description: string; // i18n key
  is_default: boolean;
}

interface ModelState {
  // 状态
  models: ModelConfig[];
  selectedModelId: string | null;
  loading: boolean;
  error: string | null;

  // 操作方法
  fetchModels: () => Promise<void>;
  setSelectedModelId: (id: string) => void;
  
  // 辅助方法
  getSelectedModel: () => ModelConfig | undefined;
  getDefaultModel: () => ModelConfig | undefined;
  clearError: () => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      // 初始状态
      models: [],
      selectedModelId: null,
      loading: false,
      error: null,

      // 获取模型列表
      fetchModels: async () => {
        // 去重：如果正在加载，直接返回
        const state = get();
        if (state.loading) {
          logger.debug('⏳ 模型列表正在加载中，跳过重复调用');
          return;
        }

        set({ loading: true, error: null });
        try {
          const models = await apiClient.get<ModelConfig[]>('/models');
          
          set({ models, loading: false });

          // 如果没有选中的模型，或选中的模型不在列表中，选择默认模型
          const { selectedModelId } = get();
          const selectedExists = models.some(m => m.model_id === selectedModelId);
          
          if (!selectedModelId || !selectedExists) {
            const defaultModel = models.find(m => m.is_default);
            if (defaultModel) {
              set({ selectedModelId: defaultModel.model_id });
              logger.info('自动选择默认模型', { model_id: defaultModel.model_id });
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '获取模型列表失败';
          logger.error('获取模型列表失败', { error: errorMessage });
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 设置选中的模型
      setSelectedModelId: (id: string) => {
        const { models } = get();
        const model = models.find(m => m.model_id === id);
        
        if (!model) {
          logger.warn('尝试选择不存在的模型', { model_id: id });
          return;
        }
        
        set({ selectedModelId: id });
        logger.info('模型已切换', { model_id: id });
      },

      // 获取当前选中的模型
      getSelectedModel: () => {
        const { models, selectedModelId } = get();
        return models.find(m => m.model_id === selectedModelId);
      },

      // 获取默认模型
      getDefaultModel: () => {
        const { models } = get();
        return models.find(m => m.is_default);
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'model-storage', // localStorage 中的 key
      partialize: (state) => ({
        selectedModelId: state.selectedModelId, // 只持久化选中的模型 ID
      }),
    }
  )
);
