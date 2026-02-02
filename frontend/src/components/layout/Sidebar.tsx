// Sidebar component - Chat history and navigation
import React, { type FC, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Typography, Button, Divider } from 'antd';
import {
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { ChatHistory } from '../sidebar/ChatHistory';
import { SettingsMenu } from '../sidebar/SettingsMenu';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import '../../styles/sidebar.css';

import { logger } from '../../utils/logger';

const { Title } = Typography;

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export const Sidebar: FC<SidebarProps> = ({ isCollapsed = false, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const createNewChat = useChatStore(state => state.createNewChat);
  const { t } = useI18n(['chat', 'common']);

  // ✅ 移除 Sidebar 中的账号加载调用
  // AccountSelector 和 GCPAccountSelector 会在挂载时自动加载，避免重复调用

  const handleNewChat = () => {
    const oldChatId = useChatStore.getState().currentChatId;

    // ✅ 第一步：先导航到主页，确保 URL 立即更新（避免 URL → Store 同步逻辑切换回旧会话）
    navigate('/', { replace: true });

    // ✅ 第二步：清除当前会话（在导航后，避免 URL 同步逻辑干扰）
    useChatStore.setState({ currentChatId: null });

    // ✅ 第三步：创建新对话（使用 setTimeout 确保导航和状态清除完成后再创建）
    // ✅ 使用较长的延迟，确保 URL 更新完成，避免 URL → Store 同步逻辑干扰
    setTimeout(() => {
      // ✅ 再次检查 URL，确保已经是主页
      if (location.pathname === '/') {
        const newChatId = createNewChat();
        logger.debug(`🆕 [Sidebar] 创建新会话: ${newChatId}，清除旧会话: ${oldChatId}，导航到主页（等待用户发送第一条消息）`);
      } else {
        logger.warn(`⚠️ [Sidebar] URL 还未更新到主页，延迟创建新会话: ${location.pathname}`);
        // 如果 URL 还没更新，再等一会儿
        setTimeout(() => {
          const newChatId = createNewChat();
          logger.debug(`🆕 [Sidebar] 延迟创建新会话: ${newChatId}，清除旧会话: ${oldChatId}`);
        }, 50);
      }
    }, 10);
  };

  const handleToggleCollapse = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newState = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse(newState);
    }
    // 保存到 localStorage
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  return (
    <div className={`sidebar-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 顶部标题和 Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          ☁️
        </div>
        {!isCollapsed && (
          <Title level={4} className="sidebar-title">
            {t('chat:sidebar.title')}
          </Title>
        )}
        {!isCollapsed && (
          <button
            type="button"
            className="sidebar-collapse-icon"
            onClick={handleToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <path d="M16.5 4C17.3284 4 18 4.67157 18 5.5V14.5C18 15.3284 17.3284 16 16.5 16H3.5C2.67157 16 2 15.3284 2 14.5V5.5C2 4.67157 2.67157 4 3.5 4H16.5ZM7 15H16.5C16.7761 15 17 14.7761 17 14.5V5.5C17 5.22386 16.7761 5 16.5 5H7V15ZM3.5 5C3.22386 5 3 5.22386 3 5.5V14.5C3 14.7761 3.22386 15 3.5 15H6V5H3.5Z"></path>
            </svg>
          </button>
        )}
      </div>

      {/* 折叠状态下的悬浮按钮 - 展开侧边栏 */}
      {isCollapsed && (
        <>
          <button
            type="button"
            className="sidebar-collapse-icon sidebar-collapse-floating"
            onClick={handleToggleCollapse}
            aria-label="Expand sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <path d="M16.5 4C17.3284 4 18 4.67157 18 5.5V14.5C18 15.3284 17.3284 16 16.5 16H3.5C2.67157 16 2 15.3284 2 14.5V5.5C2 4.67157 2.67157 4 3.5 4H16.5ZM7 15H16.5C16.7761 15 17 14.7761 17 14.5V5.5C17 5.22386 16.7761 5 16.5 5H7V15ZM3.5 5C3.22386 5 3 5.22386 3 5.5V14.5C3 14.7761 3.22386 15 3.5 15H6V5H3.5Z"></path>
            </svg>
          </button>

          {/* 折叠状态下的悬浮按钮 - 新建对话 (显示在展开按钮下方) */}
          <button
            type="button"
            className="sidebar-collapse-icon sidebar-collapse-floating sidebar-new-chat-floating"
            onClick={handleNewChat}
            aria-label="New chat"
            style={{ top: '56px' }} // 位于展开按钮下方 (12px + 34px + 10px 间距)
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M8 0.599609C3.91309 0.599609 0.599609 3.91309 0.599609 8C0.599609 9.13376 0.855461 10.2098 1.3125 11.1719L1.5918 11.7588L2.76562 11.2012L2.48633 10.6143C2.11034 9.82278 1.90039 8.93675 1.90039 8C1.90039 4.63106 4.63106 1.90039 8 1.90039C11.3689 1.90039 14.0996 4.63106 14.0996 8C14.0996 11.3689 11.3689 14.0996 8 14.0996C7.31041 14.0996 6.80528 14.0514 6.35742 13.9277C5.91623 13.8059 5.49768 13.6021 4.99707 13.2529C4.26492 12.7422 3.21611 12.5616 2.35156 13.1074L2.33789 13.1162L2.32422 13.126L1.58789 13.6436L2.01953 14.9297L3.0459 14.207C3.36351 14.0065 3.83838 14.0294 4.25293 14.3184C4.84547 14.7317 5.39743 15.011 6.01172 15.1807C6.61947 15.3485 7.25549 15.4004 8 15.4004C12.0869 15.4004 15.4004 12.0869 15.4004 8C15.4004 3.91309 12.0869 0.599609 8 0.599609ZM7.34473 4.93945V7.34961H4.93945V8.65039H7.34473V11.0605H8.64551V8.65039H11.0605V7.34961H8.64551V4.93945H7.34473Z" fill="currentColor"></path>
            </svg>
          </button>
        </>
      )}

      {/* 新建对话按钮 */}
      {!isCollapsed && (
        <>
          <div className="sidebar-new-chat-wrapper">
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

          <Divider className="sidebar-divider" />
        </>
      )}

      {/* 对话历史 - 占据剩余空间 */}
      {!isCollapsed && (
        <div className="sidebar-history-wrapper">
          <div className="sidebar-scrollable">
            <ChatHistory />
          </div>
        </div>
      )}

      {!isCollapsed && (
        <Divider className="sidebar-divider-bottom" />
      )}

      {/* 设置菜单 - 始终显示（在内部处理折叠状态） */}
      <div className={isCollapsed ? "sidebar-collapsed-settings" : "sidebar-menu-wrapper"}>
        <SettingsMenu isCollapsed={isCollapsed} />
      </div>
    </div>
  );
};
