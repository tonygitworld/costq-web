// ChatLayout component - Main layout with sidebar and content area
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Button, Drawer } from 'antd';
import { MenuOutlined, CloudOutlined, GoogleOutlined, WarningOutlined } from '@ant-design/icons';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { ScrollIssueReporter } from '../common/ScrollIssueReporter';
import { UserDropdown } from '../common/UserDropdown';
import { AccountSelector } from '../common/AccountSelector';
import { GCPAccountSelector } from '../gcp/GCPAccountSelector';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useAccountSelectionDetails } from '../../hooks/useAccountSelection';
import { useChatStore } from '../../stores/chatStore';
import './ChatLayout.css';

import { logger } from '../../utils/logger';

interface ChatLayoutProps {
  className?: string;
  children?: React.ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ className, children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const accountDetails = useAccountSelectionDetails();
  
  // ✅ URL 路由支持：读取 sessionId 参数
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { switchToChat, currentChatId, chats, messages } = useChatStore();
  
  // ✅ 当 URL 中的 sessionId 变化时，切换到对应会话（优先级：URL → Store）
  // ✅ 立即切换，不等待消息加载
  useEffect(() => {
    if (sessionId && sessionId !== currentChatId) {
      // ✅ 检查当前会话是否是新建的临时会话（没有消息且没有 messageCount）
      const currentSession = currentChatId ? chats[currentChatId] : null;
      const isNewTempSession = currentSession && 
                                !currentSession.messageCount && 
                                (currentChatId ? (messages[currentChatId]?.length || 0) : 0) === 0;
      
      // ✅ 如果当前是新建的临时会话，且 URL 指向旧会话，不切换（避免覆盖新建会话）
      if (isNewTempSession && location.pathname.startsWith('/c/')) {
        logger.debug(`ℹ️ [ChatLayout] 检测到新建临时会话，忽略 URL 切换: ${currentChatId} (URL: ${sessionId})`);
        return;
      }
      
      // 检查会话是否存在
      if (chats[sessionId]) {
        logger.debug(`🔄 [ChatLayout] URL 会话ID变化，立即切换到: ${sessionId}`);
        // ✅ 立即切换（不等待），消息加载在 switchToChat 内部异步进行
        switchToChat(sessionId);
      } else {
        logger.warn(`⚠️ [ChatLayout] URL 中的会话不存在: ${sessionId}`);
        // 如果会话不存在，导航回主页
        if (location.pathname.startsWith('/c/')) {
          navigate('/', { replace: true });
        }
      }
    }
    // ✅ 注意：不依赖 currentChatId，避免循环更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, chats, switchToChat, navigate, location.pathname, messages]);
  
  // ✅ 当 currentChatId 变化时，同步更新 URL（优先级：Store → URL）
  // ✅ 使用 useRef 避免循环更新
  const lastSyncedChatId = useRef<string | null>(null);
  
  useEffect(() => {
    if (!currentChatId) {
      // 如果 currentChatId 为空但 URL 是会话页面，导航回主页
      if (location.pathname.startsWith('/c/')) {
        logger.debug(`🔄 [ChatLayout] currentChatId 为空，导航回主页`);
        navigate('/', { replace: true });
        lastSyncedChatId.current = null;
      }
      return;
    }

    // ✅ 检查会话是否有消息或是否是从后端加载的会话
    const session = chats[currentChatId];
    const hasMessages = (messages[currentChatId]?.length || 0) > 0;
    // ✅ 如果会话有 messageCount 字段，说明是从后端加载的，即使消息还没加载也应该更新 URL
    const isBackendSession = session?.messageCount !== undefined;
    
    // 如果 currentChatId 变化且与上次同步的不同
    if (currentChatId !== lastSyncedChatId.current) {
      // ✅ 如果会话有消息，或者是后端会话（消息可能还在加载），更新 URL
      if (hasMessages || isBackendSession) {
        const expectedPath = `/c/${currentChatId}`;
        // 只有当 URL 不匹配时才更新（避免与 URL → Store 的更新冲突）
        if (location.pathname !== expectedPath) {
          logger.debug(`🔄 [ChatLayout] currentChatId 变化，同步 URL: ${expectedPath} (hasMessages: ${hasMessages}, isBackendSession: ${isBackendSession})`);
          navigate(expectedPath, { replace: true });
          lastSyncedChatId.current = currentChatId;
        } else {
          // URL 已经匹配，只更新 ref
          lastSyncedChatId.current = currentChatId;
        }
      } else {
        // ✅ 新建但未发送消息的会话（前端临时创建），不更新 URL（保持在主页）
        logger.debug(`ℹ️ [ChatLayout] 新建会话但无消息，不更新 URL: ${currentChatId}`);
        lastSyncedChatId.current = currentChatId;  // 更新 ref，避免重复检查
      }
    } else if (currentChatId === sessionId) {
      // ✅ 如果 currentChatId 与 URL 中的 sessionId 匹配，更新 lastSyncedChatId
      lastSyncedChatId.current = currentChatId;
    }
  }, [currentChatId, navigate, location.pathname, sessionId, messages, chats]);

  return (
    <Layout className={className} style={{ height: '100vh' }}>
      <Layout.Sider
        width={260}
        breakpoint="lg"
        collapsedWidth={0}
        onBreakpoint={(broken) => {
          setCollapsed(broken);
        }}
        theme="dark"
        className="chat-layout-sider"
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}
      >
        <Sidebar />
      </Layout.Sider>

      <Layout className="chat-layout-main" style={{ marginLeft: collapsed ? 0 : 260 }}>
        {/* 顶部 Header - 账号选择和用户信息 */}
        <Layout.Header className="chat-layout-header">
          {/* 左侧：移动端菜单按钮 */}
          <div>
            {collapsed && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setSidebarVisible(true)}
                size="large"
              />
            )}
          </div>

