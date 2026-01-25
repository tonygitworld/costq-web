// MainContent component - Main chat area
import React from 'react';
import { Layout } from 'antd';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import './MainContent.css';

export const MainContent: React.FC = () => {
  return (
    <Layout.Content className="main-content-container">
      {/* 消息列表区域 */}
      <div className="main-content-message-area">
        <MessageList />
      </div>

      {/* 输入框区域 */}
      <div className="main-content-input-area">
        <MessageInput />
      </div>
    </Layout.Content>
  );
};
