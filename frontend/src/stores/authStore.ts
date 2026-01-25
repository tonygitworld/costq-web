// Auth Store - 用户认证状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/api/authApi';
import { UnauthorizedError } from '../services/errors';
import { notifyAuthError, redirectToLogin } from '../utils/authNotifications';

// 超级管理员白名单（与后端保持一致）
const SUPER_ADMIN_EMAILS = ['liyuguang@marshotspot.com'];

interface User {
  id: string;
  org_id: string;
  username: string;  // 实际上是用户的 email
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

interface Organization {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;  // ✅ 租户激活状态
  created_at: string;
  updated_at: string;
}

interface AuthState {
  // 状态
  user: User | null;
  organization: Organization | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  refreshPromise: Promise<void> | null;  // ✅ 防止并发刷新
  refreshFailed: boolean;  // ✅ 标记刷新是否失败（Refresh Token 过期）

  // 操作方法
  register: (orgName: string, username: string, password: string, fullName?: string, verificationCode?: string) => Promise<{
    user: User;
    organization: Organization;
    access_token?: string;
    refresh_token?: string;
    requires_activation?: boolean;
    message?: string;
  }>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  getCurrentUser: () => Promise<void>;
  clearError: () => void;
  refreshAccessToken: () => Promise<void>;

  // 辅助方法
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  getAuthHeaders: () => { Authorization: string } | {};
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // ✅ 移除旧的事件监听器 - Token刷新现在由apiClient自动处理
      // ✅ 移除了 window.__AUTH_STORE__ 全局变量设置（apiClient 现在直接从 authStore 获取）

