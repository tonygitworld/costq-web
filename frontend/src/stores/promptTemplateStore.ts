/**
 * Prompt Template Store
 *
 * 使用 Zustand 管理提示词模板状态
 */

import { create } from 'zustand';
import type {
  PromptTemplate,
  UserPromptTemplate,
  UserPromptTemplateCreate,
  UserPromptTemplateUpdate,
  SlashCommand
} from '../types/promptTemplate';
import * as api from '../services/promptTemplateApi';

import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/ErrorHandler';

interface PromptTemplateStore {
  // 状态
  systemTemplates: PromptTemplate[];
  userTemplates: UserPromptTemplate[];
  slashCommands: SlashCommand[];
  systemLoading: boolean;  // 系统模板加载状态
  userLoading: boolean;    // 用户模板加载状态
  error: string | null;

  // 系统模板操作
  loadSystemTemplates: (category?: string, cloudProvider?: string) => Promise<void>;

  // 用户模板操作
  loadUserTemplates: (onlyFavorites?: boolean) => Promise<void>;
  createTemplate: (data: UserPromptTemplateCreate) => Promise<UserPromptTemplate>;
  updateTemplate: (id: string, data: UserPromptTemplateUpdate) => Promise<UserPromptTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  // 斜杠命令操作
  loadSlashCommands: () => Promise<void>;

  // 执行模板
  executeTemplate: (id: string, variables?: Record<string, string | number | boolean>) => Promise<string>;

  // 重置错误
  clearError: () => void;
}

export const usePromptTemplateStore = create<PromptTemplateStore>((set, get) => ({
  systemTemplates: [],
  userTemplates: [],
  slashCommands: [],
  systemLoading: false,
  userLoading: false,
  error: null,

  // ========== 系统模板操作 ==========

  loadSystemTemplates: async (category?, cloudProvider?) => {
    // 防止重复加载
    if (get().systemLoading) return;

    set({ systemLoading: true, error: null });
    try {
      const templates = await api.getSystemTemplates({
        category,
        cloud_provider: cloudProvider
      }, {
        timeout: 15000,  // ✅ 15秒超时
        retry: 2,  // ✅ 重试2次
        retryDelay: 1000  // ✅ 1秒延迟
      });
      set({ systemTemplates: templates, systemLoading: false });
      logger.debug(`✅ 加载系统模板成功 - Count: ${templates.length}`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '加载系统模板失败');
      set({ error: errorMsg, systemLoading: false });
      logger.error('❌ 加载系统模板失败:', error);
    }
  },

  // ========== 用户模板操作 ==========

  loadUserTemplates: async (onlyFavorites = false) => {
    // 防止重复加载
    if (get().userLoading) return;

    set({ userLoading: true, error: null });
    try {
      const templates = await api.getUserTemplates(onlyFavorites, {
        timeout: 15000,  // ✅ 15秒超时
        retry: 2,  // ✅ 重试2次
        retryDelay: 1000  // ✅ 1秒延迟
      });
      set({ userTemplates: templates, userLoading: false });
      logger.debug(`✅ 加载用户模板成功 - Count: ${templates.length}`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '加载用户模板失败');
      set({ error: errorMsg, userLoading: false });
      logger.error('❌ 加载用户模板失败:', error);
    }
  },

  createTemplate: async (data) => {
    set({ userLoading: true, error: null });
    try {
      const newTemplate = await api.createUserTemplate(data);
      set(state => ({
        userTemplates: [...state.userTemplates, newTemplate],
        userLoading: false
      }));
      logger.debug(`✅ 创建模板成功 - ID: ${newTemplate.id}, Title: ${newTemplate.title}`);
      return newTemplate;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '创建模板失败');
      set({ error: errorMsg, userLoading: false });
      logger.error('❌ 创建模板失败:', error);
      throw error;
    }
  },

  updateTemplate: async (id, data) => {
    set({ userLoading: true, error: null });
    try {
      const updatedTemplate = await api.updateUserTemplate(id, data);
      set(state => ({
        userTemplates: state.userTemplates.map(t =>
          t.id === id ? updatedTemplate : t
        ),
        userLoading: false
      }));
      logger.debug(`✅ 更新模板成功 - ID: ${id}`);
      return updatedTemplate;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '更新模板失败');
      set({ error: errorMsg, userLoading: false });
      logger.error('❌ 更新模板失败:', error);
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    set({ userLoading: true, error: null });
    try {
      await api.deleteUserTemplate(id);
      set(state => ({
        userTemplates: state.userTemplates.filter(t => t.id !== id),
        userLoading: false
      }));
      logger.debug(`✅ 删除模板成功 - ID: ${id}`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '删除模板失败');
      set({ error: errorMsg, userLoading: false });
      logger.error('❌ 删除模板失败:', error);
      throw error;
    }
  },

  toggleFavorite: async (id) => {
    try {
      const result = await api.toggleFavorite(id);
      set(state => ({
        userTemplates: state.userTemplates.map(t =>
          t.id === id ? { ...t, is_favorite: result.is_favorite } : t
        )
      }));
      logger.debug(`✅ 切换收藏成功 - ID: ${id}, Favorite: ${result.is_favorite}`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '切换收藏失败');
      set({ error: errorMsg });
      logger.error('❌ 切换收藏失败:', error);
      throw error;
    }
  },

  // ========== 斜杠命令操作 ==========

  loadSlashCommands: async () => {
    try {
      const commands = await api.getSlashCommands();
      set({ slashCommands: commands });
      logger.debug(`✅ 加载斜杠命令成功 - Count: ${commands.length}`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '加载斜杠命令失败');
      set({ error: errorMsg });
      logger.error('❌ 加载斜杠命令失败:', error);
    }
  },

  // ========== 执行模板 ==========

  executeTemplate: async (id, variables = {}) => {
    try {
      const result = await api.executeTemplate(id, { variables });
      logger.debug(`✅ 执行模板成功 - ID: ${id}, UsageCount: ${result.usage_count}`);
      logger.debug(`   渲染后的 Prompt: ${result.rendered_prompt}`);

      // 更新使用计数（系统模板或用户模板）
      set(state => ({
        systemTemplates: state.systemTemplates.map(t =>
          t.id === id ? { ...t, usage_count: result.usage_count } : t
        ),
        userTemplates: state.userTemplates.map(t =>
          t.id === id ? { ...t, usage_count: result.usage_count } : t
        )
      }));

      return result.rendered_prompt;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, '执行模板失败');
      set({ error: errorMsg });
      logger.error('❌ 执行模板失败:', error);
      throw error;
    }
  },

  // ========== 辅助方法 ==========

  clearError: () => set({ error: null })
}));
