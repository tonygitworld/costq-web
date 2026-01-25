/**
 * 租户列表组件
 *
 * 展示租户列表，支持筛选、搜索、激活/禁用操作
 */
import React, { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Input,
  Select,
  Modal,
  message,
  Typography,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  opsService,
  type TenantListItem,
  type TenantListParams,
} from '../../services/opsService';

const { Title } = Typography;

export const TenantList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, contextHolder] = Modal.useModal();

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
      message.success('租户已激活');
      queryClient.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
    onError: () => message.error('操作失败'),
  });

  // 禁用租户
  const deactivateMutation = useMutation({
    mutationFn: opsService.deactivateTenant,
    onSuccess: () => {
      message.success('租户已禁用');
      queryClient.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
    onError: () => message.error('操作失败'),
  });

  // 激活确认
  const handleActivate = (tenant: TenantListItem) => {
    modal.confirm({
      title: '确认激活',
      content: `确定要激活租户「${tenant.name}」吗？激活后该租户下的用户可以正常登录使用。`,
      okText: '确认激活',
      cancelText: '取消',
      onOk: () => activateMutation.mutateAsync(tenant.id),
    });
  };

  // 禁用确认
  const handleDeactivate = (tenant: TenantListItem) => {
    modal.confirm({
      title: '确认禁用',
      content: `确定要禁用租户「${tenant.name}」吗？禁用后该租户下的用户将无法登录。`,
      okText: '确认禁用',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => deactivateMutation.mutateAsync(tenant.id),
    });
  };

  const columns = [
    {
      title: '租户名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TenantListItem) => (
        <a onClick={() => navigate(`/ops/tenants/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'orange'}>
          {active ? '已激活' : '待审核'}
        </Tag>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active_at',
      key: 'last_active_at',
      width: 120,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: TenantListItem) =>
        record.is_active ? (
          <Button
            danger
            size="small"
            onClick={() => handleDeactivate(record)}
          >
            禁用
          </Button>
        ) : (
          <Button
            type="primary"
            size="small"
            onClick={() => handleActivate(record)}
          >
            激活
          </Button>
        ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={4}>租户管理</Title>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Select
          value={params.status}
          onChange={(v) => setParams({ ...params, status: v, page: 1 })}
          style={{ width: 120 }}
        >
          <Select.Option value="all">全部</Select.Option>
          <Select.Option value="active">已激活</Select.Option>
          <Select.Option value="pending">待审核</Select.Option>
        </Select>
        <Input.Search
          placeholder="搜索租户名称"
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
