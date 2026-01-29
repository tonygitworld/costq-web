/**
 * Alert 相关类型定义
 */

export interface Alert {
  id: string;
  org_id: string;
  user_id: string;
  display_name: string;
  description: string;
  check_frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  created_by_username?: string;
  account_id?: string;  // ⭐ 新增：关联的账号ID
  account_type?: string;  // ⭐ 新增：账号类型（aws/gcp）
}

export interface AlertHistory {
  id: string;
  alert_id: string;
  executed_at: string;
  status: 'success' | 'failed';
  triggered: boolean;
  result_summary: string;
  error_message?: string;
}

export interface CreateAlertRequest {
  query_description: string;  // 后端必填字段：完整的自然语言描述
  display_name?: string;      // 后端可选字段：告警显示名称
  user_id: string;            // 后端必填字段：用户ID
  org_id: string;             // 后端必填字段：组织ID
  check_frequency?: string;   // 后端可选字段：检查频率，默认 daily
  account_id?: string;        // ⭐ 新增：关联的账号ID
  account_type?: string;      // ⭐ 新增：账号类型
}

export interface UpdateAlertRequest {
  query_description?: string;
  display_name?: string;
  check_frequency?: string;   // ✅ 新增：检查频率
  account_id?: string;        // ⭐ 关联的账号ID
  account_type?: string;      // ⭐ 账号类型
}

export interface ListAlertsParams {
  status?: 'active' | 'inactive' | 'all';
  created_by?: 'me' | 'all';
  search?: string;
}

// ⭐ 新增：告警测试结果
export interface AlertTestResult {
  success: boolean;
  triggered: boolean;
  current_value?: number;
  threshold?: number;
  threshold_operator?: string;
  email_sent: boolean;
  to_emails?: string[];
  message: string;
  execution_time_ms?: number;
  error?: string;
}
