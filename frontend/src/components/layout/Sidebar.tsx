// Sidebar component - Chat history and navigation
import React, { type FC, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Typography, Button, Menu, Badge, Space, Divider } from 'antd';
import {
  PlusOutlined,
  CloudOutlined,
  SettingOutlined,
  TeamOutlined,
  BellOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import type { MenuProps, MenuInfo } from 'antd/es/menu/menu';
import { ChatHistory } from '../sidebar/ChatHistory';
import { useChatStore } from '../../stores/chatStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import '../../styles/sidebar.css';

import { logger } from '../../utils/logger';

const { Title } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

export const Sidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const createNewChat = useChatStore(state => state.createNewChat);
  const isAdmin = useAuthStore(state => state.isAdmin);
  const isSuperAdmin = useAuthStore(state => state.isSuperAdmin);
  const { t } = useI18n(['chat', 'common']);

  // 获取账号数量
  const awsAccounts = useAccountStore(state => state.accounts);
  const gcpAccounts = useGCPAccountStore(state => state.accounts);

  // 使用 state 管理展开的菜单键（默认折叠）
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

  // ✅ 移除 Sidebar 中的账号加载调用
  // AccountSelector 和 GCPAccountSelector 会在挂载时自动加载，避免重复调用

  // 智能展开：当访问设置相关页面时，自动展开设置菜单
  useEffect(() => {
    if (location.pathname.startsWith('/settings/')) {
      setOpenKeys(['settings']);
    } else if (location.pathname.startsWith('/ops/')) {
      setOpenKeys(['ops']);
    }
  }, [location.pathname]);

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

  // 计算总账号数
  const totalAccounts = awsAccounts.length + gcpAccounts.length;

  // 菜单点击事件处理器类型
  type MenuItemClickHandler = (e: MenuInfo) => void;

  // 设置菜单项（根据用户角色动态构建）
  const buildSettingsMenu = (): MenuItem[] => {
    const children: MenuItem[] = [];

    // 管理员专属菜单项
    if (isAdmin()) {
      children.push({
        key: 'cloud-accounts',
        icon: <CloudOutlined />,
        label: (
          <Space>
            <span>{t('chat:sidebar.cloudAccounts')}</span>
            {totalAccounts > 0 && (
              <Badge
                count={totalAccounts}
                style={{ backgroundColor: '#52c41a' }}
              />
            )}
          </Space>
        ),
        onClick: ((e: MenuInfo) => {
          e.domEvent.stopPropagation();
          navigate('/settings/cloud-accounts');
        }) as MenuItemClickHandler
      });

      children.push({
        key: 'user-management',
        icon: <TeamOutlined />,
        label: t('chat:sidebar.userManagement'),
        onClick: ((e: MenuInfo) => {
          e.domEvent.stopPropagation();
          navigate('/settings/users');
        }) as MenuItemClickHandler
      });
    }

    // 所有用户都可以访问的菜单项
    children.push({
      key: 'alert-management',
      icon: <BellOutlined />,
      label: '告警管理',
      onClick: ((e: MenuInfo) => {
        e.domEvent.stopPropagation();
        navigate('/settings/alerts');
      }) as MenuItemClickHandler
    });

    return [
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: t('chat:sidebar.settings'),
        children
      }
    ];
  };

  // 构建运营后台菜单（仅超级管理员可见）
  const buildOpsMenu = (): MenuItem[] => {
    if (!isSuperAdmin()) return [];

    return [
      {
        key: 'ops',
        icon: <ControlOutlined />,
        label: '运营后台',
        children: [
          {
            key: 'ops-dashboard',
            icon: <DashboardOutlined />,
            label: '运营 Dashboard',
            onClick: ((e: MenuInfo) => {
              e.domEvent.stopPropagation();
              navigate('/ops/dashboard');
            }) as MenuItemClickHandler
          },
          {
            key: 'ops-tenants',
            icon: <TeamOutlined />,
            label: '租户管理',
            onClick: ((e: MenuInfo) => {
              e.domEvent.stopPropagation();
              navigate('/ops/tenants');
            }) as MenuItemClickHandler
          },
          {
            key: 'ops-audit-logs',
            icon: <FileSearchOutlined />,
            label: '审计日志',
            onClick: ((e: MenuInfo) => {
              e.domEvent.stopPropagation();
              navigate('/ops/audit-logs');
            }) as MenuItemClickHandler
          },
        ],
      }
    ];
  };

  const menuItems: MenuItem[] = [...buildSettingsMenu(), ...buildOpsMenu()];

  const getSelectedKey = () => {
    if (location.pathname.includes('/settings/cloud-accounts')) return 'cloud-accounts';
    if (location.pathname.includes('/settings/users')) return 'user-management';
    if (location.pathname.includes('/settings/alerts')) return 'alert-management';
    if (location.pathname.startsWith('/ops/dashboard')) return 'ops-dashboard';
    if (location.pathname.startsWith('/ops/tenants')) return 'ops-tenants';
    if (location.pathname.startsWith('/ops/audit-logs')) return 'ops-audit-logs';
    return '';
  };

  return (
    <div className="sidebar-container">
      {/* 顶部标题和 Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          ☁️
        </div>
        <Title level={4} className="sidebar-title">
          {t('chat:sidebar.title')}
        </Title>
      </div>

      {/* 新建对话按钮 */}
      <div className="sidebar-new-chat-wrapper">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={handleNewChat}
          className="sidebar-new-chat-button"
        >
          {t('chat:sidebar.newChat')}
        </Button>
      </div>

      <Divider className="sidebar-divider" />

      {/* 对话历史 - 占据剩余空间 */}
      <div className="sidebar-history-wrapper">
        <div className="sidebar-scrollable">
          <ChatHistory />
        </div>
      </div>

      <Divider className="sidebar-divider-bottom" />

      {/* 设置菜单 - 固定在底部 */}
      <div className="sidebar-menu-wrapper">
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[getSelectedKey()]}
          openKeys={openKeys}
          onOpenChange={(keys) => {
            // 更新展开的菜单键
            setOpenKeys(keys);
          }}
          items={menuItems}
          className="sidebar-menu"
        />
      </div>
    </div>
  );
};
