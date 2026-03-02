/**
 * 超级管理员路由守卫
 *
 * 用于保护运营后台路由，仅允许超级管理员访问。
 * - 未登录 -> 重定向到登录页
 * - 已登录但非超级管理员 -> 显示 403 页面
 * - 超级管理员 -> 渲染子路由
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore } from '../stores/authStore';
import { useI18n } from '../hooks/useI18n';
import { logger } from '../utils/logger';

export const SuperAdminRoute: React.FC = () => {
  const location = useLocation();
  const { t } = useI18n('common');
  const { isAuthenticated, isSuperAdmin, user } = useAuthStore();

  // 调试日志
  logger.debug('🔐 SuperAdminRoute check:', {
    isAuthenticated,
    isSuperAdmin: isSuperAdmin(),
    username: user?.username,
    path: location.pathname,
  });

  // 未登录 -> 重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 已登录但非超级管理员 -> 显示 403 页面
  if (!isSuperAdmin()) {
    return (
      <Result
        status="403"
        title={t('forbidden.title')}
        subTitle={t('forbidden.subTitle')}
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            {t('forbidden.backButton')}
          </Button>
        }
      />
    );
  }

  // 超级管理员 -> 渲染子路由
  return <Outlet />;
};

export default SuperAdminRoute;
