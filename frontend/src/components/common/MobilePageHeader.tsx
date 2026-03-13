import React from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

interface MobilePageHeaderProps {
  title: React.ReactNode;
  onBack: () => void;
  /** 标题右侧的额外内容（如操作按钮） */
  extra?: React.ReactNode;
  /** 标题下方的额外内容（如 Segmented 切换器） */
  children?: React.ReactNode;
}

/**
 * 移动端统一顶部栏组件
 * 白色渐变背景 + 阴影 + 返回按钮 + 标题
 */
export const MobilePageHeader: React.FC<MobilePageHeaderProps> = ({
  title,
  onBack,
  extra,
  children,
}) => {
  return (
    <div style={{
      flexShrink: 0,
      background: 'linear-gradient(to bottom, #ffffff, #fafbfc)',
      boxShadow: '0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)',
      zIndex: 10,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        gap: 4,
      }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          type="text"
          size="small"
          style={{ color: '#344054', width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}
        />
        <span style={{
          fontSize: 17,
          fontWeight: 700,
          color: '#101828',
          letterSpacing: '-0.01em',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        {extra && (
          <div style={{ flexShrink: 0 }}>
            {extra}
          </div>
        )}
      </div>
      {children && (
        <div style={{ padding: '0 16px 12px' }}>
          {children}
        </div>
      )}
    </div>
  );
};
