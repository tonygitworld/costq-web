/**
 * LoadingIndicator - 加载状态指示器
 *
 * 功能：
 * - 显示处理复杂交互时的加载状态
 * - 提供视觉反馈
 * - 支持不同的加载样式
 */

import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingIndicatorProps {
  loading: boolean;
  text?: string;
  size?: 'small' | 'default' | 'large';
  overlay?: boolean;
  children?: React.ReactNode;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  loading,
  text = '处理中...',
  size = 'default',
  overlay = false,
  children
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: size === 'small' ? 14 : size === 'large' ? 24 : 18 }} spin />;

  if (overlay) {
    return (
      <div style={{ position: 'relative' }}>
        {children}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(2px)'
            }}
          >
            <Spin indicator={antIcon} tip={text} />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <Spin indicator={antIcon} tip={text} />;
  }

  return <>{children}</>;
};
