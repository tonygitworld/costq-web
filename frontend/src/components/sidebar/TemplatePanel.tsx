/**
 * TemplatePanel — 侧边栏提示词模板按钮
 *
 * 复用 sidebar-alert-button 样式，和告警管理按钮完全一致
 */
import React from 'react';
import { Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n';

interface TemplatePanelProps {
  compact?: boolean;
  onNavigate?: () => void;
}

export const TemplatePanel: React.FC<TemplatePanelProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { t } = useI18n('chat');

  const handleClick = () => {
    navigate('/settings/templates');
    onNavigate?.();
  };

  return (
    <div className="sidebar-alert-wrapper">
      <Button
        type="default"
        icon={<FileTextOutlined />}
        block
        onClick={handleClick}
        className="sidebar-alert-button"
      >
        {t('templatePanel.title')}
      </Button>
    </div>
  );
};
