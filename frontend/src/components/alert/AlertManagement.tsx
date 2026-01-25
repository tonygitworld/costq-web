/**
 * Alert Management - 告警管理主页面
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Input,
  Select,
  message,
  Typography,
  Tag,
  App,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  BellOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { usePagination } from '../../hooks/usePagination';
import type { Alert } from '../../types/alert';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title } = Typography;
const { Search } = Input;

export const AlertManagement: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const currentUser = useAuthStore(state => state.user);

  const {
    alerts,
    loading,
    fetchAlerts,
    deleteAlert,
    triggerScheduler, // ⭐ 新增
  } = useAlertStore();

  // ✅ 加载账号信息
  const { accounts: awsAccounts, fetchAccounts: fetchAWSAccounts } = useAccountStore();
  const { accounts: gcpAccounts, fetchAccounts: fetchGCPAccounts } = useGCPAccountStore();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'me'>('all');
  const [triggering, setTriggering] = useState(false); // ⭐ 触发状态
  const { paginationProps } = usePagination(10);

  const isAdmin = currentUser?.role === 'admin'; // ⭐ 判断管理员

  // 加载告警列表和账号列表
  useEffect(() => {
    loadAlerts();
    fetchAWSAccounts();
    fetchGCPAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAlerts = async () => {
    try {
      await fetchAlerts();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载告警列表失败';
      message.error(msg);
    }
  };

  // ⭐ 手动触发处理函数
  const handleManualTrigger = async () => {
    setTriggering(true);
    try {
      await triggerScheduler();
      message.success('已触发系统扫描，请稍后查看日志');
      // 延迟刷新列表，以便看到状态更新（虽然是异步的，但也许能看到 last_checked_at 变化）
      setTimeout(loadAlerts, 2000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '触发失败';
      message.error(msg);
    } finally {
      setTriggering(false);
    }
  };

  // 过滤告警
  const filteredAlerts = alerts.filter(alert => {
    // 搜索过滤
    if (searchText) {
      const search = searchText.toLowerCase();
      if (
        !alert.display_name.toLowerCase().includes(search) &&
        !alert.description.toLowerCase().includes(search)
      ) {
        return false;
      }
    }

    // 状态过滤
    if (statusFilter === 'active' && !alert.is_active) return false;
    if (statusFilter === 'inactive' && alert.is_active) return false;

    // 创建者过滤
    if (creatorFilter === 'me' && alert.user_id !== currentUser?.id) return false;

    return true;
  });

  // 获取状态显示
  const getStatusDisplay = (alert: Alert) => {
    if (!alert.is_active) {
      return <Tag color="default">⏸️ 禁用</Tag>;
    }
    if (!alert.last_executed_at) {
      return <Tag color="default">⏳ 未执行</Tag>;
    }
    // 这里简化处理，实际应该从历史记录获取最后执行状态
    return <Tag color="success">✅ {dayjs(alert.last_executed_at).fromNow()}</Tag>;
  };

  // ✅ 获取账号名称
  const getAccountName = (accountId?: string, accountType?: string) => {
    if (!accountId) {
      return <Tag color="default">未设置</Tag>;
    }

    if (accountType === 'gcp') {
      const gcpAccount = gcpAccounts.find(a => a.id === accountId);
      return (
        <Tag color="blue" icon={<span>🔵</span>}>
          GCP: {gcpAccount?.account_name || gcpAccount?.project_id || accountId.slice(0, 8)}
        </Tag>
      );
    }

    // AWS
    const awsAccount = awsAccounts.find(a => a.id === accountId);
    return (
      <Tag color="orange" icon={<span>☁️</span>}>
        AWS: {awsAccount?.alias || awsAccount?.account_id || accountId.slice(0, 8)}
      </Tag>
    );
  };

  // 删除告警
  const handleDelete = (alert: Alert) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除告警"${alert.display_name}"吗？此操作不可恢复。`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAlert(alert.id);
          message.success('删除成功');
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      }
    });
  };

  // 表格列定义
  const columns: ColumnsType<Alert> = [
    {
      title: '●',
      key: 'indicator',
      width: 40,
      render: (_, record) => {
        console.log('📋 Table render - record:', record);
        console.log('🆔 Table render - record.id:', record.id);
        return (
          <span style={{ fontSize: '20px' }}>
            {record.is_active ? '🟢' : '🔴'}
          </span>
        );
      }
    },
    {
      title: '名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div style={{ marginBottom: 4 }}>{text}</div>
          <Space size={4} style={{ fontSize: '12px' }}>
            <span style={{ color: '#999' }}>
              👤 {record.created_by_username || '未知'} | 📅 {dayjs(record.created_at).fromNow()}
            </span>
            {/* ✅ 显示账号信息 */}
            {record.account_id && (
              <>
                <span style={{ color: '#999' }}>|</span>
                {getAccountName(record.account_id, record.account_type)}
              </>
            )}
          </Space>
        </div>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => getStatusDisplay(record)
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              console.log('🔘 点击详情按钮 - record:', record);
              console.log('🔘 点击详情按钮 - record.id:', record.id);
              console.log('🔘 导航到:', `/settings/alerts/${record.id}`);
              navigate(`/settings/alerts/${record.id}`);
            }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/settings/alerts/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px' }}>
      {/* 标题 */}
      <Title level={3}>
        <BellOutlined /> 告警管理
      </Title>

      {/* 主卡片 */}
      <Card>
        {/* 筛选栏 */}
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Search
              placeholder="搜索告警名称或描述..."
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
            <Select
              value={creatorFilter}
              onChange={setCreatorFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部创建者</Select.Option>
              <Select.Option value="me">我创建的</Select.Option>
            </Select>
          </Space>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAlerts}
              loading={loading}
            >
              刷新
            </Button>

            {/* ✅ 仅管理员可见：手动触发调度器 */}
            {isAdmin && (
              <Tooltip title="立即触发一次全系统告警检查（仅管理员）">
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={handleManualTrigger}
                  loading={triggering}
                >
                  立即检查
                </Button>
              </Tooltip>
            )}

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/settings/alerts/new')}
            >
              新建告警
            </Button>
          </Space>
        </Space>

        {/* 告警列表 */}
        <Table
          columns={columns}
          dataSource={filteredAlerts}
          rowKey="id"
          loading={loading}
          pagination={{
            ...paginationProps,
            total: filteredAlerts.length,
            showTotal: (total) => `共 ${total} 个告警`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </Space>
  );
};
