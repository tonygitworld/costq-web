/**
 * Alert 相关 API 服务
 */

import { apiClient } from '../apiClient';
import type {
  Alert,
  AlertHistory,
  CreateAlertRequest,
  UpdateAlertRequest,
  ListAlertsParams,
  AlertTestResult  // ⭐ 新增
} from '../../types/alert';

export const alertApi = {
  /**
   * 获取告警列表
   */
  async getAll(params?: ListAlertsParams): Promise<Alert[]> {
    const response = await apiClient.get<{ success: boolean; count: number; alerts: Alert[] }>(
      '/alerts/',
      { params: params as Record<string, string | number | boolean> }
    );
    return response.alerts;
  },

  /**
   * 获取单个告警详情
   */
  async getById(id: string): Promise<Alert> {
    const response = await apiClient.get<{ success: boolean; alert: Alert }>(`/alerts/${id}`);
    return response.alert;
  },

  /**
   * 创建告警
   */
  async create(data: CreateAlertRequest): Promise<Alert> {
    const response = await apiClient.post<{ success: boolean; alert: Alert; alert_id: string }>('/alerts/', data);
    return response.alert;
  },

  /**
   * 更新告警
   */
  async update(id: string, data: UpdateAlertRequest): Promise<Alert> {
    const response = await apiClient.put<{ success: boolean; alert: Alert }>(`/alerts/${id}`, data);
    return response.alert;
  },

  /**
   * 删除告警
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(`/alerts/${id}`);
  },

  /**
   * 切换告警状态（启用/禁用）
   */
  async toggle(id: string): Promise<Alert> {
    const response = await apiClient.post<{ success: boolean; alert: Alert; is_active: boolean }>(`/alerts/${id}/toggle`);
    return response.alert;
  },

  /**
   * 执行告警测试（通过 Agent 进行真实检查）
   *
   * @param id 告警ID
   * @param accountId 可选：指定使用的账号ID
   * @returns 告警测试结果
   */
  async sendTestEmail(id: string, accountId?: string): Promise<AlertTestResult> {
    const response = await apiClient.post<AlertTestResult>(
      `/alerts/${id}/send-test`,
      { account_id: accountId },
      { timeout: 610000 }  // ⭐ 610秒超时（后端600秒 + 10秒缓冲）
    );
    return response;
  },

  /**
   * 获取告警执行历史
   */
  async getHistory(id: string): Promise<AlertHistory[]> {
    const response = await apiClient.get<{ success: boolean; count: number; history: AlertHistory[] }>(`/alerts/${id}/history`);
    return response.history;
  },

  /**
   * 手动触发告警调度器（仅管理员）
   */
  async triggerScheduler(): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      '/alerts/scheduler/trigger',
      {},
      { timeout: 610000 }  // ⭐ 610秒超时（后端600秒 + 10秒缓冲）
    );
  }
};
