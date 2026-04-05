// MainContent component - Main chat area
import React, { useCallback } from 'react';
import { Layout } from 'antd';
import { useNavigate } from 'react-router-dom';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { WelcomeScreen } from '../chat/WelcomeScreen';
import { LoadingScreen } from '../chat/LoadingScreen';
import { NoAccountScreen } from '../chat/NoAccountScreen';
import { useChatStore } from '../../stores/chatStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { PinnedTemplates } from '../chat/PinnedTemplates';
import './MainContent.css';

export const MainContent: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentChatId, messages, isLoadingMessages } = useChatStore();
  const { accounts: awsAccounts, loading: awsLoading } = useAccountStore();
  const { accounts: gcpAccounts, loading: gcpLoading } = useGCPAccountStore();

  const isNewChat = !currentChatId || (messages[currentChatId]?.length || 0) === 0;
  const isLoadingAccounts = awsLoading || gcpLoading;
  const hasCloudAccounts = awsAccounts.length > 0 || gcpAccounts.length > 0;
  const isWelcomeMode = isNewChat && !isLoadingMessages;

  const handleConfigureAws = () => navigate('/settings/accounts?tab=aws');

  // 快捷问题点击：填入输入框并发送
  const handleQuickQuestion = useCallback((question: string) => {
    // 通过自定义事件传递给 MessageInput
    window.dispatchEvent(new CustomEvent('quick-question', { detail: question }));
  }, []);

  const renderMessageArea = () => {
    if (isLoadingMessages) return <LoadingScreen />;
    if (isNewChat) return <WelcomeScreen onQuickQuestion={handleQuickQuestion} />;
    return <MessageList />;
  };

  // 无云账号
  if (!isLoadingAccounts && !hasCloudAccounts) {
    return (
      <Layout.Content className="main-content-container welcome-mode">
        <div className="main-content-message-area">
          <NoAccountScreen onConfigure={handleConfigureAws} />
        </div>
      </Layout.Content>
    );
  }

  // ===== 移动端：完全不同的布局 =====
  if (isMobile) {
    return (
      <Layout.Content className="main-content-mobile">
        {/* 消息/欢迎区域：可滚动 */}
        <div className={`mobile-message-area${isWelcomeMode ? ' mobile-welcome-mode' : ''}`}>
          {renderMessageArea()}
        </div>

        {/* 输入框：固定底部 */}
        <div className="mobile-input-area">
          <MessageInput />
        </div>
      </Layout.Content>
    );
  }

  // ===== 桌面端：保持原有布局 =====
  // 固定模板位置：新对话显示在输入框下方，已有对话或加载中显示在上方
  const pinnedPosition = isNewChat && !isLoadingMessages ? 'below' : 'above';

  return (
    <Layout.Content className={`main-content-container ${isWelcomeMode ? 'welcome-mode' : ''}`}>
      <div className="main-content-message-area">
        {renderMessageArea()}
      </div>
      <div className="main-content-input-area">
        {pinnedPosition === 'above' && <PinnedTemplates position="above" />}
        <MessageInput />
        {pinnedPosition === 'below' && <PinnedTemplates position="below" />}
      </div>
    </Layout.Content>
  );
};
