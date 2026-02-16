/**
 * 审计日志组件
 *
 * 展示审计日志列表，支持时间范围筛选、操作类型筛选、关键词搜索
 */
import React, { useState } from 'react';
import {
  Table,
  DatePicker,
  Select,
  Input,
  Button,
  Space,
  Typography,
  Tag,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  opsService,
  type AuditLogListParams,
} from '../../services/opsService';
import { useI18n } from '../../hooks/useI18n';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 操作类型颜色映射
const ACTION_COLORS: Record<string, string> = {
  login: 'green',
  login_failed: 'red',
  logout: 'default',
  user_create: 'blue',
  user_delete: 'orange',
  permission_grant: 'cyan',
  permission_revoke: 'purple',
  config_update: 'gold',
  tenant_activate: 'green',
  tenant_deactivate: 'red',
};

export const AuditLogs: React.FC = () => {
  const { t } = useI18n('ops');
  const [params, setParams] = useState<AuditLogListParams>({
    page: 1,
    page_size: 20,
    start_date: dayjs().subtract(7, 'day').startOf('day').toISOString(),
    end_date: dayjs().endOf('day').toISOString(),
  });
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);
  const [searchText, setSearchText] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();

  // 获取操作类型列表
  const { data: actionTypes } = useQuery({
    queryKey: ['ops-action-types'],
    queryFn: opsService.getActionTypes,
  });

  // 获取租户列表
  const { data: tenantOptions } = useQuery({
    queryKey: ['ops-audit-log-tenants'],
    queryFn: opsService.getAuditLogTenants,
  });

  // 获取用户列表（根据选中的租户筛选）
  const { data: userOptions } = useQuery({
    queryKey: ['ops-audit-log-users', selectedOrgId],
    queryFn: () => opsService.getAuditLogUsers(selectedOrgId),
  });

  // 获取审计日志
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ops-audit-logs', params],
    queryFn: () => opsService.getAuditLogs(params),
  });


  // 处理租户筛选变化
  const handleOrgChange = (orgId: string | undefined) => {
    setSelectedOrgId(orgId);
    // 清空用户筛选（因为用户列表会变化）
    setParams({ ...params, org_id: orgId, user_id: undefined, page: 1 });
  };

  // 处理用户筛选变化
  const handleUserChange = (userId: string | undefined) => {
    setParams({ ...params, user_id: userId, page: 1 });
  };

  // 处理日期范围变化
  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates || [null, null]);
    if (dates && dates[0] && dates[1]) {
      setParams({
        ...params,
        start_date: dates[0].startOf('day').toISOString(),
        end_date: dates[1].endOf('day').toISOString(),
        page: 1,
      });
    } else {
      // 清除日期时，移除日期参数，查询所有日期
      const { start_date, end_date, ...rest } = params;
      setParams({ ...rest, page: 1 });
    }
  };

  // 处理搜索
  const handleSearch = () => {
    setParams({ ...params, search: searchText, page: 1 });
  };

  // 重置筛选
  const handleReset = () => {
    setParams({ page: 1, page_size: 20 });
    setDateRange([dayjs().subtract(7, 'day'), dayjs()]);
    setSearchText('');
    setSelectedOrgId(undefined);
  };

  // 表格列定义
  const columns = [
    {
      title: t('audit.table.time'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 165,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('audit.table.tenant'),
      dataIndex: 'org_name',
      key: 'org_name',
      width: 140,
      ellipsis: true,
      render: (name: string | null) => name || '-',
    },
    {
      title: t('audit.table.user'),
      dataIndex: 'username',
      key: 'username',
      width: 200,
      ellipsis: true,
      render: (name: string | null) => name || '-',
    },
    {
      title: t('audit.table.action'),
      dataIndex: 'action',
      key: 'action',
      width: 90,
      render: (action: string) => {
        const label =
          actionTypes?.actions.find((a) => a.value === action)?.label || action;
        return <Tag color={ACTION_COLORS[action] || 'default'}>{label}</Tag>;
      },
    },
    {
      title: t('audit.table.resourceType'),
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      ellipsis: true,
      render: (value: string | null) => value || '-',
    },
    {
      title: t('audit.table.resourceId'),
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 310,
      ellipsis: true,
      render: (value: string | null) => value || '-',
    },
    {
      title: t('audit.table.sessionId'),
      dataIndex: 'session_id',
      key: 'session_id',
      width: 310,
      ellipsis: true,
      render: (value: string | null) => value || '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (ip: string | null) => ip || '-',
    },
  ];

  return (
    <div style={{
      padding: 24,
      height: '100vh',
      overflow: 'auto',
      backgroundColor: '#f0f2f5'
    }}>
      <Title level={4}>{t('audit.title')}</Title>

      {/* 筛选栏 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <RangePicker
          value={dateRange}
          onChange={handleDateChange}
          presets={[
            { label: t('audit.filter.today'), value: [dayjs(), dayjs()] },
            { label: t('audit.filter.last7Days'), value: [dayjs().subtract(7, 'day'), dayjs()] },
            { label: t('audit.filter.last30Days'), value: [dayjs().subtract(30, 'day'), dayjs()] },
          ]}
        />
        <Select
          placeholder={t('audit.filter.selectTenant')}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 160 }}
          value={params.org_id}
          onChange={handleOrgChange}
          options={tenantOptions?.options.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
        <Select
          placeholder={t('audit.filter.selectUser')}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          value={params.user_id}
          onChange={handleUserChange}
          options={userOptions?.options.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
        <Select
          placeholder={t('audit.filter.actionType')}
          allowClear
          style={{ width: 120 }}
          value={params.action}
          onChange={(v) => setParams({ ...params, action: v, page: 1 })}
          options={actionTypes?.actions.map((a) => ({
            value: a.value,
            label: a.label,
          }))}
        />
        <Input
          placeholder={t('audit.filter.searchPlaceholder')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 180 }}
          prefix={<SearchOutlined />}
        />
        <Button type="primary" onClick={handleSearch}>
          {t('common:button.search')}
        </Button>
        <Button onClick={handleReset}>{t('audit.button.reset')}</Button>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          {t('audit.button.refresh')}
        </Button>
      </Space>

      {/* 结果统计 */}
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">{t('audit.summary.totalRecords', { total: data?.total || 0 })}</Text>
      </div>

      {/* 日志表格 */}
      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="id"
        loading={isLoading}
        scroll={{
          x: 1600,
          y: 'calc(100vh - 350px)',
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
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => t('audit.summary.totalPagination', { total }),
          onChange: (page, pageSize) =>
            setParams({ ...params, page, page_size: pageSize }),
        }}
        size="small"
      />
    </div>
  );
};

export default AuditLogs;
