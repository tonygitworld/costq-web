/**
 * Alert Management - 告警管理主页面
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Input,
  Select,
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
  PlayCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { usePagination } from '../../hooks/usePagination';
import { useI18n } from '../../hooks/useI18n';
import { AWSStyleTable } from '../common/AWSStyleTable';
import { TruncateText } from '../common/TruncateText';
import type { Alert } from '../../types/alert';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';

dayjs.extend(relativeTime);

const { Title } = Typography;
const { Search } = Input;

export const AlertManagement: React.FC = () => {
  const navigate = useNavigate();
  // ✅ 使用 App.useApp() 获取 message, modal, notification 实例，解决静态方法无法获取上下文的问题
  const { modal, message } = App.useApp();
  const currentUser = useAuthStore(state => state.user);
  const { t } = useI18n('alert');

  const {
    alerts,
    loading,
    fetchAlerts,
    deleteAlert,
    triggerScheduler,
  } = useAlertStore();

  // 加载账号信息
  const { accounts: awsAccounts, fetchAccounts: fetchAWSAccounts } = useAccountStore();
  const { accounts: gcpAccounts, fetchAccounts: fetchGCPAccounts } = useGCPAccountStore();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'me'>('all');
  const [triggering, setTriggering] = useState(false);
  const { paginationProps } = usePagination(10);

  const isAdmin = currentUser?.role === 'admin';

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
      const msg = error instanceof Error ? error.message : t('message.loadFailed');
      message.error(msg);
    }
  };

  // 手动触发处理函数
  const handleManualTrigger = async () => {
    setTriggering(true);
    try {
      await triggerScheduler();
      message.success(t('message.triggerSuccess'));
      // 延迟刷新列表，以便看到状态更新
      setTimeout(loadAlerts, 2000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.triggerFailed');
      message.error(msg);
    } finally {
      setTriggering(false);
    }
  };

  // 过滤告警
  const filteredAlerts = alerts.filter(alert => {
    if (searchText) {
      const search = searchText.toLowerCase();
      if (
        !alert.display_name.toLowerCase().includes(search) &&
        !alert.description.toLowerCase().includes(search)
      ) {
        return false;
      }
    }

    if (statusFilter === 'active' && !alert.is_active) return false;
    if (statusFilter === 'inactive' && alert.is_active) return false;

    if (creatorFilter === 'me' && alert.user_id !== currentUser?.id) return false;

    return true;
  });

  // 获取状态显示
  const getStatusDisplay = (alert: Alert) => {
    if (!alert.is_active) {
      return <Tag color="default">⏸️ {t('table.statusDisabled')}</Tag>;
    }
    if (!alert.last_executed_at) {
      return <Tag color="default">⏳ {t('table.statusNeverExecuted')}</Tag>;
    }
    return <Tag color="success">✅ {dayjs(alert.last_executed_at).fromNow()}</Tag>;
  };

  // 获取账号名称
  const getAccountName = (accountId?: string, accountType?: string) => {
    if (!accountId) {
      return <Tag color="default">{t('table.notSet')}</Tag>;
    }

    if (accountType === 'gcp') {
      const gcpAccount = gcpAccounts.find(a => a.id === accountId);
      return (
        <Tag color="blue" icon={<span>🔵</span>}>
          {t('account.gcp')}: {gcpAccount?.account_name || gcpAccount?.project_id || accountId.slice(0, 8)}
        </Tag>
      );
    }

    const awsAccount = awsAccounts.find(a => a.id === accountId);
    return (
      <Tag color="orange" icon={<span>☁️</span>}>
        {t('account.aws')}: {awsAccount?.alias || awsAccount?.account_id || accountId.slice(0, 8)}
      </Tag>
    );
  };

  // 删除告警
  const handleDelete = (alert: Alert) => {
    modal.confirm({
      title: t('confirm.deleteTitle'),
      content: t('confirm.deleteContent', { name: alert.display_name }),
      okType: 'danger',
      okText: t('confirm.deleteOk'),
      cancelText: t('confirm.deleteCancel'),
      onOk: async () => {
        try {
          await deleteAlert(alert.id);
          message.success(t('message.deleteSuccess'));
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : t('message.deleteFailed');
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
      minWidth: 32,
      render: (_, record) => (
        <span style={{ fontSize: '20px' }}>
          {record.is_active ? '🟢' : '🔴'}
        </span>
      )
    },
    {
      title: t('table.columnName'),
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
      minWidth: 75,
      sorter: (a, b) => a.display_name.localeCompare(b.display_name),
      showSorterTooltip: false,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: t('table.columnDescription'),
      dataIndex: 'description',
      key: 'description',
      width: 280,
      minWidth: 110,
      sorter: (a, b) => a.description.localeCompare(b.description),
      showSorterTooltip: false,
      render: (text, record) => (
        <div>
          <TruncateText text={text} maxLines={1} expandable modalTitle={t('table.columnDescription')} />
          <Space size={4} style={{ fontSize: '12px', marginTop: 4 }}>
            <span style={{ color: '#999' }}>
              📅 {dayjs(record.created_at).fromNow()}
            </span>
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
      title: t('table.columnCreator'),
      key: 'creator',
      width: 180,
      minWidth: 80,
      sorter: (a, b) => (a.created_by_username || '').localeCompare(b.created_by_username || ''),
      showSorterTooltip: false,
      render: (_, record) => record.created_by_username || t('table.unknown')
    },
    {
      title: t('table.columnStatus'),
      key: 'status',
      width: 150,
      minWidth: 95,
      sorter: (a, b) => Number(a.is_active) - Number(b.is_active),
      showSorterTooltip: false,
      render: (_, record) => getStatusDisplay(record)
    },
    {
      title: t('table.columnActions'),
      key: 'action',
      width: 250,
      minWidth: 55,
      fixed: 'right',
      render: (_, record) => {
        const isOwnerOrAdmin = record.user_id === currentUser?.id || isAdmin;

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/settings/alerts/${record.id}`)}
            >
              {t('detail')}
            </Button>
            {isOwnerOrAdmin && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/settings/alerts/edit/${record.id}`)}
                >
                  {t('edit')}
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                >
                  {t('delete')}
                </Button>
              </>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{
      padding: '24px',
      height: 'calc(100vh - 0px)', // 修改为自适应高度
      overflow: 'auto',
      backgroundColor: '#f0f2f5'
    }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ width: '100%' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          type="text"
        >
          {t('common:button.back')}
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          <BellOutlined /> {t('title')}
        </Title>
      </Space>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Search
              placeholder={t('filter.searchPlaceholder')}
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
              <Select.Option value="all">{t('filter.allStatus')}</Select.Option>
              <Select.Option value="active">{t('filter.enabled')}</Select.Option>
              <Select.Option value="inactive">{t('filter.disabled')}</Select.Option>
            </Select>
            <Select
              value={creatorFilter}
              onChange={setCreatorFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">{t('filter.allCreators')}</Select.Option>
              <Select.Option value="me">{t('filter.createdByMe')}</Select.Option>
            </Select>
          </Space>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAlerts}
              loading={loading}
            >
              {t('refresh')}
            </Button>

            {isAdmin && (
              <Tooltip title={t('tooltip.checkNow')}>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={handleManualTrigger}
                  loading={triggering}
                >
                  {t('button.checkNow')}
                </Button>
              </Tooltip>
            )}

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/settings/alerts/new')}
            >
              {t('create')}
            </Button>
          </Space>
        </Space>

        <AWSStyleTable
          tableId="alert-management"
          columns={columns}
          dataSource={filteredAlerts}
          rowKey="id"
          loading={loading}
          pagination={{
            ...paginationProps,
            total: filteredAlerts.length,
            showTotal: (total) => t('table.total', { count: total }),
          }}
          scroll={{
            x: 1400,
            y: 'calc(100vh - 400px)'
          }}
          sticky={{
            offsetHeader: 0
          }}
        />
      </Card>
      </Space>
    </div>
  );
};
