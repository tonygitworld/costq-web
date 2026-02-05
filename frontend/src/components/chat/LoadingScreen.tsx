import React from 'react';
import './LoadingScreen.css';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-screen-container">
      {/* 模拟一条用户发送的消息（右侧） */}
      <div className="skeleton skeleton-user-message" />

      {/* 模拟 AI 正在生成的回复（多行文本） */}
      <div className="skeleton-ai-response">
        <div className="skeleton skeleton-text-line" />
        <div className="skeleton skeleton-text-line" />
        <div className="skeleton skeleton-text-line" />
        <div className="skeleton skeleton-text-line" />
        <div className="skeleton skeleton-text-line" />
        <div className="skeleton skeleton-text-line" />
      </div>
    </div>
  );
};
