import React, { type FC, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { App as AntdApp, Spin } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ★ P0: 首屏关键组件 - 同步加载（首屏必需）
import { EnterpriseLogin } from './components/auth/EnterpriseLogin';
import ProductPage from './components/product/ProductPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { SuperAdminRoute } from './routes/SuperAdminRoute';

// ★ P0: 非首屏页面 - 路由级懒加载
const ChatLayout = lazy(() => import('./components/layout/ChatLayout').then(m => ({ default: m.ChatLayout })));
const CloudAccountManagement = lazy(() => import('./components/settings/CloudAccountManagement').then(m => ({ default: m.CloudAccountManagement })));
const UserProfile = lazy(() => import('./components/user/UserProfile').then(m => ({ default: m.UserProfile })));
const ChangePassword = lazy(() => import('./components/user/ChangePassword').then(m => ({ default: m.ChangePassword })));
const UserManagement = lazy(() => import('./components/user/UserManagement').then(m => ({ default: m.UserManagement })));
const AlertManagement = lazy(() => import('./components/alert/AlertManagement').then(m => ({ default: m.AlertManagement })));
const AlertForm = lazy(() => import('./components/alert/AlertForm').then(m => ({ default: m.AlertForm })));
const AlertDetail = lazy(() => import('./components/alert/AlertDetail').then(m => ({ default: m.AlertDetail })));
const Register = lazy(() => import('./components/auth/Register').then(m => ({ default: m.Register })));
const Activate = lazy(() => import('./components/auth/Activate').then(m => ({ default: m.Activate })));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));

// ★ P0: 运营后台页面 - 独立 chunk (修复：使用命名导出 m.OpsDashboard，不是 m.default.OpsDashboard)
const OpsDashboard = lazy(() => import('./components/ops').then(m => ({ default: m.OpsDashboard })));
const TenantList = lazy(() => import('./components/ops').then(m => ({ default: m.TenantList })));
const TenantDetail = lazy(() => import('./components/ops').then(m => ({ default: m.TenantDetail })));
const AuditLogs = lazy(() => import('./components/ops').then(m => ({ default: m.AuditLogs })));
const OpsTokenUsage = lazy(() => import('./components/ops').then(m => ({ default: m.OpsTokenUsage })));

import { SSEProvider } from './contexts/SSEContext';
import { I18nProvider } from './components/common/I18nProvider';
import { useAuthStore } from './stores/authStore';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { setAuthMessageListener, setAuthRedirectListener } from './utils/authNotifications';
import './i18n';
import 'antd/dist/reset.css';
import './styles/account-selection.css';

// ★ P0: 路由级 Loading 组件（避免白屏）
const RouteFallback: FC = () => (
  <div style={{
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc'
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分钟
      retry: 1,
    },
  },
});

// ✅ P0: 在 SSEProvider 内部使用 Hook 的包装组件
const AppContent: FC = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();

  // ✅ 设置全局认证通知监听器
  React.useEffect(() => {
    setAuthMessageListener((msg: string) => {
      message.error(msg);
    });

    setAuthRedirectListener(() => {
      navigate('/login', { replace: true });
    });

    // 清理函数
    return () => {
      setAuthMessageListener(null);
      setAuthRedirectListener(null);
    };
  }, [message, navigate]);

  // ✅ P0: 保存流式中断内容（必须在 SSEProvider 内部）
  useBeforeUnload();

  return (
    <AntdApp>
      <Routes>
        {/* ★ 产品介绍页 - 公开页面，作为首页（首屏关键） */}
        <Route path="/" element={<ProductPage />} />

        {/* 登录页面 - 首屏关键 */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/chat" replace /> : <EnterpriseLogin />}
        />

        {/* 注册页面 - 懒加载 */}
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to="/chat" replace /> : (
              <Suspense fallback={<RouteFallback />}>
                <Register />
              </Suspense>
            )
          }
        />

        {/* 激活账号页面 - 懒加载 */}
        <Route
          path="/activate/:token"
          element={
            isAuthenticated ? <Navigate to="/chat" replace /> : (
              <Suspense fallback={<RouteFallback />}>
                <Activate />
              </Suspense>
            )
          }
        />

        {/* 忘记密码页面 - 懒加载 */}
        <Route
          path="/forgot-password"
          element={
            isAuthenticated ? <Navigate to="/chat" replace /> : (
              <Suspense fallback={<RouteFallback />}>
                <ForgotPassword />
              </Suspense>
            )
          }
        />

        {/* 主页 - 聊天界面（需要登录）- 懒加载 */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 聊天会话页面 - 懒加载 */}
        <Route
          path="/c/:sessionId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 设置页面 - 云账号管理 - 懒加载 */}
        <Route
          path="/settings/accounts"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <CloudAccountManagement />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 个人设置 - 个人资料 - 懒加载 */}
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <UserProfile />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 个人设置 - 修改密码 - 懒加载 */}
        <Route
          path="/settings/password"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <ChangePassword />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 系统设置 - 用户管理 (仅管理员) - 懒加载 */}
        <Route
          path="/settings/users"
          element={
            <ProtectedRoute requireAdmin>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <UserManagement />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 告警管理列表 - 懒加载 */}
        <Route
          path="/settings/alerts"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <AlertManagement />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 创建告警 - 懒加载 */}
        <Route
          path="/settings/alerts/new"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <AlertForm />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

<<<<<<< HEAD
        {/* 编辑告警 - 懒加载 */}
        <Route
          path="/settings/alerts/edit/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <AlertForm />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />


        {/* 告警详情 - 懒加载 */}
        <Route
          path="/settings/alerts/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <ChatLayout>
                  <AlertDetail />
                </ChatLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 运营后台 - 需要超级管理员权限 - 懒加载 */}
        <Route
          path="/ops/*"
          element={
            <ProtectedRoute>
              <SuperAdminRoute />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={
            <Suspense fallback={<RouteFallback />}>
              <ChatLayout><OpsDashboard /></ChatLayout>
            </Suspense>
          } />
          <Route path="tenants" element={
            <Suspense fallback={<RouteFallback />}>
              <ChatLayout><TenantList /></ChatLayout>
            </Suspense>
          } />
          <Route path="tenants/:id" element={
            <Suspense fallback={<RouteFallback />}>
              <ChatLayout><TenantDetail /></ChatLayout>
            </Suspense>
          } />
          <Route path="audit-logs" element={
            <Suspense fallback={<RouteFallback />}>
              <ChatLayout><AuditLogs /></ChatLayout>
            </Suspense>
          } />
          <Route path="token-usage" element={
            <Suspense fallback={<RouteFallback />}>
              <ChatLayout><OpsTokenUsage /></ChatLayout>
            </Suspense>
          } />
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* 为了兼容旧路径，添加重定向 */}
        <Route path="/alerts" element={<Navigate to="/settings/alerts" replace />} />

        {/* 404 跳转 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AntdApp>
  );
};

export const App: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
          <SSEProvider>
            <AppContent />
          </SSEProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
