/**
 * 租户列表组件
 *
 * 展示租户列表，支持筛选、搜索、激活/禁用操作
 */
import React, { useState, useRef } from 'react';
import {
  Table,
  Tag,
  Button,
  Input,
  Select,
  Modal,
  message,
  Typography,
  Space,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  opsService,
  type TenantListItem,
  type TenantListParams,
  type TenantDeleteImpact,
} from '../../services/opsService';
import { useI18n } from '../../hooks/useI18n';

const { Title } = Typography;

export const TenantList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, contextHolder] = Modal.useModal();
  const { t } = useI18n('ops');

  const [params, setParams] = useState<TenantListParams>({
    page: 1,
    page_size: 20,
    status: 'all',
    search: '',
  });

  // 获取租户列表
  const { data, isLoading } = useQuery({
    queryKey: ['ops-tenants', params],
    queryFn: () => opsService.getTenants(params),
  });

  // 激活租户
  const activateMutation = useMutation({
    mutationFn: opsService.activateTenant,
    onSuccess: () => {
      message.success(t('tenant.message.activateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
    onError: () => message.error(t('tenant.message.operationFailed')),
  });

  // 禁用租户
  const deactivateMutation = useMutation({
    mutationFn: opsService.deactivateTenant,
    onSuccess: () => {
      message.success(t('tenant.message.deactivateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
    onError: () => message.error(t('tenant.message.operationFailed')),
  });

  // 删除租户
  const deleteMutation = useMutation({
    mutationFn: ({
      tenantId,
      confirmationName,
    }: {
      tenantId: string;
      confirmationName: string;
    }) => opsService.deleteTenant(tenantId, confirmationName),
    onSuccess: () => {
      message.success(t('tenant.message.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
    onError: () => message.error(t('tenant.message.operationFailed')),
  });

  // 激活确认
  const handleActivate = (tenant: TenantListItem) => {
    modal.confirm({
      title: t('tenant.action.confirmActivate'),
      content: t('tenant.action.confirmActivateContent'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => activateMutation.mutateAsync(tenant.id),
    });
  };

  // 禁用确认
  const handleDeactivate = (tenant: TenantListItem) => {
    modal.confirm({
      title: t('tenant.action.confirmDeactivate'),
      content: t('tenant.action.confirmDeactivateContent'),
      okText: t('common.confirm'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => deactivateMutation.mutateAsync(tenant.id),
    });
  };

  // 删除确认（带影响预览和名称确认）
  const deleteInputRef = useRef('');

  const handleDelete = async (tenant: TenantListItem) => {
    // 先获取影响预览
    let impact: TenantDeleteImpact;
    try {
      impact = await opsService.getTenantDeleteImpact(tenant.id);
    } catch {
      message.error(t('tenant.message.operationFailed'));
      return;
    }

    deleteInputRef.current = '';

    modal.confirm({
      title: t('tenant.action.confirmDelete'),
      icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>
            {t('tenant.action.confirmDeleteContent', {
              name: tenant.name,
            })}
          </p>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={t('tenant.action.deleteImpactWarning', {
              userCount: impact.user_count,
              awsCount: impact.aws_account_count,
              gcpCount: impact.gcp_account_count,
              monitorCount: impact.monitoring_config_count,
              chatCount: impact.chat_session_count,
            })}
          />
          <Input
            placeholder={t('tenant.action.inputTenantName')}
            onChange={(e) => {
              deleteInputRef.current = e.target.value;
            }}
          />
        </div>
      ),
      okText: t('tenant.action.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        if (deleteInputRef.current !== tenant.name) {
          message.error(t('tenant.message.nameNotMatch'));
          return Promise.reject();
        }
        await deleteMutation.mutateAsync({
          tenantId: tenant.id,
          confirmationName: deleteInputRef.current,
        });
      },
    });
  };

  const columns = [
    {
      title: t('tenant.table.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TenantListItem) => (
        <a onClick={() => navigate(`/ops/tenants/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: t('tenant.table.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'orange'}>
          {active ? t('tenant.status.activated') : t('tenant.status.pending')}
        </Tag>
      ),
    },
    {
      title: t('tenant.table.userCount'),
      dataIndex: 'user_count',
      key: 'user_count',
      width: 80,
    },
    {
      title: t('tenant.table.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: t('tenant.table.lastActive'),
      dataIndex: 'last_active_at',
      key: 'last_active_at',
      width: 120,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: t('tenant.table.actions'),
      key: 'action',
      width: 180,
      render: (_: unknown, record: TenantListItem) => (
        <Space size="small">
          {record.is_active ? (
            <Button
              danger
              size="small"
              onClick={() => handleDeactivate(record)}
            >
              {t('tenant.action.deactivate')}
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              onClick={() => handleActivate(record)}
            >
              {t('tenant.action.activate')}
            </Button>
          )}
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{
      padding: 24,
      height: '100vh',
      overflow: 'auto',
      backgroundColor: '#f0f2f5'
    }}>
      {contextHolder}
      <Title level={4}>{t('tenant.list.title')}</Title>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Select
          value={params.status}
          onChange={(v) => setParams({ ...params, status: v, page: 1 })}
          style={{ width: 120 }}
        >
          <Select.Option value="all">{t('common:action.select')}</Select.Option>
          <Select.Option value="active">{t('tenant.status.activated')}</Select.Option>
          <Select.Option value="pending">{t('tenant.status.pending')}</Select.Option>
        </Select>
        <Input.Search
          placeholder={t('tenant.list.searchPlaceholder')}
          allowClear
          onSearch={(v) => setParams({ ...params, search: v, page: 1 })}
          style={{ width: 240 }}
          prefix={<SearchOutlined />}
        />
      </div>

      {/* 租户表格 */}
      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="id"
        loading={isLoading}
        scroll={{
          x: 1200,
          y: 'calc(100vh - 250px)',
          scrollToFirstRowOnChange: true
        }}
        sticky={{
          offsetHeader: 0
        }}
        pagination={{
          current: params.page,
          pageSize: params.page_size,
          total: data?.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) =>
            setParams({ ...params, page, page_size: pageSize }),
        }}
      />
    </div>
  );
};

export default TenantList;