      return {
        // 初始状态
        user: null,
        organization: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        refreshPromise: null,  // ✅ 防止并发刷新
        refreshFailed: false,  // ✅ 标记刷新是否失败

      // 注册（创建组织）
      register: async (orgName: string, email: string, password: string, fullName?: string, verificationCode?: string) => {
        set({ loading: true, error: null });
        try {
          const data = await authApi.register({
            email,
            username: email, // 使用email作为username
            password,
            organization_name: orgName,
            full_name: fullName,
            verification_code: verificationCode || '', // ✅ 新增：邮箱验证码
          });

          console.log('🔍 Register response:', data);
          console.log('🔍 requires_activation:', data.requires_activation);
          console.log('🔍 Type check:', typeof data.requires_activation, data.requires_activation === true);

          // ✅ 检查是否需要激活（租户审核）
          // @ts-ignore - data 可能包含 requires_activation 字段
          if (data.requires_activation === true) {
            // 租户未激活：不设置 token 和认证状态
            set({
              loading: false,
              error: null,
            });
            return data;
          }

          // 租户已激活：设置 token 和认证状态
          set({
            user: data.user,
            organization: data.organization,
            token: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            loading: false,
            error: null,
            refreshFailed: false,  // ✅ 注册成功，清除刷新失败标记
          });

          // ✅ 返回数据供调用方使用
          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '注册失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 登录
      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const data = await authApi.login({ email, password });

          set({
            user: data.user,
            organization: data.organization,
            token: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            loading: false,
            error: null,
            refreshFailed: false,  // ✅ 登录成功，清除刷新失败标记
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '登录失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 登出
      logout: () => {
        // ✅ 登出时不清理 localStorage 中的聊天记录
        // 每个用户的聊天记录保留在 chat_data_${userId} 中，下次登录时自动加载
        set({
          user: null,
          organization: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          refreshPromise: null,  // ✅ 清除刷新 Promise
          refreshFailed: false,  // ✅ 清除刷新失败标记
        });
      },

      // 获取当前用户信息
      getCurrentUser: async () => {
        const { token } = get();
        if (!token) {
          throw new Error('未登录');
        }

        set({ loading: true, error: null });
        try {
          const user = await authApi.getCurrentUser();
          set({ user, loading: false });
        } catch (error) {
          // 如果是401错误，清理认证状态
          if (error instanceof UnauthorizedError) {
            get().logout();
          }
          const errorMessage = error instanceof Error ? error.message : '获取用户信息失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },

      // 刷新 Access Token（防止并发刷新）
      refreshAccessToken: async () => {
        const state = get();
        
        // ✅ 如果刷新已经失败（Refresh Token 过期），直接抛出错误，不再尝试刷新
        if (state.refreshFailed) {
          console.warn('⚠️ [AuthStore] Refresh Token 已过期，不再尝试刷新');
          throw new Error('Refresh Token 已过期，请重新登录');
        }
        
        // ✅ 如果已经有刷新在进行，等待它完成
        if (state.refreshPromise) {
          console.log('⏳ [AuthStore] 刷新已在进行中，等待完成...');
          return state.refreshPromise;
        }

        const { refreshToken } = state;
        if (!refreshToken) {
          throw new Error('没有刷新令牌');
        }

        // ✅ 创建刷新 Promise
        const refreshPromise = (async () => {
          try {
            console.log('🔄 [AuthStore] 开始刷新Token...');
            const data = await authApi.refreshToken(refreshToken);

            set({
              token: data.access_token,
              refreshToken: data.refresh_token,
              refreshFailed: false,  // ✅ 刷新成功，清除失败标记
            });

            console.log('✅ [AuthStore] Token刷新成功');
          } catch (error: any) {
            console.error('❌ [AuthStore] Token刷新失败:', error);
            console.error('❌ [AuthStore] 错误详情:', {
              name: error?.name,
              message: error?.message,
              status: error?.status,
              constructor: error?.constructor?.name,
            });

            // ✅ 检查是否是 Refresh Token 过期（401 错误）
            // 注意：UnauthorizedError 有 status 属性（值为 401），不是 response.status
            const { UnauthorizedError } = await import('../services/errors');
            const isRefreshTokenExpired = 
              error instanceof UnauthorizedError ||
              error?.status === 401 ||
              error?.response?.status === 401 ||
              error?.message?.includes('401') ||
              error?.message?.includes('Unauthorized') ||
              error?.message?.includes('过期') ||
              error?.message?.includes('expired');

            console.log('🔍 [AuthStore] 是否 Refresh Token 过期:', isRefreshTokenExpired);

            if (isRefreshTokenExpired) {
              // ✅ Refresh Token 已过期，标记为失败，阻止后续刷新尝试
              set({ refreshFailed: true });
              console.warn('⚠️ [AuthStore] Refresh Token 已过期，标记为失败状态');
            }

            // ✅ 刷新失败，清除认证状态并提示用户（无论什么原因都执行）
            console.log('🔄 [AuthStore] 执行 logout()...');
            get().logout();

            // ✅ 使用全局通知机制显示错误消息（只触发一次）
            console.log('📢 [AuthStore] 调用 notifyAuthError()...');
            notifyAuthError('登录已过期，请重新登录');

            // ✅ 跳转到登录页（只触发一次）
            // 使用 setTimeout 确保在下一个事件循环中执行，避免被其他逻辑覆盖
            console.log('🔀 [AuthStore] 调用 redirectToLogin()...');
            setTimeout(() => {
              redirectToLogin();
              // ✅ 兜底：如果 React Router 跳转失败，使用 window.location 强制跳转
              if (typeof window !== 'undefined') {
                setTimeout(() => {
                  if (window.location.pathname !== '/login') {
                    console.warn('⚠️ [AuthStore] React Router 跳转失败，使用 window.location 强制跳转');
                    window.location.href = '/login';
                  }
                }, 100);
              }
            }, 0);

            throw error;
          } finally {
            // ✅ 清除刷新 Promise，允许下次刷新（如果 refreshFailed 为 false）
            set({ refreshPromise: null });
          }
        })();

        // ✅ 设置刷新 Promise
        set({ refreshPromise });

        return refreshPromise;
      },

      // 是否是管理员
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'admin';
      },

      // 是否是超级管理员（运营后台权限）
      isSuperAdmin: () => {
        const { user } = get();
        if (!user?.username) return false;
        return SUPER_ADMIN_EMAILS.includes(user.username.toLowerCase().trim());
      },

      // 获取认证请求头
      getAuthHeaders: () => {
        const { token } = get();
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
        return {};
      },
      };
    },
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => () => {
        // ✅ 从 localStorage 恢复后，state 已自动恢复，无需额外操作
      },
    }
  )
);
