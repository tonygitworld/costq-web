/**
 * AWS账号管理API服务
 */

import { apiClient } from '../apiClient';
import type { RequestConfig } from '../apiClient';
import type { AuthType } from '../../types/awsAccount';

export interface AWSAccount {
  id: string;
  alias: string;
  auth_type: AuthType;

  // AKSK fields
  account_id?: string;
  account_name?: string;
  access_key_id?: string;
  access_key_id_masked?: string;
  secret_access_key_masked?: string;

  // IAM Role fields
  role_arn?: string;
  session_duration?: number;

  // Common fields
  region: string;
  description?: string;
  arn?: string;
  is_verified: boolean;
  is_active?: boolean;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAWSAccountRequest {
  alias: string;
  access_key_id: string;
  secret_access_key: string;
  region?: string;
  description?: string;
}

export interface UpdateAWSAccountRequest {
  account_name?: string;
  access_key_id?: string;
  secret_access_key?: string;
  region?: string;
  is_active?: boolean;
}

export interface CreateIAMRoleAccountRequest {
  alias: string;
  role_arn: string;
  region?: string;
  description?: string;
  session_duration?: number;
}

export interface ExternalIdInfo {
  org_id: string;
  external_id: string;
  cloudformation_template_url: string;
  platform_account_id: string;
  quick_create_url: string;
}

export const accountApi = {
  /**
   * 获取所有AWS账号
   */
  async getAll(config?: RequestConfig): Promise<AWSAccount[]> {
    return apiClient.get<AWSAccount[]>('/accounts/', config);
  },

  /**
   * 获取单个AWS账号
   */
  async getById(id: string): Promise<AWSAccount> {
    return apiClient.get<AWSAccount>(`/accounts/${id}`);
  },

  /**
   * 创建AWS账号
   */
  async create(data: CreateAWSAccountRequest): Promise<AWSAccount> {
    return apiClient.post<AWSAccount>('/accounts/', data);
  },

  /**
   * 更新AWS账号
   */
  async update(id: string, data: UpdateAWSAccountRequest): Promise<AWSAccount> {
    return apiClient.put<AWSAccount>(`/accounts/${id}`, data);
  },

  /**
   * 删除AWS账号
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/accounts/${id}`);
  },

  /**
   * 验证AWS凭证
   */
  async validateCredentials(data: {
    access_key_id: string;
    secret_access_key: string;
    region?: string;
  }): Promise<{ valid: boolean; message: string }> {
    return apiClient.post('/accounts/validate-credentials', data);
  },

  /**
   * 获取组织的 External ID（用于 IAM Role 集成）
   */
  async getExternalId(): Promise<ExternalIdInfo> {
    return apiClient.get<ExternalIdInfo>('/accounts/organizations/external-id');
  },

  /**
   * 创建 IAM Role 类型的 AWS 账号
   */
  async createIAMRoleAccount(data: CreateIAMRoleAccountRequest): Promise<AWSAccount> {
    return apiClient.post<AWSAccount>('/accounts/iam-role', data);
  },
};
