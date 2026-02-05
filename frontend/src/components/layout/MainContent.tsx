// MainContent component - Main chat area
import React from 'react';
import { Layout } from 'antd';
import { useNavigate } from 'react-router-dom';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { WelcomeScreen } from '../chat/WelcomeScreen';
import { LoadingScreen } from '../chat/LoadingScreen';
import { useChatStore } from '../../stores/chatStore';
import './MainContent.css';

export const MainContent: React.FC = () => {
  const navigate = useNavigate();
  const { currentChatId, messages, isLoadingMessages } = useChatStore();

  // 判断是否是新对话（无消息）
  // 逻辑：没有当前会话ID，或者当前会话ID对应的消息列表为空
  const isNewChat = !currentChatId || (messages[currentChatId]?.length || 0) === 0;

  const handleConfigureAws = () => {
    navigate('/settings/accounts?tab=aws');
  };

  const handleConfigureGcp = () => {
    navigate('/settings/accounts?tab=gcp');
  };

  // ✅ 只有在新对话且非加载状态下，才启用欢迎模式（居中布局）
  const isWelcomeMode = isNewChat && !isLoadingMessages;

  // 渲染中间内容区域
  const renderMessageArea = () => {
    if (isLoadingMessages) {
      return <LoadingScreen />;
    }

    if (isNewChat) {
      return (
        <WelcomeScreen
          onConfigureAws={handleConfigureAws}
          onConfigureGcp={handleConfigureGcp}
        />
      );
    }

    return <MessageList />;
  };

  return (
    <Layout.Content className={`main-content-container ${isWelcomeMode ? 'welcome-mode' : ''}`}>
      {/* 消息展示区域：根据状态切换 LoadingScreen, WelcomeScreen 或 MessageList */}
      <div className="main-content-message-area">
        {renderMessageArea()}
      </div>

      {/* 输入框区域：始终显示在底部 */}
      <div className="main-content-input-area">
        <MessageInput />
      </div>
    </Layout.Content>
  );
};
