/**
 * 运营后台 API 服务
 *
 * 提供 Dashboard、租户管理、审计日志等 API 调用方法
 */
import { apiClient } from './apiClient';

// ==================== Dashboard 类型 ====================

export interface DashboardStats {
  total_tenants: number;
  total_users: number;
  active_tenants: number;
  pending_tenants: number;
  today_dau: number;
  today_queries: number;
  yesterday_dau: number;
  yesterday_queries: number;
  updated_at: string;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface DashboardTrends {
  days: number;
  dau_trend: TrendDataPoint[];
  query_trend: TrendDataPoint[];
}

// ==================== 租户管理类型 ====================

export interface TenantListItem {
  id: string;
  name: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
  last_active_at: string | null;
}

export interface TenantListResponse {
  total: number;
  page: number;
  page_size: number;
  items: TenantListItem[];
}

export interface TenantDetail {
  id: string;
  name: string;
  is_active: boolean;
  external_id: string | null;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface TenantListParams {
  page?: number;
  page_size?: number;
  status?: 'all' | 'active' | 'pending';
  search?: string;
}

export interface TenantActionResponse {
  message: string;
  tenant_id: string;
  is_active: boolean;
}

// ==================== 租户用户类型 ====================

export interface TenantUserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface TenantUserListResponse {
  total: number;
  page: number;
  page_size: number;
  items: TenantUserItem[];
}

export interface TenantUserListParams {
  page?: number;
  page_size?: number;
}

// ==================== 审计日志类型 ====================

export interface AuditLogItem {
  id: string;
  timestamp: string;
  org_id: string | null;
  org_name: string | null;
  user_id: string | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
}

export interface AuditLogListResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditLogItem[];
}

export interface ActionType {
  value: string;
  label: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface AuditLogListParams {
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
  org_id?: string;
  user_id?: string;
  action?: string;
  search?: string;
}


// ==================== 辅助函数 ====================

/**
 * 过滤掉 undefined 值，使参数符合 apiClient 的类型要求
 */
function filterParams(
  params: object
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value as string | number | boolean;
    }
  }
  return result;
}

// ==================== API 服务 ====================

export const opsService = {
  // -------------------- Dashboard --------------------

  /**
   * 获取 Dashboard 统计数据
   */
  getDashboardStats: (): Promise<DashboardStats> =>
    apiClient.get<DashboardStats>('/ops/dashboard/stats'),

  /**
   * 获取趋势数据
   * @param days 天数（7 或 30）
   */
  getDashboardTrends: (days: number = 7): Promise<DashboardTrends> =>
    apiClient.get<DashboardTrends>('/ops/dashboard/trends', {
      params: { days },
    }),

  // -------------------- 租户管理 --------------------

  /**
   * 获取租户列表
   */
  getTenants: (params: TenantListParams): Promise<TenantListResponse> =>
    apiClient.get<TenantListResponse>('/ops/tenants', { params: filterParams(params) }),

  /**
   * 获取租户详情
   */
  getTenant: (tenantId: string): Promise<TenantDetail> =>
    apiClient.get<TenantDetail>(`/ops/tenants/${tenantId}`),

  /**
   * 激活租户
   */
  activateTenant: (tenantId: string): Promise<TenantActionResponse> =>
    apiClient.put<TenantActionResponse>(`/ops/tenants/${tenantId}/activate`),

  /**
   * 禁用租户
   */
  deactivateTenant: (tenantId: string): Promise<TenantActionResponse> =>
    apiClient.put<TenantActionResponse>(`/ops/tenants/${tenantId}/deactivate`),

  /**
   * 获取租户下的用户列表
   */
  getTenantUsers: (
    tenantId: string,
    params: TenantUserListParams
  ): Promise<TenantUserListResponse> =>
    apiClient.get<TenantUserListResponse>(`/ops/tenants/${tenantId}/users`, {
      params: filterParams(params),
    }),

  // -------------------- 审计日志 --------------------

  /**
   * 获取审计日志列表
   */
  getAuditLogs: (params: AuditLogListParams): Promise<AuditLogListResponse> =>
    apiClient.get<AuditLogListResponse>('/ops/audit-logs', { params: filterParams(params) }),

  /**
   * 获取操作类型列表（用于筛选下拉框）
   */
  getActionTypes: (): Promise<{ actions: ActionType[] }> =>
    apiClient.get<{ actions: ActionType[] }>('/ops/audit-logs/actions'),

  /**
   * 获取租户选项（用于筛选下拉框）
   */
  getAuditLogTenants: (): Promise<{ options: FilterOption[] }> =>
    apiClient.get<{ options: FilterOption[] }>('/ops/audit-logs/tenants'),

  /**
   * 获取用户选项（用于筛选下拉框）
   */
  getAuditLogUsers: (orgId?: string): Promise<{ options: FilterOption[] }> =>
    apiClient.get<{ options: FilterOption[] }>('/ops/audit-logs/users', {
      params: orgId ? { org_id: orgId } : {},
    }),
};
