/**
 * MessageInputContainer - 消息输入框容器组件（简化版）
 *
 * 功能：
 * - 封装输入框焦点管理
 * - 防止焦点变化导致的页面跳转
 * - 提供稳定的用户交互体验
 */

import React, { useRef, useCallback } from 'react';
import { FocusManager } from '../common/FocusManager';

interface MessageInputContainerProps {
  children: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  preventScrollJump?: boolean;
  debugMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MessageInputContainer: React.FC<MessageInputContainerProps> = ({
  children,
  onFocus,
  onBlur,
  preventScrollJump = true,
  className = 'message-input-container',
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 焦点变化处理
  const handleFocusChange = useCallback((focused: boolean) => {
    if (focused) {
      onFocus?.();
    } else {
      onBlur?.();
    }
  }, [onFocus, onBlur]);

  // 简化的容器样式
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    ...style
  };

  return (
    <div className={className} style={containerStyle}>
      <FocusManager
        onFocusChange={handleFocusChange}
        preventScrollOnFocus={preventScrollJump}
        smoothTransition={true}
      >
        <div
          ref={containerRef}
          data-input-container="true"
        >
          {children}
        </div>
      </FocusManager>
    </div>
  );
};
