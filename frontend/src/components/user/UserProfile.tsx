import React from 'react';
import { Card, Descriptions, Avatar, Space, Typography, Button, Tag } from 'antd';
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';

const { Title } = Typography;

export const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { t } = useI18n(['user', 'common']);

  // 使用真实用户信息
  const userInfo = {
    username: user?.username || '',
    fullName: user?.full_name || '',
    role: user?.role || '',
    orgName: organization?.name || '',
    isActive: user?.is_active || false,
    createdAt: user?.created_at || '',
    lastLoginAt: user?.last_login_at || '',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          type="text"
        >
          {t('common:button.back')}
        </Button>

        {/* 标题 */}
        <Title level={3}>{t('profile.title')}</Title>

        {/* 用户信息卡片 */}
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 头像和名称 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <div>
                <Space>
                  <Title level={4} style={{ margin: 0 }}>
                    {userInfo.fullName || userInfo.username}
                  </Title>
                  <Tag color={userInfo.role === 'admin' ? 'red' : 'blue'}>
                    {userInfo.role === 'admin' ? t('common:role.admin') : t('common:role.user')}
                  </Tag>
                  <Tag color={userInfo.isActive ? 'green' : 'default'}>
                    {userInfo.isActive ? t('common:status.active') : t('common:status.inactive')}
                  </Tag>
                </Space>
                <div style={{ color: '#8c8c8c', marginTop: '4px' }}>@{userInfo.username}</div>
              </div>
            </div>

            {/* 详细信息 */}
            <Descriptions
              bordered
              column={2}
              labelStyle={{ width: '150px', fontWeight: 500 }}
            >
              <Descriptions.Item label={t('profile.username')}>{userInfo.username}</Descriptions.Item>
              <Descriptions.Item label={t('profile.fullName')}>{userInfo.fullName || t('profile.noValue')}</Descriptions.Item>
              <Descriptions.Item label={t('profile.organization')}>{userInfo.orgName}</Descriptions.Item>
              <Descriptions.Item label={t('profile.role')}>
                <Tag color={userInfo.role === 'admin' ? 'red' : 'blue'}>
                  {userInfo.role === 'admin' ? t('common:role.admin') : t('common:role.user')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.accountStatus')}>
                <Tag color={userInfo.isActive ? 'green' : 'default'}>
                  {userInfo.isActive ? t('common:status.active') : t('common:status.inactive')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.createdAt')}>
                {userInfo.createdAt ? new Date(userInfo.createdAt).toLocaleString() : t('profile.noValue')}
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.lastLoginAt')} span={2}>
                {userInfo.lastLoginAt ? new Date(userInfo.lastLoginAt).toLocaleString() : t('profile.neverLogin')}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Card>
      </Space>
    </div>
  );
};
