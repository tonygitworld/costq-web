/**
 * 租户用户列表组件
 *
 * 展示指定租户下的用户列表
 */
import React, { useState } from 'react';
import { Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  opsService,
  type TenantUserListParams,
} from '../../services/opsService';
import { useI18n } from '../../hooks/useI18n';

const { Title } = Typography;

interface TenantUserListProps {
  tenantId: string;
}

export const TenantUserList: React.FC<TenantUserListProps> = ({ tenantId }) => {
  const { t } = useI18n('ops');
  const [params, setParams] = useState<TenantUserListParams>({
    page: 1,
    page_size: 10,
  });

  // 获取用户列表
  const { data, isLoading } = useQuery({
    queryKey: ['ops-tenant-users', tenantId, params],
    queryFn: () => opsService.getTenantUsers(tenantId, params),
    enabled: !!tenantId,
  });

  const columns = [
    {
      title: t('user.table.username'),
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: t('user.table.email'),
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: t('user.table.role'),
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'blue' : 'default'}>
          {role === 'admin' ? t('user.role.admin') : t('user.role.user')}
        </Tag>
      ),
    },
    {
      title: t('user.table.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? t('user.status.active') : t('user.status.disabled')}
        </Tag>
      ),
    },
    {
      title: t('user.table.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: t('user.table.lastLogin'),
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 120,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
  ];

  return (
    <div>
      <Title level={5}>{t('user.table.username')}</Title>
      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{
          x: 1000,
          y: 'calc(50vh - 150px)',
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

export default TenantUserList;
