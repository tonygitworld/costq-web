import React, { useMemo } from 'react';
import { useI18n } from '../../hooks/useI18n';
import './WelcomeScreen.css';

export const WelcomeScreen: React.FC = () => {
  const { isZhCN } = useI18n();

  // 问候语
  const greeting = useMemo(() => {
    if (isZhCN()) {
      return "今天有什么可以帮您？";
    }
    return "How can I help you today?";
  }, [isZhCN]);

  return (
    <div className="welcome-screen-container">
      {/* 图标与文字 */}
      <div className="welcome-header-row">
        <h1 className="welcome-title-serif">{greeting}</h1>
      </div>
    </div>
  );
};
