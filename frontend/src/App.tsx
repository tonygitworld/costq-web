import React, { type FC } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
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
import { OpsDashboard, TenantList, TenantDetail, AuditLogs } from './components/ops';
import { SSEProvider } from './contexts/SSEContext';
import { I18nProvider } from './components/common/I18nProvider';
import { useAuthStore } from './stores/authStore';
import { useAccountStore } from './stores/accountStore';
import { useGCPAccountStore } from './stores/gcpAccountStore';
import { antdTheme } from './styles/antd-theme';
import { TestDataButton } from './components/dev/TestDataButton';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { ensureTokenValid } from './utils/tokenUtils';
import { setAuthMessageListener, setAuthRedirectListener } from './utils/authNotifications';
import './i18n';  // 初始化i18n
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
      setAuthMessageListener(null as any);
      setAuthRedirectListener(null as any);
    };
  }, [message, navigate]);

  // ✅ P0: 保存流式中断内容（必须在 SSEProvider 内部）
  useBeforeUnload();

  return (
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
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout />
              {/* 开发工具：测试数据注入按钮（仅开发模式） */}
              <TestDataButton />
            </div>
          </ProtectedRoute>
        }
      />
      
      {/* 会话页面 - 支持 URL 路由（类似 OpenAI /c/{conversation-id}） */}
      <Route
        path="/c/:sessionId"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout />
              {/* 开发工具：测试数据注入按钮（仅开发模式） */}
              <TestDataButton />
            </div>
          </ProtectedRoute>
        }
      />

      {/* 云账号管理（需要管理员权限） */}
      <Route
        path="/settings/cloud-accounts"
        element={
          <ProtectedRoute requireAdmin>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <CloudAccountManagement />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 用户管理（需要管理员权限） */}
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute requireAdmin>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <UserManagement />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 用户基本信息（需要登录） */}
      <Route
        path="/user/profile"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <UserProfile />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 修改密码（需要登录） */}
      <Route
        path="/user/change-password"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <ChangePassword />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 告警管理（所有登录用户可访问） */}
      <Route
        path="/settings/alerts"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <AlertManagement />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 创建/编辑告警（所有登录用户可访问） */}
      <Route
        path="/settings/alerts/:id/edit"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <AlertForm />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/alerts/new"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <AlertForm />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 告警详情（所有登录用户可访问） */}
      <Route
        path="/settings/alerts/:id"
        element={
          <ProtectedRoute>
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <AlertDetail />
              </ChatLayout>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 运营后台路由（仅超级管理员可访问） */}
      <Route element={<SuperAdminRoute />}>
        <Route
          path="/ops"
          element={<Navigate to="/ops/dashboard" replace />}
        />
        <Route
          path="/ops/dashboard"
          element={
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <OpsDashboard />
              </ChatLayout>
            </div>
          }
        />
        <Route
          path="/ops/tenants"
          element={
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <TenantList />
              </ChatLayout>
            </div>
          }
        />
        <Route
          path="/ops/tenants/:tenantId"
          element={
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <TenantDetail />
              </ChatLayout>
            </div>
          }
        />
        <Route
          path="/ops/audit-logs"
          element={
            <div className="app" style={{ height: '100vh', width: '100vw' }}>
              <ChatLayout>
                <AuditLogs />
              </ChatLayout>
            </div>
          }
        />
      </Route>
    </Routes>
  );
};

const App: FC = () => {
  // ✅ 在应用启动时检查并刷新 Token，然后加载账号数据（如果用户已登录）
  // 确保账号选择器有数据可用，即使选择器组件因为条件渲染不显示
  React.useEffect(() => {
    const initializeApp = async () => {
      // 检查用户是否已登录
      const { isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated) {
        console.log('ℹ️ 用户未登录，跳过初始化');
        return;
      }

      try {
        // ✅ 第一步：检查并刷新 Token（如果过期）
        console.log('🔄 [App] 检查 Token 状态...');
        const tokenValid = await ensureTokenValid();
        
        if (!tokenValid) {
          console.warn('⚠️ [App] Token 刷新失败，跳过数据加载');
          return;
        }

        // ✅ 第二步：Token 有效后，加载账号数据
        const { fetchAccounts: fetchAWSAccounts } = useAccountStore.getState();
        const { fetchAccounts: fetchGCPAccounts } = useGCPAccountStore.getState();
        
        // 并行加载，提高性能
        await Promise.all([
          fetchAWSAccounts().catch(err => console.warn('加载 AWS 账号失败:', err)),
          fetchGCPAccounts().catch(err => console.warn('加载 GCP 账号失败:', err))
        ]);
        
        console.log('✅ 应用启动：账号数据加载完成');
      } catch (error) {
        console.error('❌ 应用启动：初始化失败:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ConfigProvider theme={antdTheme}>
          <AntdApp>
            <BrowserRouter>
              <SSEProvider>
                <AppContent />
              </SSEProvider>
            </BrowserRouter>
          </AntdApp>
        </ConfigProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
};

export default App;