          {/* 右侧：账号选择器 + 用户信息 */}
          <div className="chat-layout-header-actions">
            {/* 未选择账号时的警告图标 */}
            {!accountDetails.hasAny && (
              <WarningOutlined className="chat-layout-warning-icon" />
            )}

            {/* AWS 账号 */}
            {accountDetails.hasAWSAccounts && (
              <div className="chat-layout-account-section">
                <span className="chat-layout-account-label">
                  <CloudOutlined style={{ fontSize: '14px', color: '#FF9900' }} />
                  AWS
                </span>
                <div className="chat-layout-account-selector">
                  <AccountSelector />
                </div>
              </div>
            )}

            {/* GCP 账号 */}
            {accountDetails.hasGCPAccounts && (
              <div className="chat-layout-account-section">
                <span className="chat-layout-account-label">
                  <GoogleOutlined style={{ fontSize: '14px', color: '#4285F4' }} />
                  GCP
                </span>
                <div className="chat-layout-account-selector">
                  <GCPAccountSelector />
                </div>
              </div>
            )}

            {/* 分隔线 */}
            <div className="chat-layout-divider" />

            {/* 语言切换器 */}
            <div>
              <LanguageSwitcher showIcon={false} showText={true} />
            </div>

            {/* 分隔线 */}
            <div className="chat-layout-divider" />

            {/* 用户信息 */}
            <div>
              <UserDropdown />
            </div>
          </div>
        </Layout.Header>

        {/* 主内容区域 */}
        <Layout.Content style={{ position: 'relative' }}>
          {children || <MainContent />}

          {/* 连接状态已移到输入框左侧，此处不再显示 */}
          {/* <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 1000
          }}>
            <ConnectionStatus />
          </div> */}

          {process.env.NODE_ENV === 'development' && <ScrollIssueReporter />}
        </Layout.Content>
      </Layout>

      {/* 移动端：抽屉式侧边栏 */}
      <Drawer
        placement="left"
        open={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        className="chat-layout-drawer"
        styles={{
          body: { padding: 0, backgroundColor: '#1a1f2e' },
          header: { backgroundColor: '#1a1f2e', borderBottom: '1px solid rgba(255,255,255,0.1)' }
        }}
      >
        <Sidebar />
      </Drawer>
    </Layout>
  );
};
