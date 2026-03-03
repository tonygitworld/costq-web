/**
 * 租户详情组件
 *
 * 展示租户基本信息，支持激活/禁用操作，包含用户列表
 */
import React from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Spin,
  Typography,
  Divider,
  Modal,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { opsService } from '../../services/opsService';
import { TenantUserList } from './TenantUserList';
import { useI18n } from '../../hooks/useI18n';

const { Title } = Typography;

export const TenantDetail: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, contextHolder] = Modal.useModal();
  const { t } = useI18n('ops');

  // 获取租户详情
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['ops-tenant', tenantId],
    queryFn: () => opsService.getTenant(tenantId!),
    enabled: !!tenantId,
  });

  // 激活操作
  const activateMutation = useMutation({
    mutationFn: opsService.activateTenant,
    onSuccess: () => {
      message.success(t('tenant.message.activateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['ops-tenant', tenantId] });
    },
    onError: () => message.error(t('tenant.message.operationFailed')),
  });

  // 禁用操作
  const deactivateMutation = useMutation({
    mutationFn: opsService.deactivateTenant,
    onSuccess: () => {
      message.success(t('tenant.message.deactivateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['ops-tenant', tenantId] });
    },
    onError: () => message.error(t('tenant.message.operationFailed')),
  });

  // Marketplace 刷新订阅状态
  const refreshMarketplaceMutation = useMutation({
    mutationFn: () => opsService.refreshTenantMarketplaceSubscription(tenantId!),
    onSuccess: (data) => {
      // data contains should_disable/organization_is_active/plan
      const active = data?.organization_is_active;
      const plan = data?.plan;
      message.success(`Marketplace刷新完成：${active ? '已启用' : '已禁用'}${plan ? `（plan=${plan}）` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['ops-tenant', tenantId] });
    },
    onError: () => message.error('Marketplace刷新失败'),
  });

  const handleRefreshMarketplace = () => {
    if (!tenantId) return;
    modal.confirm({
      title: '刷新 Marketplace 订阅状态',
      content: '将调用 AWS Marketplace entitlement 校验，并自动启用/禁用该租户。确认继续？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => refreshMarketplaceMutation.mutateAsync(),
    });
  };

  // 切换状态
  const handleToggleStatus = () => {
    if (!tenant) return;
    const isActive = tenant.is_active;
    modal.confirm({
      title: isActive ? t('tenant.action.confirmDeactivate') : t('tenant.action.confirmActivate'),
      content: isActive ? t('tenant.action.confirmDeactivateContent') : t('tenant.action.confirmActivateContent'),
      okText: t('common.confirm'),
      okButtonProps: { danger: isActive },
      cancelText: t('common.cancel'),
      onOk: () =>
        isActive
          ? deactivateMutation.mutateAsync(tenantId!)
          : activateMutation.mutateAsync(tenantId!),
    });
  };

  if (isLoading) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!tenant) {
    return <div style={{ padding: 24 }}>{t('common:placeholder.noData')}</div>;
  }

  return (
    <div style={{
      padding: 24,
      height: '100vh',
      overflow: 'auto',
      backgroundColor: '#f0f2f5'
    }}>
      {contextHolder}
      {/* 返回按钮 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/ops/tenants')}
        style={{ padding: 0, marginBottom: 16 }}
      >
        {t('common:button.back')}
      </Button>

      <Title level={4}>{t('tenant.detail.title')}</Title>

      {/* 基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={2}>
          <Descriptions.Item label={t('tenant.table.name')}>{tenant.name}</Descriptions.Item>
          <Descriptions.Item label={t('tenant.detail.tenantId')}>{tenant.id}</Descriptions.Item>
          <Descriptions.Item label={t('tenant.table.status')}>
            <Tag color={tenant.is_active ? 'green' : 'orange'}>
              {tenant.is_active ? t('tenant.status.activated') : t('tenant.status.pending')}
            </Tag>
            <Button
              size="small"
              onClick={handleRefreshMarketplace}
              loading={refreshMarketplaceMutation.isPending}
              style={{ marginLeft: 8 }}
            >
              刷新订阅（Marketplace）
            </Button>
            <Button
              size="small"
              danger={tenant.is_active}
              type={tenant.is_active ? 'default' : 'primary'}
              onClick={handleToggleStatus}
              style={{ marginLeft: 8 }}
            >
              {tenant.is_active ? t('tenant.action.deactivate') : t('tenant.action.activate')}
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label={t('tenant.table.userCount')}>{tenant.user_count}</Descriptions.Item>
          <Descriptions.Item label={t('tenant.table.createdAt')}>
            {dayjs(tenant.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.updatedAt')}>
            {dayjs(tenant.updated_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      {/* 用户列表 */}
      <TenantUserList tenantId={tenantId!} />
    </div>
  );
};

export default TenantDetail;
