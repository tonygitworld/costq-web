/**
 * Alert Detail - 告警详情页面
 */

import React, { useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  message,
  App
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlertStore } from '../../stores/alertStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { usePagination } from '../../hooks/usePagination';
import type { AlertHistory } from '../../types/alert';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

export const AlertDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  console.log('🎯 AlertDetail 组件渲染 - id 参数:', id);
  console.log('🎯 AlertDetail 组件渲染 - id 类型:', typeof id);
  console.log('🎯 AlertDetail 组件渲染 - useParams 完整对象:', useParams());
  const { modal } = App.useApp();

  const {
    currentAlert,
    alertHistory,
    loading,
    savingAlert,  // ✅ 添加 savingAlert 状态（用于测试按钮）
    fetchAlertById,
    fetchAlertHistory,
    deleteAlert,
    sendTestEmail
  } = useAlertStore();

  // ✅ 加载账号信息
  const { accounts: awsAccounts, fetchAccounts: fetchAWSAccounts } = useAccountStore();
  const { accounts: gcpAccounts, fetchAccounts: fetchGCPAccounts } = useGCPAccountStore();
  const { paginationProps } = usePagination(10);

  // 加载数据
  useEffect(() => {
    console.log('🔍 AlertDetail useEffect - ID:', id);
    if (id) {
      loadData();
      fetchAWSAccounts();
      fetchGCPAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    console.log('📡 开始加载告警数据 - ID:', id);
    try {
      await Promise.all([
        fetchAlertById(id),
        fetchAlertHistory(id)
      ]);
      console.log('✅ 告警数据加载成功');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载数据失败';
      console.error('❌ 加载告警数据失败:', error);
      message.error(msg);
      navigate('/settings/alerts');
    }
  };

  // 删除告警
  const handleDelete = () => {
    if (!currentAlert) return;

    modal.confirm({
      title: '确认删除',
      content: `确定要删除告警"${currentAlert.display_name}"吗？此操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAlert(currentAlert.id);
          message.success('删除成功');
          navigate('/settings/alerts');
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      }
    });
  };

  // 发送测试邮件
  const handleTest = async () => {
    if (!id || !currentAlert) return;

    // ✅ 检查账号ID
    if (!currentAlert.account_id) {
      message.warning('该告警未配置监控账号，请先编辑告警并设置账号');
      return;
    }

    try {
      // ✅ 传递账号ID参数（与编辑页保持一致）
      await sendTestEmail(id, currentAlert.account_id);
      message.success('测试邮件已发送，请检查邮箱');
      // ✅ 测试后刷新历史记录
      await fetchAlertHistory(id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '发送失败';
      message.error(`测试失败: ${msg}`);
    }
  };

  // 显示加载状态
  if (loading && !currentAlert) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Typography.Text>加载中...</Typography.Text>
      </div>
    );
  }

  // 如果没有数据，显示提示
  if (!currentAlert) {
    console.warn('⚠️ currentAlert 为空，但不在加载状态');
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Typography.Text type="secondary">未找到告警信息</Typography.Text>
      </div>
    );
  }

  console.log('✅ 渲染 AlertDetail - Alert:', currentAlert);

  // ✅ 获取账号名称
  const getAccountName = () => {
    if (!currentAlert.account_id) {
      return <Tag color="default">未设置账号</Tag>;
    }

    if (currentAlert.account_type === 'gcp') {
      const gcpAccount = gcpAccounts.find(a => a.id === currentAlert.account_id);
      return (
        <Tag color="blue" icon={<span>🔵</span>}>
          GCP: {gcpAccount?.account_name || gcpAccount?.project_id || currentAlert.account_id?.slice(0, 8)}
        </Tag>
      );
    }

    // AWS
    const awsAccount = awsAccounts.find(a => a.id === currentAlert.account_id);
    return (
      <Tag color="orange" icon={<span>☁️</span>}>
        AWS: {awsAccount?.alias || awsAccount?.account_id || currentAlert.account_id?.slice(0, 8)}
      </Tag>
    );
  };

  // 计算统计数据
  const totalExecutions = alertHistory.length;
  const triggeredCount = alertHistory.filter(h => h.triggered).length;
  const successCount = alertHistory.filter(h => h.status === 'success').length;
  const successRate = totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0;

  // 执行历史表格列
  const historyColumns: ColumnsType<AlertHistory> = [
    {
      title: '●',
      key: 'indicator',
      width: 40,
      render: (_, record) => (
        <span style={{ fontSize: '16px' }}>
          {record.status === 'success' ? '✅' : '❌'}
        </span>
      )
    },
    {
      title: '执行时间',
      dataIndex: 'executed_at',
      key: 'executed_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      )
    },
    {
      title: '触发',
      dataIndex: 'triggered',
      key: 'triggered',
      width: 80,
      render: (triggered) => (
        triggered ? <Tag color="warning">已触发</Tag> : <Tag>未触发</Tag>
      )
    },
    {
      title: '结果摘要',
      dataIndex: 'result_summary',
      key: 'result_summary',
      ellipsis: true
    }
  ];

  return (
    <div style={{
      height: '100vh',
      overflow: 'auto',
      background: '#f0f2f5',
      position: 'relative'
    }}>
      <Space direction="vertical" size="large" style={{
        width: '100%',
        padding: '24px',
        paddingBottom: '100px'  // ✅ 为底部内容留出空间
      }}>
        {/* 标题栏 */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/settings/alerts')}
            >
              返回
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              {currentAlert.display_name}
            </Title>
          </Space>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/settings/alerts/${id}/edit`)}
            >
              编辑
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={handleTest}
              loading={savingAlert}  // ✅ 使用 savingAlert 状态
            >
              测试
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              删除
            </Button>
          </Space>
        </Space>

      {/* 告警概览 */}
      <Card title="📊 告警概览">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="状态"
              value={currentAlert.is_active ? '启用中' : '已禁用'}
              prefix={currentAlert.is_active ? '🟢' : '🔴'}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="执行次数"
              value={totalExecutions}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="触发次数"
              value={triggeredCount}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="成功率"
              value={successRate}
              suffix="%"
            />
          </Col>
        </Row>
      </Card>

      {/* 告警配置 */}
      <Card title="📝 告警配置">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>告警描述</Text>
            <Paragraph style={{ marginTop: 8 }}>
              {currentAlert.description}
            </Paragraph>
          </div>
          {/* ✅ 新增：账号信息 */}
          <div>
            <Text strong>监控账号</Text>
            <Paragraph style={{ marginTop: 8 }}>
              {getAccountName()}
            </Paragraph>
          </div>
          <div>
            <Text strong>检查频率</Text>
            <Paragraph style={{ marginTop: 8 }}>
              ⏰ 每日 09:00 (UTC+8)
            </Paragraph>
          </div>
          <div>
            <Text strong>创建信息</Text>
            <Paragraph style={{ marginTop: 8 }}>
              👤 {currentAlert.created_by_username || '未知'} | 📅 创建于 {dayjs(currentAlert.created_at).fromNow()}
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* 执行历史 */}
      <Card
        title={`📜 执行历史 (共 ${totalExecutions} 次)`}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Table
          columns={historyColumns}
          dataSource={alertHistory}
          rowKey="id"
          loading={loading}
          pagination={{
            ...paginationProps,
            total: alertHistory.length,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
      </Space>
    </div>
  );
};
