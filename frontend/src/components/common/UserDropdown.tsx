import React, { useCallback } from 'react';
import { Dropdown, Avatar, Space, Typography, App } from 'antd';
import { UserOutlined, DownOutlined, IdcardOutlined, LockOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';

import { logger } from '../../utils/logger';

const { Text } = Typography;

export const UserDropdown: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t } = useI18n('user');
  const { message } = App.useApp();

  // 使用真实用户信息
  const userInfo = {
    name: user?.full_name || user?.username || '用户',
    username: user?.username || '',
    role: user?.role || 'user',
    avatar: undefined // 暂时没有头像
  };

  const handleLogout = useCallback(() => {
    logger.debug('🔴 handleLogout 被调用');

    // ✅ 登出时不清空聊天记录，让它保留在localStorage中
    // chatStore会在登录时自动加载对应用户的数据
    logout();
    message.success(t('message.logoutSuccess'));
    navigate('/login');
  }, [logout, navigate, t, message]);

  const handleMenuClick: MenuProps['onClick'] = useCallback(({ key }: { key: string }) => {
    logger.debug('🔵 菜单点击:', key);
    switch (key) {
      case 'profile':
        navigate('/user/profile');
        break;
      case 'change-password':
        navigate('/user/change-password');
        break;
      case 'logout':
        handleLogout();
        break;
    }
  }, [navigate, handleLogout]);

  const menuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 0', minWidth: '240px' }}>
          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar size={48} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#262626' }}>
                  {userInfo.name}
                </div>
                <div style={{ fontSize: '13px', color: '#8c8c8c', marginTop: '2px' }}>
                  @{userInfo.username}
                  {userInfo.role === 'admin' && (
                    <span style={{ marginLeft: '8px', color: '#ff4d4f', fontSize: '12px' }}>
                      {t('dropdown.admin')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Space>
        </div>
      ),
      disabled: true,
      style: { cursor: 'default' }
    },
    {
      type: 'divider'
    },
    {
      key: 'profile',
      icon: <IdcardOutlined />,
      label: t('dropdown.profile'),
    },
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: t('dropdown.changePassword'),
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('dropdown.logout'),
      danger: true,
    }
  ];

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleMenuClick }}
      trigger={['click']}
      placement="bottomRight"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          padding: '4px 12px',
          borderRadius: '20px',
          transition: 'background-color 0.3s',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
        <Text style={{ fontSize: '14px', fontWeight: 500 }}>{userInfo.name}</Text>
        <DownOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
      </div>
    </Dropdown>
  );
};
