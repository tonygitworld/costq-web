// Account Management - AWS 账号管理界面
import { type FC, useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Popconfirm,
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

  // 表格列定义
  const columns: ColumnsType<AWSAccount> = [
    {
      title: t('table.alias'),
      dataIndex: 'alias',
      key: 'alias',
      width: 200,
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
      width: 150,
      render: (accountId: string) => (
        <Text code>{accountId || 'N/A'}</Text>
      ),
    },
    {
      title: t('table.authType'),
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 120,
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
      width: 120,
      render: (region: string) => (
        <Tag color="blue">{region}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description?: string) => (
        <Text type="secondary">{description || '-'}</Text>
      ),
    },
    {
      title: t('table.status'),
      key: 'status',
      width: 100,
      align: 'center',
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
      render: (createdAt: string) => (
        <Text type="secondary">
          {dayjs(createdAt).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 150,
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
                <Text type="secondary">暂无 AWS 账号</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  点击"添加账号"按钮开始添加
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
              添加第一个账号
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={accounts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...paginationProps,
              total: accounts.length,
              showTotal: (total) => `共 ${total} 个账号`,
            }}
            scroll={{
              x: 1200,
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
