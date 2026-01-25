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

const { Title } = Typography;

interface TenantUserListProps {
  tenantId: string;
}

export const TenantUserList: React.FC<TenantUserListProps> = ({ tenantId }) => {
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'blue' : 'default'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 120,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
  ];

  return (
    <div>
      <Title level={5}>用户列表</Title>
      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="id"
        loading={isLoading}
        size="small"
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
