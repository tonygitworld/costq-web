// AWS Account Store - 账号管理状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountApi } from '../services/api/accountApi';
import type { AuthType } from '../types/awsAccount';
import { AuthType as AuthTypeEnum } from '../types/awsAccount';

export type { AuthType };
export { AuthTypeEnum as AuthTypeValues };

export interface AWSAccount {
  id: string;
  alias: string;
  auth_type: AuthType;  // 认证类型

  // AKSK fields (auth_type = 'aksk')
  access_key_id_masked?: string;  // 脱敏的 Access Key

  // IAM Role fields (auth_type = 'iam_role')
  role_arn?: string;
  session_duration?: number;

  // Common fields
  region: string;
  description?: string;
  account_id?: string;  // AWS 账号 ID (12位)
  arn?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountFormData {
  alias: string;
  account_id?: string;
  access_key_id: string;
  secret_access_key: string;
  region: string;
  description?: string;
}

export interface IAMRoleFormData {
  alias: string;
  role_arn: string;
  region: string;
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

interface AccountState {
  // 状态
  accounts: AWSAccount[];
  selectedAccountIds: string[];
  loading: boolean;
  error: string | null;

  // 操作方法
  fetchAccounts: () => Promise<void>;
  addAccount: (account: AccountFormData) => Promise<void>;
  addIAMRoleAccount: (account: IAMRoleFormData) => Promise<void>;
  getExternalId: () => Promise<ExternalIdInfo>;
  deleteAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, updates: Partial<AccountFormData>) => Promise<void>;
  validateAccount: (id: string) => Promise<boolean>;

  // 选择相关
  setSelectedAccounts: (ids: string[]) => void;
  toggleAccountSelection: (id: string) => void;
  selectAllAccounts: () => void;
  clearAccountSelection: () => void;

  // 辅助方法
  getAccountById: (id: string) => AWSAccount | undefined;
  clearError: () => void;
}

export const useAccountStore = create<AccountState>()(
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
      console.log('⏳ AWS 账号正在加载中，跳过重复调用');
      return;
    }

    set({ loading: true, error: null });
    try {
      const accounts = await accountApi.getAll({
        timeout: 15000,  // ✅ 15秒超时
        retry: 2,  // ✅ 重试2次
        retryDelay: 1000  // ✅ 1秒延迟
      });
      set({ accounts, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取账号列表失败';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // 添加账号 (AKSK)
  addAccount: async (accountData: AccountFormData) => {
    set({ loading: true, error: null });
    try {
      await accountApi.create({
        alias: accountData.alias,
        access_key_id: accountData.access_key_id,
        secret_access_key: accountData.secret_access_key,
        region: accountData.region,
        description: accountData.description,
      });

      // 添加成功后重新获取列表
      await get().fetchAccounts();
      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '添加账号失败';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // 添加账号 (IAM Role)
  addIAMRoleAccount: async (accountData: IAMRoleFormData) => {
    set({ loading: true, error: null });
    try {
      await accountApi.createIAMRoleAccount({
        alias: accountData.alias,
        role_arn: accountData.role_arn,
        region: accountData.region,
        description: accountData.description,
        session_duration: accountData.session_duration || 3600,
      });

      // 添加成功后重新获取列表
      await get().fetchAccounts();
      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '添加 IAM Role 账号失败';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // 获取 External ID
  getExternalId: async () => {
    try {
      return await accountApi.getExternalId();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取 External ID 失败';
      set({ error: errorMessage });
      throw error;
    }
  },

  // 删除账号
  deleteAccount: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await accountApi.delete(id);

      // 删除成功后重新获取列表
      await get().fetchAccounts();

      // 如果删除的账号在选中列表中，移除它
      const { selectedAccountIds } = get();
      if (selectedAccountIds.includes(id)) {
        set({ selectedAccountIds: selectedAccountIds.filter(aid => aid !== id) });
      }

      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除账号失败';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // 更新账号
  updateAccount: async (id: string, updates: Partial<AccountFormData>) => {
    set({ loading: true, error: null });
    try {
      await accountApi.update(id, {
        account_name: updates.alias,
        access_key_id: updates.access_key_id,
        secret_access_key: updates.secret_access_key,
        region: updates.region,
      });

      // 更新成功后重新获取列表
      await get().fetchAccounts();
      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新账号失败';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // 验证账号凭证
  validateAccount: async (id: string): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const account = get().accounts.find(acc => acc.id === id);
      if (!account) {
        throw new Error('账号不存在');
      }

      // Note: validateCredentials需要完整凭证，这里无法从已masked的数据验证
      // 实际使用时应该从表单获取完整凭证
      set({ loading: false });
      return true; // 临时返回true，需要在UI层面传入完整凭证
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '验证凭证失败';
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
      name: 'account-storage', // localStorage 中的 key
      partialize: (state) => ({
        selectedAccountIds: state.selectedAccountIds, // 只持久化选中的账号 ID
      }),
    }
  )
);
