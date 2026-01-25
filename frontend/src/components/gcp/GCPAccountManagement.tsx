// GCP Account Management - GCP 账号管理界面
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
      message.success('GCP 账号删除成功');
    } catch (error) {
      message.error('删除 GCP 账号失败');
    }
  };

  // 验证账号
  const handleValidate = async (id: string) => {
    setValidating(id);
    try {
      const isValid = await validateAccount(id);
      if (isValid) {
        message.success('GCP 凭证验证成功');
      } else {
        message.error('GCP 凭证验证失败，请检查 Service Account 是否有效');
      }
    } catch (error) {
      message.error('验证失败');
    } finally {
      setValidating(null);
    }
  };

  // 表格列定义
  const columns: ColumnsType<GCPAccount> = [
    {
      title: '账号名称',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 200,
      render: (name: string, record: GCPAccount) => (
        <Space>
          <GoogleOutlined style={{ color: '#4285F4', fontSize: '16px' }} />
          <Text strong>{name}</Text>
          {record.is_verified && (
            <Tooltip title="凭证已验证">
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'GCP 项目 ID',
      dataIndex: 'project_id',
      key: 'project_id',
      width: 180,
      render: (projectId: string) => (
        <Text code>{projectId}</Text>
      ),
    },
    {
      title: 'Service Account',
      dataIndex: 'service_account_email_masked',
      key: 'service_account_email_masked',
      width: 220,
      render: (email: string) => (
        <Tooltip title="Service Account Email">
          <Text type="secondary" code style={{ fontSize: '12px' }}>{email}</Text>
        </Tooltip>
      ),
    },
    {
      title: '组织/计费账号',
      key: 'org_billing',
      width: 180,
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
      render: (_, record: GCPAccount) => {
        const hasConfig = record.billing_export_project_id ||
                         record.billing_export_dataset ||
                         record.billing_export_table;

        if (!hasConfig) {
          return <Tag color="default">未配置</Tag>;
        }

        return (
          <Tooltip title={
            <div>
              <div>项目: {record.billing_export_project_id || '-'}</div>
              <div>Dataset: {record.billing_export_dataset || '-'}</div>
              <div>表: {record.billing_export_table || '-'}</div>
            </div>
          }>
            <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
          </Tooltip>
        );
      },
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
      title: '状态',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_, record: GCPAccount) => (
        record.is_verified ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已验证
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="warning">
            未验证
          </Tag>
        )
      ),
    },
    {
      title: '创建时间',
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
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record: GCPAccount) => (
        <Space size="small">
          <Tooltip title="编辑账号">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="验证凭证">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={validating === record.id}
              onClick={() => handleValidate(record.id)}
            >
              验证
            </Button>
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 GCP 账号 "${record.account_name}" 吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
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
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              添加账号
            </Button>
          </Space>
        </div>

        {accounts.length === 0 && !loading ? (
          <Empty
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">暂无 GCP 账号</Text>
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
              添加第一个 GCP 账号
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
            scroll={{ x: 1400 }}
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
