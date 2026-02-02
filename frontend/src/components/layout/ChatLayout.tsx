// ChatLayout component - Main layout with sidebar and content area
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Button, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { ScrollIssueReporter } from '../common/ScrollIssueReporter';
import { useChatStore } from '../../stores/chatStore';
import './ChatLayout.css';

import { logger } from '../../utils/logger';

interface ChatLayoutProps {
  className?: string;
  children?: React.ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ className, children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);  // 移动端响应式标志
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // 从 localStorage 读取初始状态
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored ? JSON.parse(stored) : false;
  });


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

  const handleSidebarCollapse = (newState: boolean) => {
    logger.debug(`Toggle sidebar collapse: ${newState}`);
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  // 计算侧边栏宽度（支持收缩）
  // 调整宽度：从 280px 缩小到 240px，更符合现代审美
  const sidebarWidth = sidebarCollapsed ? 60 : 280;
  const contentMarginLeft = collapsed ? 0 : sidebarWidth;

  return (
    <Layout className={className} style={{ height: '100vh' }}>
      <Layout.Sider
        width={sidebarWidth}
        breakpoint="lg"
        collapsedWidth={0}
        onBreakpoint={(broken) => {
          setCollapsed(broken);
          // 在移动端时，重置侧边栏折叠状态
          if (broken) {
            setSidebarCollapsed(false);
          }
        }}
        theme="light" // 适配浅色侧边栏
        className="chat-layout-sider"
        style={{
          overflow: 'hidden', // ✅ 关键修复：改为 hidden 防止折叠时出现滚动条
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: '#f7f8fa', // 适配现代极简风
          borderRight: 'none', // 无边框设计
          transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={handleSidebarCollapse} />
      </Layout.Sider>

      <Layout className="chat-layout-main" style={{ marginLeft: collapsed ? 0 : contentMarginLeft, transition: 'margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {/* 移动端菜单按钮 - 浮动显示 */}
        {collapsed && (
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setSidebarVisible(true)}
              size="large"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            />
          </div>
        )}

        {/* 主内容区域 */}
        <Layout.Content style={{ position: 'relative', height: '100vh' }}>
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
          body: { padding: 0, backgroundColor: '#f7f8fa' }, // 适配现代极简风
          header: { backgroundColor: '#f7f8fa', borderBottom: 'none' } // 无边框
        }}
      >
        <Sidebar isCollapsed={false} />
      </Drawer>
    </Layout>
  );
};
