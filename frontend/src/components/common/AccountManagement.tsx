// Account Management - AWS 账号管理界面
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
  CloudOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAccountStore, type AWSAccount } from '../../stores/accountStore';
import { AuthType } from '../../types/awsAccount';
import { AddAccountModal } from './AddAccountModal';
import { useI18n } from '../../hooks/useI18n';
import { usePagination } from '../../hooks/usePagination';
import { AWSStyleTable } from './AWSStyleTable';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CardListView, type CardField, type CardAction } from './CardListView';
import dayjs from 'dayjs';

const { Text } = Typography;

export const AccountManagement: FC = () => {
  const {
    accounts,
    loading,
    fetchAccounts,
    deleteAccount,
    validateAccount
  } = useAccountStore();
  const { t } = useI18n('account');
  const { paginationProps } = usePagination(10);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  const isMobile = useIsMobile();

  // 加载账号列表
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // 删除账号
  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      message.success(t('aws.message.deleteSuccess'));
    } catch {
      message.error(t('aws.message.deleteFailed'));
    }
  };

  // 验证账号
  const handleValidate = async (id: string) => {
    setValidating(id);
    try {
      const isValid = await validateAccount(id);
      if (isValid) {
        message.success(t('aws.message.validateSuccess'));
      } else {
        message.error(t('aws.message.validateFailed'));
      }
    } catch {
      message.error(t('aws.message.validateFailed'));
    } finally {
      setValidating(null);
    }
  };

  // 移动端卡片字段配置
  const cardFields: CardField<AWSAccount>[] = [
    { label: t('table.alias'), key: 'alias' },
    { label: t('aws.accountId'), key: 'account_id', render: (v) => <Text code>{v || 'N/A'}</Text> },
    {
      label: t('table.authType'),
      key: 'auth_type',
      render: (v: AuthType) =>
        v === 'iam_role' ? (
          <Tag color="green">{t('aws.authTypes.iam_role')}</Tag>
        ) : (
          <Tag color="blue">{t('aws.authTypes.access_key')}</Tag>
        ),
    },
    {
      label: t('table.credential'),
      key: 'credential',
      render: (_, record: AWSAccount) =>
        record.auth_type === 'iam_role' ? (
          <Text type="secondary" code style={{ fontSize: '12px' }}>
            {record.role_arn ? record.role_arn.split('/').pop() : 'N/A'}
          </Text>
        ) : (
          <Text type="secondary" code style={{ fontSize: '12px' }}>{record.access_key_id_masked || 'N/A'}</Text>
        ),
    },
    { label: t('table.region'), key: 'region', render: (v) => <Tag color="blue">{v}</Tag> },
    {
      label: t('table.description'),
      key: 'description',
      render: (v) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      label: t('table.createdAt'),
      key: 'created_at',
      render: (v) => <Text type="secondary">{dayjs(v).format('YYYY-MM-DD HH:mm')}</Text>,
    },
    {
      label: t('table.status'),
      key: 'is_verified',
      render: (_, record: AWSAccount) =>
        record.is_verified ? (
          <Tag icon={<CheckCircleOutlined />} color="success">{t('aws.status.valid')}</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="warning">{t('aws.status.unknown')}</Tag>
        ),
    },
  ];

  // 移动端卡片操作配置
  const cardActions: CardAction<AWSAccount>[] = [
    {
      label: t('table.validate'),
      icon: <ReloadOutlined />,
      onClick: (record) => handleValidate(record.id),
      loading: (record) => validating === record.id,
    },
    {
      label: t('table.delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (record) => {
        Modal.confirm({
          title: t('common:message.confirmDelete'),
          content: `${t('management.deleteAccount')} "${record.alias}"?`,
          okText: t('common:button.delete'),
          cancelText: t('common:button.cancel'),
          okButtonProps: { danger: true },
          onOk: () => handleDelete(record.id),
        });
      },
    },
  ];

  // 表格列定义
  const columns: ColumnsType<AWSAccount> = [
    {
      title: t('table.alias'),
      dataIndex: 'alias',
      key: 'alias',
      width: 200,
      minWidth: 140,
      sorter: (a, b) => (a.alias || '').localeCompare(b.alias || ''),
      showSorterTooltip: false,
      render: (alias: string, record: AWSAccount) => (
        <Space>
          <CloudOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
          <Text strong>{alias}</Text>
          {record.is_verified && (
            <Tooltip title={t('aws.status.valid')}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('aws.accountId'),
      dataIndex: 'account_id',
      key: 'account_id',
      width: 180,
      minWidth: 150,
      sorter: (a, b) => (a.account_id || '').localeCompare(b.account_id || ''),
      showSorterTooltip: false,
      render: (accountId: string) => (
        <Text code>{accountId || 'N/A'}</Text>
      ),
    },
    {
      title: t('table.authType'),
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 130,
      minWidth: 100,
      sorter: (a, b) => (a.auth_type || '').localeCompare(b.auth_type || ''),
      showSorterTooltip: false,
      render: (authType: AuthType) => (
        authType === 'iam_role' ? (
          <Tag color="green">{t('aws.authTypes.iam_role')}</Tag>
        ) : (
          <Tag color="blue">{t('aws.authTypes.access_key')}</Tag>
        )
      ),
    },
    {
      title: t('table.credential'),
      key: 'credential',
      width: 200,
      minWidth: 140,
      sorter: (a, b) => {
        const aVal = a.auth_type === 'iam_role' ? (a.role_arn || '') : (a.access_key_id_masked || '');
        const bVal = b.auth_type === 'iam_role' ? (b.role_arn || '') : (b.access_key_id_masked || '');
        return aVal.localeCompare(bVal);
      },
      showSorterTooltip: false,
      render: (_, record: AWSAccount) => (
        record.auth_type === 'iam_role' ? (
          <Tooltip title={record.role_arn}>
            <Text type="secondary" code ellipsis>
              {record.role_arn ? `${record.role_arn.split('/').pop()}` : 'N/A'}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary" code>{record.access_key_id_masked || 'N/A'}</Text>
        )
      ),
    },
    {
      title: t('table.region'),
      dataIndex: 'region',
      key: 'region',
      width: 150,
      minWidth: 130,
      sorter: (a, b) => (a.region || '').localeCompare(b.region || ''),
      showSorterTooltip: false,
      render: (region: string) => (
        <Tag color="blue">{region}</Tag>
      ),
    },
    {
      title: t('table.description'),
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
      title: t('table.status'),
      key: 'status',
      width: 110,
      minWidth: 90,
      align: 'center',
      sorter: (a, b) => Number(a.is_verified) - Number(b.is_verified),
      showSorterTooltip: false,
      render: (_, record: AWSAccount) => (
        record.is_verified ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {t('aws.status.valid')}
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="warning">
            {t('aws.status.unknown')}
          </Tag>
        )
      ),
    },
    {
      title: t('table.createdAt'),
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
      title: t('table.actions'),
      key: 'actions',
      width: 160,
      minWidth: 140,
      fixed: 'right',
      render: (_, record: AWSAccount) => (
        <Space size="small">
          <Tooltip title={t('management.validateCredentials')}>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={validating === record.id}
              onClick={() => handleValidate(record.id)}
            >
              {t('table.validate')}
            </Button>
          </Tooltip>
          <Popconfirm
            title={t('common:message.confirmDelete')}
            description={`${t('management.deleteAccount')} "${record.alias}"?`}
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
              {t('table.delete')}
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
              {t('management.addAccount')}
            </Button>
          </Space>
        </div>

        {accounts.length === 0 && !loading ? (
          <Empty
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">{t('aws.empty.noAccounts')}</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('aws.empty.hint')}
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
              {t('aws.empty.addFirst')}
            </Button>
          </Empty>
        ) : isMobile ? (
          <CardListView<AWSAccount>
            dataSource={accounts}
            rowKey="id"
            fields={cardFields}
            actions={cardActions}
            loading={loading}
            pagination={{
              ...paginationProps,
              total: accounts.length,
              showTotal: (total) => t('management.accountCount', { count: total }),
            }}
          />
        ) : (
          <AWSStyleTable
            tableId="aws-account-management"
            columns={columns}
            dataSource={accounts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...paginationProps,
              total: accounts.length,
              showTotal: (total) => t('management.accountCount', { count: total }),
            }}
            scroll={{
              x: 1400,
              y: 'calc(100vh - 450px)'
            }}
            sticky={{
              offsetHeader: 0
            }}
          />
        )}
      </Card>

      <AddAccountModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSuccess={() => fetchAccounts()}
      />
    </div>
  );
};
