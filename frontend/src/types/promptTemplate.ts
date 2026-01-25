/**
 * Prompt Templates 类型定义
 *
 * 提示词模板功能的 TypeScript 类型
 */

export type VariableType = 'text' | 'number' | 'select' | 'date';

export interface PromptTemplateVariable {
  name: string;
  label: string;
  type: VariableType;
  options?: string[];
  default?: string | number;
  required?: boolean;
  placeholder?: string;
}

export type TemplateCategory = 'cost' | 'security' | 'inventory' | 'onboarding' | 'custom';

export type CloudProvider = 'aws' | 'gcp' | 'both' | null;

/**
 * 系统预设模板
 */
export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  prompt_text: string;
  category: TemplateCategory;
  icon?: string;
  cloud_provider?: CloudProvider;
  variables?: PromptTemplateVariable[];
  usage_count: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * 用户自定义模板
 */
export interface UserPromptTemplate {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  prompt_text: string;
  category: string;
  variables?: PromptTemplateVariable[];
  is_favorite: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 斜杠命令
 */
export interface SlashCommand {
  command: string;
  template_id: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

/**
 * 执行模板请求
 */
export interface TemplateExecuteRequest {
  variables?: Record<string, string | number | boolean>;
}

/**
 * 执行模板响应
 */
export interface TemplateExecuteResponse {
  template_id: string;
  rendered_prompt: string;
  usage_count: number;
}

/**
 * 创建用户模板请求
 */
export interface UserPromptTemplateCreate {
  title: string;
  description?: string;
  prompt_text: string;
  category?: string;
  variables?: PromptTemplateVariable[];
}

/**
 * 更新用户模板请求
 */
export interface UserPromptTemplateUpdate {
  title?: string;
  description?: string;
  prompt_text?: string;
  category?: string;
  variables?: PromptTemplateVariable[];
}
