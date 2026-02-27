import React, { type FC } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatLayout } from './components/layout/ChatLayout';
import { CloudAccountManagement } from './components/settings/CloudAccountManagement';
import { UserProfile } from './components/user/UserProfile';
import { ChangePassword } from './components/user/ChangePassword';
import { UserManagement } from './components/user/UserManagement';
import { AlertManagement } from './components/alert/AlertManagement';
import { AlertForm } from './components/alert/AlertForm';
import { AlertDetail } from './components/alert/AlertDetail';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { Activate } from './components/auth/Activate';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { SuperAdminRoute } from './routes/SuperAdminRoute';
import { OpsDashboard, TenantList, TenantDetail, AuditLogs, OpsTokenUsage } from './components/ops';
import { SSEProvider } from './contexts/SSEContext';
import { I18nProvider } from './components/common/I18nProvider';
import { useAuthStore } from './stores/authStore';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { setAuthMessageListener, setAuthRedirectListener } from './utils/authNotifications';
import './i18n';
import 'antd/dist/reset.css';
import './styles/account-selection.css';

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
      {/* 登录页面 */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        }
      />

      {/* 注册页面 */}
      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Register />
        }
      />

      {/* 激活账号页面 */}
      <Route
        path="/activate/:token"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Activate />
        }
      />

      {/* 主页 - 聊天界面（需要登录） */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      />

      {/* 聊天会话页面 - 带会话ID的聊天界面 */}
      <Route
        path="/c/:sessionId"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      />

      {/* 设置页面 - 云账号管理 */}
      <Route
        path="/settings/accounts"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <CloudAccountManagement />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 个人设置 - 个人资料 */}
      <Route
        path="/settings/profile"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <UserProfile />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 个人设置 - 修改密码 */}
      <Route
        path="/settings/password"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <ChangePassword />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 系统设置 - 用户管理 (仅管理员) */}
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute requireAdmin>
            <ChatLayout>
              <UserManagement />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 告警管理列表 */}
      <Route
        path="/settings/alerts"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <AlertManagement />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 创建告警 */}
      <Route
        path="/settings/alerts/new"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <AlertForm />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 编辑告警 */}
      <Route
        path="/settings/alerts/edit/:id"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <AlertForm />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 告警详情 */}
      <Route
        path="/settings/alerts/:id"
        element={
          <ProtectedRoute>
            <ChatLayout>
              <AlertDetail />
            </ChatLayout>
          </ProtectedRoute>
        }
      />

      {/* 运营后台 - 需要超级管理员权限 */}
      <Route
        path="/ops/*"
        element={
          <ProtectedRoute>
            <SuperAdminRoute />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<ChatLayout><OpsDashboard /></ChatLayout>} />
        <Route path="tenants" element={<ChatLayout><TenantList /></ChatLayout>} />
        <Route path="tenants/:tenantId" element={<ChatLayout><TenantDetail /></ChatLayout>} />
        <Route path="audit-logs" element={<ChatLayout><AuditLogs /></ChatLayout>} />
        <Route path="token-usage" element={<ChatLayout><OpsTokenUsage /></ChatLayout>} />
        {/* 默认跳转 */}
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
