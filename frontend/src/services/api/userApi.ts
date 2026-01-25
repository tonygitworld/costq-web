/**
 * 用户管理API服务
 */

import { apiClient } from '../apiClient';
import type { User } from './authApi';

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
}

export interface UpdatePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserPermission {
  user_id: string;
  aws_account_ids: string[];
  gcp_account_ids: string[];
}

export const userApi = {
  /**
   * 获取所有用户
   */
  async getAll(): Promise<User[]> {
    return apiClient.get<User[]>('/users/');
  },

  /**
   * 获取单个用户
   */
  async getById(id: string): Promise<User> {
    return apiClient.get<User>(`/users/${id}`);
  },

  /**
   * 创建用户
   */
  async create(data: CreateUserRequest): Promise<User> {
    return apiClient.post<User>('/users/', data);
  },

  /**
   * 更新用户
   */
  async update(id: string, data: UpdateUserRequest): Promise<User> {
    return apiClient.put<User>(`/users/${id}`, data);
  },

  /**
   * 删除用户
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/users/${id}`);
  },

  /**
   * 修改密码
   */
  async changePassword(data: UpdatePasswordRequest): Promise<{ message: string }> {
    return apiClient.put('/profile/password', data);
  },

  /**
   * 获取用户权限
   */
  async getPermissions(userId: string): Promise<UserPermission> {
    return apiClient.get<UserPermission>(`/users/${userId}/permissions`);
  },

  /**
   * 更新用户权限
   */
  async updatePermissions(
    userId: string,
    data: { aws_account_ids: string[]; gcp_account_ids: string[] }
  ): Promise<{ message: string }> {
    return apiClient.put(`/users/${userId}/permissions`, data);
  },
};
