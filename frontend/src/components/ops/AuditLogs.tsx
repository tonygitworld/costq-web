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
  type AuditLogItem,
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
      width: 160,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('audit.table.tenant'),
      dataIndex: 'org_name',
      key: 'org_name',
      width: 120,
      render: (name: string | null) => name || '-',
    },
    {
      title: t('audit.table.user'),
      dataIndex: 'username',
      key: 'username',
      width: 160,
      render: (name: string | null) => name || '-',
    },
    {
      title: t('audit.table.action'),
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => {
        const label =
          actionTypes?.actions.find((a) => a.value === action)?.label || action;
        return <Tag color={ACTION_COLORS[action] || 'default'}>{label}</Tag>;
      },
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (ip: string | null) => ip || '-',
    },
  ];

  // 展开行渲染
  const expandedRowRender = (record: AuditLogItem) => {
    let detailsObj = null;
    try {
      if (record.details) {
        detailsObj = JSON.parse(record.details);
      }
    } catch {
      // 解析失败，显示原始字符串
    }

    return (
      <div style={{ padding: '8px 0' }}>
        <Space direction="vertical" size="small">
          {record.resource_type && (
            <Text>
              <strong>资源类型:</strong> {record.resource_type}
            </Text>
          )}
          {record.resource_id && (
            <Text>
              <strong>资源 ID:</strong> {record.resource_id}
            </Text>
          )}
          {record.user_agent && (
            <Text>
              <strong>User-Agent:</strong>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.user_agent}
              </Text>
            </Text>
          )}
          {record.details && (
            <div>
              <strong>详情:</strong>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {detailsObj
                  ? JSON.stringify(detailsObj, null, 2)
                  : record.details}
              </pre>
            </div>
          )}
        </Space>
      </div>
    );
  };


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
        <Button onClick={handleReset}>重置</Button>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          刷新
        </Button>
      </Space>

      {/* 结果统计 */}
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">共 {data?.total || 0} 条记录</Text>
      </div>

      {/* 日志表格 */}
      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="id"
        loading={isLoading}
        expandable={{
          expandedRowRender,
          expandRowByClick: true,
        }}
        scroll={{
          x: 1400,
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
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) =>
            setParams({ ...params, page, page_size: pageSize }),
        }}
        size="small"
      />
    </div>
  );
};

export default AuditLogs;
