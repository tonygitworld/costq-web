import React from 'react';
import { Card, Descriptions, Avatar, Space, Typography, Button, Tag } from 'antd';
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { MobilePageHeader } from '../common/MobilePageHeader';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';

const { Title } = Typography;

export const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { t } = useI18n(['user', 'common']);
  const isMobile = useIsMobile();

  // 处理返回按钮
  const handleBack = () => {
    if (isMobile) {
      // 手机端：返回到设置页面
      navigate('/settings', { replace: true });
    } else {
      // 桌面端：返回到历史记录或首页
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
  };

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

  // 个人信息字段列表（移动端复用）
  const profileFields = [
    { label: t('profile.username'), value: userInfo.username },
    { label: t('profile.fullName'), value: userInfo.fullName || t('profile.noValue') },
    { label: t('profile.organization'), value: userInfo.orgName },
    {
      label: t('profile.role'),
      node: (
        <Tag color={userInfo.role === 'admin' ? 'red' : 'blue'}>
          {userInfo.role === 'admin' ? t('common:role.admin') : t('common:role.user')}
        </Tag>
      ),
    },
    {
      label: t('profile.accountStatus'),
      node: (
        <Tag color={userInfo.isActive ? 'green' : 'default'}>
          {userInfo.isActive ? t('common:status.active') : t('common:status.inactive')}
        </Tag>
      ),
    },
    {
      label: t('profile.createdAt'),
      value: userInfo.createdAt ? new Date(userInfo.createdAt).toLocaleString() : t('profile.noValue'),
    },
    {
      label: t('profile.lastLoginAt'),
      value: userInfo.lastLoginAt ? new Date(userInfo.lastLoginAt).toLocaleString() : t('profile.neverLogin'),
    },
  ];

  // ========== 移动端布局 ==========
  if (isMobile) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
      }}>
        {/* 顶部栏 */}
        <MobilePageHeader title={t('profile.title')} onBack={handleBack} />

        {/* 可滚动内容 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          {/* 头像卡片 */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #eaecf0',
            boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
            padding: '20px 16px',
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}>
            <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#101828' }}>
                {userInfo.fullName || userInfo.username}
              </div>
              <div style={{ color: '#667085', fontSize: 13, marginTop: 2 }}>@{userInfo.username}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Tag color={userInfo.role === 'admin' ? 'red' : 'blue'}>
                {userInfo.role === 'admin' ? t('common:role.admin') : t('common:role.user')}
              </Tag>
              <Tag color={userInfo.isActive ? 'green' : 'default'}>
                {userInfo.isActive ? t('common:status.active') : t('common:status.inactive')}
              </Tag>
            </div>
          </div>

          {/* 详细信息 */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #eaecf0',
            boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
            padding: '4px 16px',
          }}>
            {profileFields.map((item, idx) => (
              <div key={item.label} style={{
                padding: '12px 0',
                borderBottom: idx < profileFields.length - 1 ? '1px solid #f2f4f7' : 'none',
              }}>
                <div style={{ color: '#667085', fontSize: 12, marginBottom: 3 }}>{item.label}</div>
                <div style={{ color: '#344054', fontSize: 14 }}>
                  {'node' in item ? item.node : (item.value || '-')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ========== 桌面端布局（保持不变） ==========
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
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
