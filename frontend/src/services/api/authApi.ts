/**
 * 认证相关API服务
 */

import { apiClient } from '../apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  organization_name: string;
  full_name?: string;
  verification_code: string;  // ✅ 新增：邮箱验证码
}

export interface User {
  id: string;
  email?: string;
  username: string;
  full_name?: string;
  role: string;
  org_id: string;
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;  // ✅ 租户激活状态
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  organization: Organization;
}

// 注册响应：可能需要激活（租户审核）
export interface RegisterResponse extends Partial<LoginResponse> {
  requires_activation?: boolean;
  message?: string;
  user?: User;
  organization?: Organization;
}

export const authApi = {
  /**
   * 发送邮箱验证码
   */
  async sendVerificationCode(email: string): Promise<{
    message: string;
    expires_in: number;
    can_resend_at: number;
  }> {
    return apiClient.post('/auth/send-verification-code', { email }, {
      skipAuth: true,
    });
  },

  /**
   * 用户登录
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', credentials, {
      skipAuth: true,
    });
  },

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/auth/register', data, {
      skipAuth: true,
    });
  },

  /**
   * 刷新token
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    return apiClient.post('/auth/refresh', { refresh_token: refreshToken }, {
      skipAuth: true,
    });
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  },

  /**
   * 验证token
   */
  async validateToken(): Promise<{ valid: boolean; user?: User }> {
    return apiClient.post('/auth/validate');
  },

  /**
   * 重新发送激活邮件
   */
  async resendActivation(email: string): Promise<{
    message: string;
    expires_in: number;
  }> {
    return apiClient.post('/auth/resend-activation', { email }, {
      skipAuth: true,
    });
  },

  /**
   * 激活账号（设置密码）
   */
  async activate(token: string, password: string): Promise<{
    message: string;
    email: string;
    can_login: boolean;
  }> {
    return apiClient.post('/auth/activate', { token, password }, {
      skipAuth: true,
    });
  },
};
