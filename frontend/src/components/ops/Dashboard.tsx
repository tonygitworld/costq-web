/**
 * 运营 Dashboard 组件
 *
 * 展示核心指标卡片、趋势数据、租户状态概览
 */
import React, { useState } from 'react';
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
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  RiseOutlined,
  MessageOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { opsService } from '../../services/opsService';
import { useI18n } from '../../hooks/useI18n';

const { Title, Text } = Typography;

export const OpsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [trendDays, setTrendDays] = useState<number>(7);
  const { t } = useI18n('ops');

  // 获取统计数据
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['ops-dashboard-stats'],
    queryFn: opsService.getDashboardStats,
  });

  // 获取趋势数据
  const {
    data: trends,
    isLoading: trendsLoading,
    refetch: refetchTrends,
  } = useQuery({
    queryKey: ['ops-dashboard-trends', trendDays],
    queryFn: () => opsService.getDashboardTrends(trendDays),
  });

  // 刷新所有数据
  const handleRefresh = () => {
    refetchStats();
    refetchTrends();
  };

  // 计算变化率
  const calcChange = (
    today: number,
    yesterday: number
  ): React.ReactNode => {
    if (yesterday === 0) return null;
    const change = ((today - yesterday) / yesterday) * 100;
    const isUp = change >= 0;
    return (
      <span style={{ fontSize: 14, color: isUp ? '#52c41a' : '#ff4d4f' }}>
        {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  // 趋势数据表格列
  const trendColumns = [
    {
      title: t('trend.date'),
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MM-DD'),
    },
    {
      title: t('trend.activeUsers'),
      dataIndex: 'dau',
      key: 'dau',
    },
    {
      title: t('trend.queries'),
      dataIndex: 'queries',
      key: 'queries',
    },
  ];

  // 转换趋势数据为表格格式
  const trendTableData = trends
    ? trends.dau_trend.map((d, i) => ({
        key: d.date,
        date: d.date,
        dau: d.value,
        queries: trends.query_trend[i]?.value ?? 0,
      }))
    : [];

  return (
    <div style={{ padding: 24 }}>
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {t('dashboard.title')}
        </Title>
        <div>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            style={{ marginRight: 8 }}
          >
            {t('common:button.refresh')}
          </Button>
          {stats && (
            <Text type="secondary">
              更新于 {dayjs(stats.updated_at).format('HH:mm:ss')}
            </Text>
          )}
        </div>
      </div>

      {/* 核心指标卡片 */}
      <Spin spinning={statsLoading}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('dashboard.totalTenants')}
                value={stats?.total_tenants ?? '-'}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('dashboard.totalUsers')}
                value={stats?.total_users ?? '-'}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('dashboard.todayActive')}
                value={stats?.today_dau ?? '-'}
                prefix={<RiseOutlined />}
                suffix={
                  stats && calcChange(stats.today_dau, stats.yesterday_dau)
                }
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('dashboard.todayQueries')}
                value={stats?.today_queries ?? '-'}
                prefix={<MessageOutlined />}
                suffix={
                  stats &&
                  calcChange(stats.today_queries, stats.yesterday_queries)
                }
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* 趋势数据（简化版：使用表格代替图表） */}
      <Card
        title={t('dashboard.trendData')}
        extra={
          <Segmented
            options={[
              { label: t('audit.filter.last7Days'), value: 7 },
              { label: t('audit.filter.last30Days'), value: 30 },
            ]}
            value={trendDays}
            onChange={(v) => setTrendDays(v as number)}
          />
        }
        style={{ marginBottom: 24 }}
      >
        <Spin spinning={trendsLoading}>
          <Table
            columns={trendColumns}
            dataSource={trendTableData}
            pagination={false}
            size="small"
            scroll={{ y: 240 }}
          />
        </Spin>
      </Card>

      {/* 租户状态概览 */}
      <Card title={t('dashboard.tenantStatus')}>
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title={t('dashboard.activated')}
              value={stats?.active_tenants ?? '-'}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={t('dashboard.pending')}
              value={stats?.pending_tenants ?? '-'}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
        </Row>
        <Button
          type="link"
          style={{ padding: 0, marginTop: 16 }}
          onClick={() => navigate('/ops/tenants')}
        >
          {t('tenant.list.title')} →
        </Button>
      </Card>
    </div>
  );
};

export default OpsDashboard;
