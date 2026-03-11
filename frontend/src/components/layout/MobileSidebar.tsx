import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import {
  CloseOutlined,
  BellOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { ChatHistory } from '../sidebar/ChatHistory';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import './MobileSidebar.css';

import { logger } from '../../utils/logger';

export interface MobileSidebarProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const MobileSidebar: FC<MobileSidebarProps> = ({ visible, onClose, onOpenSettings }) => {
  const navigate = useNavigate();
  const { t } = useI18n(['chat', 'common']);

  const handleNewChat = () => {
    const oldChatId = useChatStore.getState().currentChatId;
    logger.debug(`🆕 [MobileSidebar] 开始新对话，清除旧会话: ${oldChatId}`);
    useChatStore.setState({ currentChatId: null });
    navigate('/', { replace: true });
    onClose();
  };

  const handleAlerts = () => {
    navigate('/settings/alerts');
    onClose();
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`mobile-sidebar-overlay${visible ? ' mobile-sidebar-visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 侧边栏面板 */}
      <div className={`mobile-sidebar-panel${visible ? ' mobile-sidebar-visible' : ''}`}>
        {/* 顶部区域：Logo + 关闭按钮 */}
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-logo">
            <span className="mobile-sidebar-logo-icon">☁️</span>
            <span className="mobile-sidebar-logo-title">CostQ</span>
          </div>
          <button
            className="mobile-sidebar-close-btn"
            onClick={onClose}
            aria-label="关闭侧边栏"
          >
            <CloseOutlined style={{ fontSize: '18px' }} />
          </button>
        </div>

        {/* 新建对话按钮 */}
        <div className="mobile-sidebar-new-chat">
          <Button
            type="primary"
            icon={
              <span className="anticon" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 0.599609C3.91309 0.599609 0.599609 3.91309 0.599609 8C0.599609 9.13376 0.855461 10.2098 1.3125 11.1719L1.5918 11.7588L2.76562 11.2012L2.48633 10.6143C2.11034 9.82278 1.90039 8.93675 1.90039 8C1.90039 4.63106 4.63106 1.90039 8 1.90039C11.3689 1.90039 14.0996 4.63106 14.0996 8C14.0996 11.3689 11.3689 14.0996 8 14.0996C7.31041 14.0996 6.80528 14.0514 6.35742 13.9277C5.91623 13.8059 5.49768 13.6021 4.99707 13.2529C4.26492 12.7422 3.21611 12.5616 2.35156 13.1074L2.33789 13.1162L2.32422 13.126L1.58789 13.6436L2.01953 14.9297L3.0459 14.207C3.36351 14.0065 3.83838 14.0294 4.25293 14.3184C4.84547 14.7317 5.39743 15.011 6.01172 15.1807C6.61947 15.3485 7.25549 15.4004 8 15.4004C12.0869 15.4004 15.4004 12.0869 15.4004 8C15.4004 3.91309 12.0869 0.599609 8 0.599609ZM7.34473 4.93945V7.34961H4.93945V8.65039H7.34473V11.0605H8.64551V8.65039H11.0605V7.34961H8.64551V4.93945H7.34473Z" fill="currentColor"></path>
                </svg>
              </span>
            }
            block
            onClick={handleNewChat}
            className="sidebar-new-chat-button"
          >
            {t('chat:sidebar.newChat')}
          </Button>
        </div>

        {/* 告警管理按钮 */}
        <div className="mobile-sidebar-alert">
          <Button
            type="default"
            icon={<BellOutlined />}
            block
            onClick={handleAlerts}
            className="sidebar-alert-button"
          >
            {t('chat:sidebar.alertManagement')}
          </Button>
        </div>

        {/* 分隔线 */}
        <div className="mobile-sidebar-divider" />

        {/* ChatHistory 列表 */}
        <div className="mobile-sidebar-history" onClick={onClose}>
          <ChatHistory />
        </div>

        {/* 底部分隔线 */}
        <div className="mobile-sidebar-divider-bottom" />

        {/* 底部设置入口 */}
        <div className="mobile-sidebar-settings">
          <button
            className="mobile-sidebar-settings-btn"
            onClick={onOpenSettings}
          >
            <SettingOutlined style={{ fontSize: '18px' }} />
            <span>{t('chat:sidebar.settings')}</span>
          </button>
        </div>
      </div>
    </>
  );
};
