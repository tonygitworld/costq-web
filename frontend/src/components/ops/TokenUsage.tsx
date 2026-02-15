/**
 * Token 用量统计页面组件
 *
 * 展示全平台 Token 用量汇总、组织维度排行、用户维度排行
 */
import { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Button,
  Typography,
  Segmented,
  Table,
  Tabs,
  Select,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  opsService,
  type OrgTokenUsageItem,
  type UserTokenUsageItem,
} from '../../services/opsService';

const { Title } = Typography;
const { RangePicker } = DatePicker;

type TimeRange = '7d' | '30d' | 'custom';

function getDateRange(
  range: TimeRange,
  customDates: [Dayjs, Dayjs] | null
): { startDate: string; endDate: string } {
  if (range === 'custom' && customDates) {
    return {
      startDate: customDates[0].format('YYYY-MM-DD'),
      endDate: customDates[1].format('YYYY-MM-DD'),
    };
  }
  const days = range === '7d' ? 7 : 30;
  return {
    startDate: dayjs().subtract(days, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  };
}

/** Token 数值列（组织和用户表格共用） */
const tokenValueColumns: ColumnsType<
  OrgTokenUsageItem | UserTokenUsageItem
> = [
  {
    title: '输入 Token',
    dataIndex: 'input_tokens',
    key: 'input_tokens',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: '输出 Token',
    dataIndex: 'output_tokens',
    key: 'output_tokens',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: '缓存读取',
    dataIndex: 'cache_read_tokens',
    key: 'cache_read_tokens',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: '缓存写入',
    dataIndex: 'cache_write_tokens',
    key: 'cache_write_tokens',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: '总计',
    dataIndex: 'total_tokens',
    key: 'total_tokens',
    render: (v: number) => <strong>{v.toLocaleString()}</strong>,
  },
];

const orgColumns: ColumnsType<OrgTokenUsageItem> = [
  { title: '组织名称', dataIndex: 'org_name', key: 'org_name' },
  ...(tokenValueColumns as ColumnsType<OrgTokenUsageItem>),
];

const userColumns: ColumnsType<UserTokenUsageItem> = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '所属组织', dataIndex: 'org_name', key: 'org_name' },
  ...(tokenValueColumns as ColumnsType<UserTokenUsageItem>),
];

export const OpsTokenUsage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customDates, setCustomDates] = useState<[Dayjs, Dayjs] | null>(null);
  const [orgPage, setOrgPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const pageSize = 20;

  const { startDate, endDate } = useMemo(
    () => getDateRange(timeRange, customDates),
    [timeRange, customDates]
  );

  // 全平台汇总
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['ops-token-summary', startDate, endDate],
    queryFn: () => opsService.getTokenUsageSummary(startDate, endDate),
  });

  // 组织维度
  const {
    data: orgData,
    isLoading: orgLoading,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: ['ops-token-by-org', startDate, endDate, orgPage],
    queryFn: () =>
      opsService.getTokenUsageByOrg({
        start_date: startDate,
        end_date: endDate,
        page: orgPage,
        page_size: pageSize,
      }),
  });

  // 用户维度
  const {
    data: userData,
    isLoading: userLoading,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['ops-token-by-user', startDate, endDate, userPage, selectedOrgId],
    queryFn: () =>
      opsService.getTokenUsageByUser({
        start_date: startDate,
        end_date: endDate,
        org_id: selectedOrgId,
        page: userPage,
        page_size: pageSize,
      }),
  });

  // 组织选项（复用审计日志的租户列表）
  const { data: tenantOptions } = useQuery({
    queryKey: ['ops-audit-tenants'],
    queryFn: opsService.getAuditLogTenants,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchOrg();
    refetchUser();
  };

  const handleTimeRangeChange = (value: string | number) => {
    const v = value as TimeRange;
    setTimeRange(v);
    setOrgPage(1);
    setUserPage(1);
    if (v !== 'custom') {
      setCustomDates(null);
    }
  };

  const handleCustomDateChange = (
    dates: [Dayjs | null, Dayjs | null] | null
  ) => {
    if (dates && dates[0] && dates[1]) {
      setCustomDates([dates[0], dates[1]]);
      setTimeRange('custom');
      setOrgPage(1);
      setUserPage(1);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        height: '100vh',
        overflow: 'auto',
        backgroundColor: '#f0f2f5',
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Token 用量统计
        </Title>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          刷新
        </Button>
      </div>

      {/* 时间范围选择器 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Segmented
          options={[
            { label: '最近 7 天', value: '7d' },
            { label: '最近 30 天', value: '30d' },
            { label: '自定义', value: 'custom' },
          ]}
          value={timeRange}
          onChange={handleTimeRangeChange}
        />
        {timeRange === 'custom' && (
          <RangePicker
            value={customDates}
            onChange={handleCustomDateChange}
          />
        )}
      </div>

      {/* 汇总统计卡片 */}
      <Spin spinning={summaryLoading}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={5}>
            <Card>
              <Statistic
                title="输入 Token"
                value={summary?.total_input_tokens ?? '-'}
                formatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString() : v
                }
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="输出 Token"
                value={summary?.total_output_tokens ?? '-'}
                formatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString() : v
                }
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="缓存读取 Token"
                value={summary?.total_cache_read_tokens ?? '-'}
                formatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString() : v
                }
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="缓存写入 Token"
                value={summary?.total_cache_write_tokens ?? '-'}
                formatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString() : v
                }
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="消息总数"
                value={summary?.total_messages ?? '-'}
                formatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString() : v
                }
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* 数据表格 Tabs */}
      <Card>
        <Tabs
          defaultActiveKey="org"
          items={[
            {
              key: 'org',
              label: '按组织',
              children: (
                <Spin spinning={orgLoading}>
                  <Table<OrgTokenUsageItem>
                    columns={orgColumns}
                    dataSource={orgData?.items}
                    rowKey="org_id"
                    pagination={{
                      current: orgPage,
                      pageSize,
                      total: orgData?.total ?? 0,
                      onChange: (p) => setOrgPage(p),
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    size="middle"
                  />
                </Spin>
              ),
            },
            {
              key: 'user',
              label: '按用户',
              children: (
                <Spin spinning={userLoading}>
                  <div style={{ marginBottom: 16 }}>
                    <Select
                      allowClear
                      placeholder="按组织筛选"
                      style={{ width: 240 }}
                      value={selectedOrgId}
                      onChange={(v) => {
                        setSelectedOrgId(v);
                        setUserPage(1);
                      }}
                      options={tenantOptions?.options.map((o) => ({
                        label: o.label,
                        value: o.value,
                      }))}
                    />
                  </div>
                  <Table<UserTokenUsageItem>
                    columns={userColumns}
                    dataSource={userData?.items}
                    rowKey="user_id"
                    pagination={{
                      current: userPage,
                      pageSize,
                      total: userData?.total ?? 0,
                      onChange: (p) => setUserPage(p),
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    size="middle"
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default OpsTokenUsage;
