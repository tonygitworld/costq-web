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

const { Title } = Typography;

export const TenantDetail: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, contextHolder] = Modal.useModal();

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
      message.success('租户已激活');
      queryClient.invalidateQueries({ queryKey: ['ops-tenant', tenantId] });
    },
    onError: () => message.error('操作失败'),
  });

  // 禁用操作
  const deactivateMutation = useMutation({
    mutationFn: opsService.deactivateTenant,
    onSuccess: () => {
      message.success('租户已禁用');
      queryClient.invalidateQueries({ queryKey: ['ops-tenant', tenantId] });
    },
    onError: () => message.error('操作失败'),
  });

  // 切换状态
  const handleToggleStatus = () => {
    if (!tenant) return;
    const action = tenant.is_active ? '禁用' : '激活';
    modal.confirm({
      title: `确认${action}`,
      content: `确定要${action}租户「${tenant.name}」吗？`,
      okText: `确认${action}`,
      okButtonProps: { danger: tenant.is_active },
      cancelText: '取消',
      onOk: () =>
        tenant.is_active
          ? deactivateMutation.mutateAsync(tenantId!)
          : activateMutation.mutateAsync(tenantId!),
    });
  };

  if (isLoading) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!tenant) {
    return <div style={{ padding: 24 }}>租户不存在</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      {/* 返回按钮 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/ops/tenants')}
        style={{ padding: 0, marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Title level={4}>租户详情</Title>

      {/* 基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="租户名称">{tenant.name}</Descriptions.Item>
          <Descriptions.Item label="租户 ID">{tenant.id}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={tenant.is_active ? 'green' : 'orange'}>
              {tenant.is_active ? '已激活' : '待审核'}
            </Tag>
            <Button
              size="small"
              danger={tenant.is_active}
              type={tenant.is_active ? 'default' : 'primary'}
              onClick={handleToggleStatus}
              style={{ marginLeft: 8 }}
            >
              {tenant.is_active ? '禁用租户' : '激活租户'}
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="用户数">{tenant.user_count}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(tenant.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
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
