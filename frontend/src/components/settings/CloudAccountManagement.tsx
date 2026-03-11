import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Typography, Space, Button, Segmented } from 'antd';
import { CloudOutlined, GoogleOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { AccountManagement } from '../common/AccountManagement';
import { GCPAccountManagement } from '../gcp/GCPAccountManagement';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';

import { logger } from '../../utils/logger';

const { Title, Text } = Typography;

type CloudProvider = 'aws' | 'gcp' | 'azure';

interface CloudProviderInfo {
  key: CloudProvider;
  name: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  disabled?: boolean;
  description: string;
}

export const CloudAccountManagement: React.FC = () => {
  const navigate = useNavigate();
  const awsAccounts = useAccountStore(state => state.accounts);
  const gcpAccounts = useGCPAccountStore(state => state.accounts);
  const { t } = useI18n(['account', 'common']);
  const isMobile = useIsMobile();

  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('aws');

  // 组件挂载时获取账号数量
  useEffect(() => {
    // ✅ 优化：顺序加载而非并行加载，减少并发请求压力
    const loadAccounts = async () => {
      try {
        // 先加载 AWS 账号
        await useAccountStore.getState().fetchAccounts();
        // AWS 账号加载完成后再加载 GCP 账号
        await useGCPAccountStore.getState().fetchAccounts();
      } catch (error) {
        logger.error('加载账号失败:', error);
        // 即使失败也继续，UI会显示错误状态
      }
    };

    loadAccounts();
  }, []);

  const providers: CloudProviderInfo[] = [
    {
      key: 'aws',
      name: 'AWS',
      icon: <CloudOutlined style={{ fontSize: '32px', color: '#FF9900' }} />,
      color: '#FF9900',
      count: awsAccounts.length,
      description: t('aws.description')
    },
    {
      key: 'gcp',
      name: 'GCP',
      icon: <GoogleOutlined style={{ fontSize: '32px', color: '#4285F4' }} />,
      color: '#4285F4',
      count: gcpAccounts.length,
      description: t('gcp.description')
    },
    {
      key: 'azure',
      name: 'Azure',
      icon: <CloudOutlined style={{ fontSize: '32px', color: '#ccc' }} />,
      color: '#0078D4',
      count: 0,
      disabled: true,
      description: 'Microsoft Azure (Coming Soon)'
    }
  ];

  const renderProviderCard = (provider: CloudProviderInfo) => {
    const isSelected = selectedProvider === provider.key;
    const isDisabled = provider.disabled;

    return (
      <Card
        key={provider.key}
        hoverable={!isDisabled}
        onClick={() => !isDisabled && setSelectedProvider(provider.key)}
        style={{
          marginBottom: 16,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          borderColor: isSelected ? provider.color : undefined,
          borderWidth: isSelected ? 2 : 1,
          backgroundColor: isSelected ? `${provider.color}0a` : undefined,
          position: 'relative',
          opacity: isDisabled ? 0.6 : 1
        }}
        styles={{ body: { padding: '20px' } }}
      >
        {/* 选中角标 */}
        {isSelected && !isDisabled && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 40px 40px 0',
              borderColor: `transparent ${provider.color} transparent transparent`
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                right: -38,
                color: 'white',
                fontSize: '16px'
              }}
            >
              ✓
            </div>
          </div>
        )}

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {provider.icon}
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: isDisabled ? '#999' : '#262626'
                }}>
                  {provider.name}
                  {isDisabled && (
                    <LockOutlined style={{ fontSize: '14px', marginLeft: '8px', color: '#999' }} />
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {provider.description}
                </Text>
              </div>
            </div>
            <Badge
              count={provider.count}
              showZero
              style={{
                backgroundColor: isDisabled ? '#d9d9d9' : provider.color
              }}
            />
          </div>
        </Space>
      </Card>
    );
  };

  const renderContent = () => {
    switch (selectedProvider) {
      case 'aws':
        return <AccountManagement />;
      case 'gcp':
        return <GCPAccountManagement />;
      case 'azure':
        return (
          <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
            <CloudOutlined style={{ fontSize: '64px', color: '#d9d9d9', marginBottom: '16px' }} />
            <Title level={4} type="secondary">Azure 账号管理</Title>
            <Text type="secondary">功能开发中，敬请期待...</Text>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      padding: isMobile ? 0 : '24px',
      minHeight: '100vh',
      maxHeight: '100vh',
      overflow: isMobile ? 'hidden' : 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {isMobile ? (
        /* ========== 移动端布局 ========== */
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5', overflow: 'hidden' }}>
          {/* 顶部栏 */}
          <div style={{
            flexShrink: 0,
            background: 'linear-gradient(to bottom, #ffffff, #fafbfc)',
            boxShadow: '0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 8px' }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/')}
                type="text"
                size="small"
                style={{ color: '#344054', width: 32, height: 32, borderRadius: 8 }}
              />
              <span style={{ fontSize: 17, fontWeight: 700, color: '#101828', letterSpacing: '-0.01em' }}>
                {t('management.title')}
              </span>
            </div>
            <div style={{ padding: '0 16px 12px' }}>
              <Segmented
                options={providers.filter(p => !p.disabled).map(p => ({
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '2px 0' }}>
                      {React.cloneElement(p.icon as React.ReactElement, {
                        style: { fontSize: '15px', color: (p.icon as React.ReactElement).props.style?.color }
                      })}
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.35)', fontWeight: 400 }}>{p.count}</span>
                    </div>
                  ),
                  value: p.key,
                }))}
                value={selectedProvider}
                onChange={(v) => setSelectedProvider(v as CloudProvider)}
                block
              />
            </div>
          </div>
          {/* 内容区 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
            {renderContent()}
          </div>
        </div>
      ) : (
        /* ========== 桌面端布局（保持不变） ========== */
        <div style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* 返回按钮 */}
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
              type="text"
            >
              {t('common:button.back')}
            </Button>
          </div>

          {/* 标题 */}
          <Title level={3} style={{ marginBottom: -8 }}>{t('management.title')}</Title>

          {/* 主内容区域 */}
          <Row gutter={24}>
            {/* 左侧：云厂商选择 */}
            <Col xs={24} sm={24} md={8} lg={6} xl={6}>
              <div style={{
                position: 'sticky',
                top: 24,
                maxHeight: 'calc(100vh - 200px)',
                overflow: 'auto'
              }}>
                <Title level={5} style={{ marginBottom: 16 }}>{t('management.selectProvider')}</Title>
                {providers.map(provider => renderProviderCard(provider))}
              </div>
            </Col>

            {/* 右侧：账号列表 */}
            <Col xs={24} sm={24} md={16} lg={18} xl={18}>
              <div style={{
                maxHeight: 'calc(100vh - 200px)',
                overflow: 'auto'
              }}>
                {renderContent()}
              </div>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};
