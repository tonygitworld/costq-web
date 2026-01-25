/**
 * Prompt Template API 客户端
 *
 * ✅ 已迁移到使用 apiClient，统一处理 Token 刷新和 401 错误
 */

import type {
  PromptTemplate,
  UserPromptTemplate,
  UserPromptTemplateCreate,
  UserPromptTemplateUpdate,
  SlashCommand,
  TemplateExecuteRequest,
  TemplateExecuteResponse
} from '../types/promptTemplate';
import { apiClient } from './apiClient';
import type { RequestConfig } from './apiClient';

// ========== 系统预设模板 ==========

/**
 * 获取系统预设模板列表
 * @param params 查询参数
 * @param config 请求配置（可选）
 */
export const getSystemTemplates = async (params?: {
  category?: string;
  cloud_provider?: string;
}, config?: RequestConfig): Promise<PromptTemplate[]> => {
  return apiClient.get<PromptTemplate[]>('/prompt-templates', {
    ...config,
    params: params ? {
      category: params.category,
      cloud_provider: params.cloud_provider
    } : undefined
  });
};

/**
 * 获取单个系统模板详情
 * @param id 模板 ID
 */
export const getSystemTemplate = async (id: string): Promise<PromptTemplate> => {
  return apiClient.get<PromptTemplate>(`/prompt-templates/${id}`);
};

// ========== 用户自定义模板 ==========

/**
 * 获取用户自定义模板列表
 * @param onlyFavorites 是否仅显示收藏
 * @param config 请求配置（可选）
 */
export const getUserTemplates = async (onlyFavorites = false, config?: RequestConfig): Promise<UserPromptTemplate[]> => {
  return apiClient.get<UserPromptTemplate[]>('/user-prompt-templates', {
    ...config,
    params: onlyFavorites ? { only_favorites: true } : undefined
  });
};

/**
 * 创建用户自定义模板
 * @param data 模板数据
 */
export const createUserTemplate = async (
  data: UserPromptTemplateCreate
): Promise<UserPromptTemplate> => {
  return apiClient.post<UserPromptTemplate>('/user-prompt-templates', data);
};

/**
 * 更新用户自定义模板
 * @param id 模板 ID
 * @param data 更新数据
 */
export const updateUserTemplate = async (
  id: string,
  data: UserPromptTemplateUpdate
): Promise<UserPromptTemplate> => {
  return apiClient.put<UserPromptTemplate>(`/user-prompt-templates/${id}`, data);
};

/**
 * 删除用户自定义模板
 * @param id 模板 ID
 */
export const deleteUserTemplate = async (id: string): Promise<void> => {
  await apiClient.delete(`/user-prompt-templates/${id}`);
};

/**
 * 切换模板收藏状态
 * @param id 模板 ID
 */
export const toggleFavorite = async (id: string): Promise<{ is_favorite: boolean }> => {
  return apiClient.post<{ is_favorite: boolean }>(`/user-prompt-templates/${id}/favorite`);
};

// ========== 执行模板 ==========

/**
 * 执行模板（渲染变量并返回完整 Prompt）
 * @param id 模板 ID
 * @param request 执行请求（包含变量值）
 */
export const executeTemplate = async (
  id: string,
  request: TemplateExecuteRequest
): Promise<TemplateExecuteResponse> => {
  return apiClient.post<TemplateExecuteResponse>(`/prompt-templates/${id}/execute`, request);
};

// ========== 斜杠命令 ==========

/**
 * 获取斜杠命令列表
 */
export const getSlashCommands = async (): Promise<SlashCommand[]> => {
  return apiClient.get<SlashCommand[]>('/slash-commands');
};
