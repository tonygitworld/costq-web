// GCP Account Store - GCP 账号管理状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GCPAccount, GCPAccountFormData, GCPAccountUpdateData } from '../types/gcpAccount';
import { gcpAccountApi } from '../services/api/gcpAccountApi';

interface GCPAccountState {
  // 状态
  accounts: GCPAccount[];
  selectedAccountIds: string[];
  loading: boolean;
  error: string | null;

  // 操作方法
  fetchAccounts: () => Promise<void>;
  addAccount: (account: GCPAccountFormData) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, updates: GCPAccountUpdateData) => Promise<void>;
  validateAccount: (id: string) => Promise<boolean>;

  // 选择相关
  setSelectedAccounts: (ids: string[]) => void;
  toggleAccountSelection: (id: string) => void;
  selectAllAccounts: () => void;
  clearAccountSelection: () => void;

  // 辅助方法
  getAccountById: (id: string) => GCPAccount | undefined;
  clearError: () => void;
}

export const useGCPAccountStore = create<GCPAccountState>()(
  persist(
    (set, get) => ({
      // 初始状态
      accounts: [],
      selectedAccountIds: [],
      loading: false,
      error: null,

      // 获取账号列表
      fetchAccounts: async () => {
        // ✅ 去重：如果正在加载，直接返回
        const state = get();
        if (state.loading) {
          console.log('⏳ GCP 账号正在加载中，跳过重复调用');
          return;
        }

        set({ loading: true, error: null });
        try {
          const accounts = await gcpAccountApi.getAll({
            timeout: 15000,  // ✅ 15秒超时
            retry: 2,  // ✅ 重试2次
            retryDelay: 1000  // ✅ 1秒延迟
          });
          set({ accounts, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '获取 GCP 账号列表失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 添加账号
      addAccount: async (accountData: GCPAccountFormData) => {
        set({ loading: true, error: null });
        try {
          // 获取认证头
          const authHeaders = useAuthStore.getState().getAuthHeaders();

          const response = await fetch('/api/gcp-accounts/', {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(accountData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '添加 GCP 账号失败');
          }

          // 添加成功后重新获取列表
          await get().fetchAccounts();
          set({ loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '添加 GCP 账号失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 删除账号
      deleteAccount: async (id: string) => {
        set({ loading: true, error: null });
        try {
          // 获取认证头
          const authHeaders = useAuthStore.getState().getAuthHeaders();

          const response = await fetch(`/api/gcp-accounts/${id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '删除 GCP 账号失败');
          }

          // 删除成功后重新获取列表
          await get().fetchAccounts();

          // 如果删除的账号在选中列表中，移除它
          const { selectedAccountIds } = get();
          if (selectedAccountIds.includes(id)) {
            set({ selectedAccountIds: selectedAccountIds.filter(aid => aid !== id) });
          }

          set({ loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '删除 GCP 账号失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 更新账号
      updateAccount: async (id: string, updates: GCPAccountUpdateData) => {
        set({ loading: true, error: null });
        try {
          // 获取认证头
          const authHeaders = useAuthStore.getState().getAuthHeaders();

          const response = await fetch(`/api/gcp-accounts/${id}`, {
            method: 'PUT',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '更新 GCP 账号失败');
          }

          // 更新成功后重新获取列表
          await get().fetchAccounts();
          set({ loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '更新 GCP 账号失败';
          set({ error: errorMessage, loading: false });
          throw error;
        }
      },

      // 验证账号凭证
      validateAccount: async (id: string): Promise<boolean> => {
        set({ loading: true, error: null });
        try {
          // 获取认证头
          const authHeaders = useAuthStore.getState().getAuthHeaders();

          const response = await fetch(`/api/gcp-accounts/${id}/validate`, {
            method: 'POST',
            headers: authHeaders,
          });

          if (!response.ok) {
            throw new Error('验证 GCP 凭证失败');
          }

          const result = await response.json();
          set({ loading: false });
          return result.valid;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '验证 GCP 凭证失败';
          set({ error: errorMessage, loading: false });
          return false;
        }
      },

      // 设置选中的账号
      setSelectedAccounts: (ids: string[]) => {
        set({ selectedAccountIds: ids });
      },

      // 切换账号选中状态
      toggleAccountSelection: (id: string) => {
        const { selectedAccountIds } = get();
        if (selectedAccountIds.includes(id)) {
          set({ selectedAccountIds: selectedAccountIds.filter(aid => aid !== id) });
        } else {
          set({ selectedAccountIds: [...selectedAccountIds, id] });
        }
      },

      // 全选账号
      selectAllAccounts: () => {
        const { accounts } = get();
        set({ selectedAccountIds: accounts.map(acc => acc.id) });
      },

      // 清空选择
      clearAccountSelection: () => {
        set({ selectedAccountIds: [] });
      },

      // 根据 ID 获取账号
      getAccountById: (id: string) => {
        const { accounts } = get();
        return accounts.find(acc => acc.id === id);
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'gcp-account-storage', // localStorage 中的 key
      partialize: (state) => ({
        selectedAccountIds: state.selectedAccountIds, // 只持久化选中的账号 ID
      }),
    }
  )
);
