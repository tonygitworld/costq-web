import { logger } from './logger';
/**
 * 认证相关的全局通知机制
 * 用于在 Zustand store 中触发消息提示和页面跳转
 */

// 全局事件监听器
type AuthNotificationListener = (message: string) => void;
type AuthRedirectListener = () => void;

let messageListener: AuthNotificationListener | null = null;
let redirectListener: AuthRedirectListener | null = null;

/**
 * 设置消息监听器（在组件层调用）
 */
export function setAuthMessageListener(listener: AuthNotificationListener | null) {
  messageListener = listener;
}

/**
 * 设置跳转监听器（在组件层调用）
 */
export function setAuthRedirectListener(listener: AuthRedirectListener | null) {
  redirectListener = listener;
}

/**
 * 触发认证错误消息（在 store 中调用）
 */
export function notifyAuthError(message: string) {
  if (messageListener) {
    messageListener(message);
  } else {
    // 兜底：使用原生 alert
    logger.warn('⚠️ [authNotifications] 消息监听器未设置，使用 alert');
    alert(message);
  }
}

/**
 * 触发跳转到登录页（在 store 中调用）
 */
export function redirectToLogin() {
  if (redirectListener) {
    redirectListener();
  } else {
    // 兜底：使用 window.location
    logger.warn('⚠️ [authNotifications] 跳转监听器未设置，使用 window.location');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}
