/**
 * GCP账号管理API服务
 */

import { apiClient } from '../apiClient';
import type { RequestConfig } from '../apiClient';

export interface GCPAccount {
  id: string;
  org_id: string;
  account_name: string;
  description?: string;
  project_id: string;
  service_account_email: string;
  service_account_email_masked: string;
  is_verified: boolean;
  organization_id?: string;
  billing_account_id?: string;
  billing_export_project_id?: string;
  billing_export_dataset?: string;
  billing_export_table?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGCPAccountRequest {
  account_name: string;
  description?: string;
  project_id: string;
  service_account_email: string;
  service_account_json: any; // Service Account JSON object
  organization_id?: string;
  billing_account_id?: string;
  billing_export_project_id?: string;
  billing_export_dataset?: string;
  billing_export_table?: string;
}

export interface UpdateGCPAccountRequest {
  project_name?: string;
  credentials?: string;
  is_active?: boolean;
  billing_export_dataset?: string;
  billing_export_table?: string;
}

export const gcpAccountApi = {
  /**
   * 获取所有GCP账号
   */
  async getAll(config?: RequestConfig): Promise<GCPAccount[]> {
    return apiClient.get<GCPAccount[]>('/gcp-accounts/', config);
  },

  /**
   * 获取单个GCP账号
   */
  async getById(id: string): Promise<GCPAccount> {
    return apiClient.get<GCPAccount>(`/gcp-accounts/${id}`);
  },

  /**
   * 创建GCP账号
   */
  async create(data: CreateGCPAccountRequest): Promise<GCPAccount> {
    return apiClient.post<GCPAccount>('/gcp-accounts/', data);
  },

  /**
   * 更新GCP账号
   */
  async update(id: string, data: UpdateGCPAccountRequest): Promise<GCPAccount> {
    return apiClient.put<GCPAccount>(`/gcp-accounts/${id}`, data);
  },

  /**
   * 删除GCP账号
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/gcp-accounts/${id}`);
  },

  /**
   * 验证GCP凭证
   */
  async validateCredentials(data: {
    credentials: string;
  }): Promise<{ valid: boolean; message: string; project_id?: string }> {
    return apiClient.post('/gcp-accounts/validate-credentials', data);
  },
};
