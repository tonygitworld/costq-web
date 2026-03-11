// GCP Account Management - GCP 账号管理界面
import { type FC, useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Popconfirm,
  Modal,
  message,
  Typography,
  Empty,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  GoogleOutlined,
  ReloadOutlined,
  EditOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import type { GCPAccount } from '../../types/gcpAccount';
import { AddGCPAccountModal } from './AddGCPAccountModal';
import { EditGCPAccountModal } from './EditGCPAccountModal';
import { usePagination } from '../../hooks/usePagination';
import { useI18n } from '../../hooks/useI18n';
import { AWSStyleTable } from '../common/AWSStyleTable';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CardListView, type CardField, type CardAction } from '../common/CardListView';
import dayjs from 'dayjs';

const { Text } = Typography;

export const GCPAccountManagement: FC = () => {
  const {
    accounts,
    loading,
    fetchAccounts,
    deleteAccount,
    validateAccount
  } = useGCPAccountStore();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<GCPAccount | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const { paginationProps } = usePagination(10);
  const { t } = useI18n(['gcp', 'common']);

  const isMobile = useIsMobile();

  // 加载账号列表
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // 编辑账号
  const handleEdit = (account: GCPAccount) => {
    setSelectedAccount(account);
    setEditModalVisible(true);
  };

  // 删除账号
  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      message.success(t('gcp:account.message.deleteSuccess'));
    } catch {
      message.error(t('gcp:account.message.deleteFailed'));
    }
  };

  // 验证账号
  const handleValidate = async (id: string) => {
    setValidating(id);
    try {
      const isValid = await validateAccount(id);
      if (isValid) {
        message.success(t('gcp:account.message.verifySuccess'));
      } else {
        message.error(t('gcp:account.message.verifyFailed'));
      }
    } catch {
      message.error(t('gcp:account.message.verifyFailed'));
    } finally {
      setValidating(null);
    }
  };

  // 移动端卡片字段配置
  const cardFields: CardField<GCPAccount>[] = [
    { label: t('gcp:account.table.name'), key: 'account_name' },
    { label: t('gcp:account.form.projectId'), key: 'project_id', render: (v) => <Text code>{v}</Text> },
    {
      label: 'Service Account',
      key: 'service_account_email_masked',
      render: (v) => <Text type="secondary" code style={{ fontSize: '12px' }}>{v}</Text>,
    },
    {
      label: t('gcp:account.table.organization'),
      key: 'org_billing',
      render: (_, record: GCPAccount) => {
        const parts: string[] = [];
        if (record.organization_id) parts.push(`Org: ${record.organization_id}`);
        if (record.billing_account_id) parts.push(`Billing: ${record.billing_account_id}`);
        return parts.length > 0
          ? <Text type="secondary" style={{ fontSize: '12px' }}>{parts.join(' / ')}</Text>
          : <Text type="secondary">-</Text>;
      },
    },
    {
      label: 'BigQuery Export',
      key: 'bigquery_export',
      render: (_, record: GCPAccount) => {
        const hasConfig = record.billing_export_project_id ||
                         record.billing_export_dataset ||
                         record.billing_export_table;
        return hasConfig
          ? <Tag color="success" icon={<CheckCircleOutlined />}>{t('common:status.configured')}</Tag>
          : <Tag color="default">{t('common:status.notConfigured')}</Tag>;
      },
    },
    {
      label: t('gcp:account.table.description'),
      key: 'description',
      render: (v) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      label: t('gcp:account.table.createdAt'),
      key: 'created_at',
      render: (v) => <Text type="secondary">{dayjs(v).format('YYYY-MM-DD HH:mm')}</Text>,
    },
    {
      label: t('gcp:account.table.status'),
      key: 'is_verified',
      render: (_, record: GCPAccount) =>
        record.is_verified ? (
          <Tag icon={<CheckCircleOutlined />} color="success">{t('gcp:account.status.verified')}</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="warning">{t('gcp:account.status.unverified')}</Tag>
        ),
    },
  ];

  // 移动端卡片操作配置
  const cardActions: CardAction<GCPAccount>[] = [
    {
      label: t('common:button.edit'),
      icon: <EditOutlined />,
      onClick: (record) => handleEdit(record),
    },
    {
      label: t('gcp:account.action.verify'),
      icon: <ReloadOutlined />,
      onClick: (record) => handleValidate(record.id),
      loading: (record) => validating === record.id,
    },
    {
      label: t('common:button.delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (record) => {
        Modal.confirm({
          title: t('gcp:account.action.confirmDelete'),
          content: t('gcp:account.action.confirmDeleteContent'),
          okText: t('common:button.delete'),
          cancelText: t('common:button.cancel'),
          okButtonProps: { danger: true },
          onOk: () => handleDelete(record.id),
        });
      },
    },
  ];

  // 表格列定义
  const columns: ColumnsType<GCPAccount> = [
    {
      title: t('gcp:account.table.name'),
      dataIndex: 'account_name',
      key: 'account_name',
      width: 200,
      minWidth: 140,
      sorter: (a, b) => (a.account_name || '').localeCompare(b.account_name || ''),
      showSorterTooltip: false,
      render: (name: string, record: GCPAccount) => (
        <Space>
          <GoogleOutlined style={{ color: '#4285F4', fontSize: '16px' }} />
          <Text strong>{name}</Text>
          {record.is_verified && (
            <Tooltip title={t('gcp:account.status.verified')}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('gcp:account.form.projectId'),
      dataIndex: 'project_id',
      key: 'project_id',
      width: 180,
      minWidth: 130,
      sorter: (a, b) => (a.project_id || '').localeCompare(b.project_id || ''),
      showSorterTooltip: false,
      render: (projectId: string) => (
        <Text code>{projectId}</Text>
      ),
    },
    {
      title: 'Service Account',
      dataIndex: 'service_account_email_masked',
      key: 'service_account_email_masked',
      width: 240,
      minWidth: 160,
      sorter: (a, b) => (a.service_account_email_masked || '').localeCompare(b.service_account_email_masked || ''),
      showSorterTooltip: false,
      render: (email: string) => (
        <Tooltip title="Service Account Email">
          <Text type="secondary" code style={{ fontSize: '12px' }}>{email}</Text>
        </Tooltip>
      ),
    },
    {
      title: t('gcp:account.table.organization'),
      key: 'org_billing',
      width: 180,
      minWidth: 130,
      render: (_, record: GCPAccount) => (
        <Space direction="vertical" size={0}>
          {record.organization_id && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Org: {record.organization_id}
            </Text>
          )}
          {record.billing_account_id && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Billing: {record.billing_account_id}
            </Text>
          )}
          {!record.organization_id && !record.billing_account_id && (
            <Text type="secondary">-</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'BigQuery Export',
      key: 'bigquery_export',
      width: 200,
      minWidth: 130,
      render: (_, record: GCPAccount) => {
        const hasConfig = record.billing_export_project_id ||
                         record.billing_export_dataset ||
                         record.billing_export_table;

        if (!hasConfig) {
          return <Tag color="default">{t('common:status.notConfigured')}</Tag>;
        }

        return (
          <Tooltip title={
            <div>
              <div>{t('gcp:account.form.projectId')}: {record.billing_export_project_id || '-'}</div>
              <div>Dataset: {record.billing_export_dataset || '-'}</div>
              <div>{t('gcp:account.form.tableName')}: {record.billing_export_table || '-'}</div>
            </div>
          }>
            <Tag color="success" icon={<CheckCircleOutlined />}>{t('common:status.configured')}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('gcp:account.table.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      minWidth: 80,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
      showSorterTooltip: false,
      render: (description?: string) => (
        <Text type="secondary">{description || '-'}</Text>
      ),
    },
    {
      title: t('gcp:account.table.status'),
      key: 'status',
      width: 110,
      minWidth: 90,
      align: 'center',
      sorter: (a, b) => Number(a.is_verified) - Number(b.is_verified),
      showSorterTooltip: false,
      render: (_, record: GCPAccount) => (
        record.is_verified ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {t('gcp:account.status.verified')}
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="warning">
            {t('gcp:account.status.unverified')}
          </Tag>
        )
      ),
    },
    {
      title: t('gcp:account.table.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      minWidth: 150,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      showSorterTooltip: false,
      render: (createdAt: string) => (
        <Text type="secondary">
          {dayjs(createdAt).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: t('gcp:account.table.actions'),
      key: 'actions',
      width: 200,
      minWidth: 180,
      fixed: 'right',
      render: (_, record: GCPAccount) => (
        <Space size="small">
          <Tooltip title={t('gcp:account.action.edit')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              {t('common:button.edit')}
            </Button>
          </Tooltip>
          <Tooltip title={t('gcp:account.action.verify')}>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={validating === record.id}
              onClick={() => handleValidate(record.id)}
            >
              {t('gcp:account.action.verify')}
            </Button>
          </Tooltip>
          <Popconfirm
            title={t('gcp:account.action.confirmDelete')}
            description={t('gcp:account.action.confirmDeleteContent')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common:button.delete')}
            cancelText={t('common:button.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('common:button.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchAccounts()}
              loading={loading}
            >
              {t('common:button.refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              {t('gcp:account.addButton')}
            </Button>
          </Space>
        </div>

        {accounts.length === 0 && !loading ? (
          <Empty
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">{t('gcp:account.empty.title')}</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('gcp:account.empty.description')}
                </Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '60px 0' }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              {t('gcp:account.addButton')}
            </Button>
          </Empty>
        ) : isMobile ? (
          <CardListView<GCPAccount>
            dataSource={accounts}
            rowKey="id"
            fields={cardFields}
            actions={cardActions}
            loading={loading}
            pagination={{
              ...paginationProps,
              total: accounts.length,
              showTotal: (total) => t('common:pagination.total', { total }),
            }}
          />
        ) : (
          <AWSStyleTable
            tableId="gcp-account-management"
            columns={columns}
            dataSource={accounts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...paginationProps,
              total: accounts.length,
              showTotal: (total) => t('common:pagination.total', { total }),
            }}
            scroll={{
              x: 1600,
              y: 'calc(100vh - 450px)'
            }}
            sticky={{
              offsetHeader: 0
            }}
          />
        )}
      </Card>

      <AddGCPAccountModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSuccess={() => fetchAccounts()}
      />

      <EditGCPAccountModal
        visible={editModalVisible}
        account={selectedAccount}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedAccount(null);
        }}
        onSuccess={() => {
          fetchAccounts();
        }}
      />
    </div>
  );
};
