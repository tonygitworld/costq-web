/**
 * Alert Store - 告警状态管理
 */

import { create } from 'zustand';
import { alertApi } from '../services/api/alertApi';
import type { Alert, AlertHistory, CreateAlertRequest, UpdateAlertRequest, ListAlertsParams, AlertTestResult } from '../types/alert';

interface AlertStore {
  // 状态
  alerts: Alert[];
  currentAlert: Alert | null;
  alertHistory: AlertHistory[];
  loading: boolean;  // 通用 loading（列表、删除、切换状态等）
  fetchingAlert: boolean;  // ✅ 加载单个告警的 loading
  savingAlert: boolean;  // ✅ 保存/更新告警的 loading
  error: string | null;

  // 操作
  fetchAlerts: (params?: ListAlertsParams) => Promise<void>;
  fetchAlertById: (id: string) => Promise<void>;
  fetchAlertHistory: (id: string) => Promise<void>;
  createAlert: (data: CreateAlertRequest) => Promise<Alert>;
  updateAlert: (id: string, data: UpdateAlertRequest) => Promise<Alert>;
  deleteAlert: (id: string) => Promise<void>;
  toggleAlert: (id: string) => Promise<Alert>;
  sendTestEmail: (id: string, accountId?: string) => Promise<AlertTestResult>;  // ⭐ 更新类型
  triggerScheduler: () => Promise<void>;  // ⭐ 新增：手动触发调度器
  clearError: () => void;
  setCurrentAlert: (alert: Alert | null) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  // 初始状态
  alerts: [],
  currentAlert: null,
  alertHistory: [],
  loading: false,
  fetchingAlert: false,  // ✅ 初始化为 false
  savingAlert: false,    // ✅ 初始化为 false
  error: null,

  // 获取告警列表
  fetchAlerts: async (params?: ListAlertsParams) => {
    console.log('📡 alertStore.fetchAlerts - 开始请求');
    set({ loading: true, error: null });
    try {
      const alerts = await alertApi.getAll(params);
      console.log('✅ alertStore.fetchAlerts - 请求成功, alerts:', alerts);
      console.log('📊 第一个告警的ID:', alerts[0]?.id);
      set({ alerts, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取告警列表失败';
      console.error('❌ alertStore.fetchAlerts - 请求失败:', error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  // 获取单个告警
  fetchAlertById: async (id: string) => {
    console.log('📡 alertStore.fetchAlertById - 开始请求, ID:', id);
    set({ fetchingAlert: true, error: null });  // ✅ 使用 fetchingAlert
    try {
      const alert = await alertApi.getById(id);
      console.log('✅ alertStore.fetchAlertById - 请求成功, Alert:', alert);
      set({ currentAlert: alert, fetchingAlert: false });  // ✅ 使用 fetchingAlert
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取告警详情失败';
      console.error('❌ alertStore.fetchAlertById - 请求失败:', error);
      set({ error: message, fetchingAlert: false });  // ✅ 使用 fetchingAlert
      throw error;
    }
  },

  // 获取告警历史
  fetchAlertHistory: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const history = await alertApi.getHistory(id);
      set({ alertHistory: history, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取执行历史失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // 创建告警
  createAlert: async (data: CreateAlertRequest) => {
    set({ savingAlert: true, error: null });  // ✅ 使用 savingAlert
    try {
      const alert = await alertApi.create(data);
      set(state => ({
        alerts: [alert, ...state.alerts],
        savingAlert: false  // ✅ 使用 savingAlert
      }));
      return alert;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建告警失败';
      set({ error: message, savingAlert: false });  // ✅ 使用 savingAlert
      throw error;
    }
  },

  // 更新告警
  updateAlert: async (id: string, data: UpdateAlertRequest) => {
    set({ savingAlert: true, error: null });  // ✅ 使用 savingAlert
    try {
      const alert = await alertApi.update(id, data);
      set(state => ({
        alerts: state.alerts.map(a => a.id === id ? alert : a),
        currentAlert: state.currentAlert?.id === id ? alert : state.currentAlert,
        savingAlert: false  // ✅ 使用 savingAlert
      }));
      return alert;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新告警失败';
      set({ error: message, savingAlert: false });  // ✅ 使用 savingAlert
      throw error;
    }
  },

  // 删除告警
  deleteAlert: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await alertApi.delete(id);
      set(state => ({
        alerts: state.alerts.filter(a => a.id !== id),
        currentAlert: state.currentAlert?.id === id ? null : state.currentAlert,
        loading: false
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '删除告警失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // 切换告警状态
  toggleAlert: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const alert = await alertApi.toggle(id);
      set(state => ({
        alerts: state.alerts.map(a => a.id === id ? alert : a),
        currentAlert: state.currentAlert?.id === id ? alert : state.currentAlert,
        loading: false
      }));
      return alert;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '切换告警状态失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // 执行告警测试（通过 Agent）
  sendTestEmail: async (id: string, accountId?: string) => {
    set({ savingAlert: true, error: null });  // ✅ 使用 savingAlert（测试也算保存操作）
    try {
      const result = await alertApi.sendTestEmail(id, accountId);
      set({ savingAlert: false });  // ✅ 使用 savingAlert
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '告警测试失败';
      set({ error: message, savingAlert: false });  // ✅ 使用 savingAlert
      throw error;
    }
  },

  // 手动触发调度器（仅管理员）
  triggerScheduler: async () => {
    set({ loading: true, error: null });
    try {
      await alertApi.triggerScheduler();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '触发调度器失败';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // 清除错误
  clearError: () => set({ error: null }),

  // 设置当前告警
  setCurrentAlert: (alert: Alert | null) => set({ currentAlert: alert })
}));
