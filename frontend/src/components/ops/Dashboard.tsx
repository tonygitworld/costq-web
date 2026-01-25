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

const { Title, Text } = Typography;

export const OpsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [trendDays, setTrendDays] = useState<number>(7);

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
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MM-DD'),
    },
    {
      title: '日活用户',
      dataIndex: 'dau',
      key: 'dau',
    },
    {
      title: '查询量',
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
          运营 Dashboard
        </Title>
        <div>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            style={{ marginRight: 8 }}
          >
            刷新
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
                title="租户总数"
                value={stats?.total_tenants ?? '-'}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="用户总数"
                value={stats?.total_users ?? '-'}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日活跃"
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
                title="今日查询"
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
        title="趋势数据"
        extra={
          <Segmented
            options={[
              { label: '7天', value: 7 },
              { label: '30天', value: 30 },
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
      <Card title="租户状态">
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="已激活"
              value={stats?.active_tenants ?? '-'}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="待审核"
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
          查看租户管理 →
        </Button>
      </Card>
    </div>
  );
};

export default OpsDashboard;
