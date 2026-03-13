import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Tag, Typography, Input, Modal, Form, message, Select, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import { MobilePageHeader } from '../common/MobilePageHeader';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
// useAuthStore - 保留用于未来权限控制扩展
// import { useAuthStore } from '../../stores/authStore';
import { AccountPermissionModal } from './AccountPermissionModal';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePagination } from '../../hooks/usePagination';
import { AWSStyleTable } from '../common/AWSStyleTable';
import { CardListView, type CardField, type CardAction } from '../common/CardListView';
import { apiClient } from '../../services/apiClient';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getErrorMessage } from '../../utils/ErrorHandler';

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title } = Typography;
const { Option } = Select;

interface UserData {
  id: string;
  username: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPermissionModalVisible, setIsPermissionModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const { t } = useI18n(['user', 'common']);
  const { paginationProps } = usePagination(10);
  const isMobile = useIsMobile();

  // 处理返回按钮
  const handleBack = () => {
    if (isMobile) {
      // 手机端：返回到设置页面
      navigate('/settings', { replace: true });
    } else {
      // 桌面端：返回到历史记录或首页
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
  };

  // const { logout } = useAuthStore();

  // 删除用户功能 - 自动刷新 Token

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
      const data = await apiClient.get<UserData[]>('/users/');
      setUsers(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('common:message.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns: ColumnsType<UserData> = [
    {
      title: t('table.username'),
      dataIndex: 'username',
      key: 'username',
      width: 150,
      minWidth: 105,
      sorter: (a, b) => a.username.localeCompare(b.username),
      showSorterTooltip: false,
    },
    {
      title: t('table.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 120,
      minWidth: 95,
      sorter: (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
      showSorterTooltip: false,
      render: (name) => name || t('profile.noValue'),
    },
    {
      title: t('table.role'),
      dataIndex: 'role',
      key: 'role',
      width: 100,
      minWidth: 55,
      sorter: (a, b) => a.role.localeCompare(b.role),
      showSorterTooltip: false,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? t('common:role.admin') : t('common:role.user')}
        </Tag>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      minWidth: 95,
      sorter: (a, b) => Number(a.is_active) - Number(b.is_active),
      showSorterTooltip: false,
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'default'}>
          {is_active ? t('common:status.active') : t('common:status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('common:time.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      minWidth: 100,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      showSorterTooltip: false,
      render: (time: string) => (
        <Typography.Text type="secondary">
          {dayjs(time).format('YYYY-MM-DD HH:mm')}
        </Typography.Text>
      ),
    },
    {
      title: t('table.lastLogin'),
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 220,
      minWidth: 115,
      sorter: (a, b) => {
        const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
        return aTime - bTime;
      },
      showSorterTooltip: false,
      render: (time: string) => {
        if (!time) return <Typography.Text type="secondary">{t('profile.neverLogin')}</Typography.Text>;
        const localTime = dayjs.utc(time).local();
        const timeStr = localTime.format('YYYY/MM/DD HH:mm:ss');
        const tz = localTime.format('Z');
        return <Typography.Text type="secondary">{`${timeStr} (UTC${tz})`}</Typography.Text>;
      },
    },
    {
      title: t('table.actions'),
      key: 'action',
      width: 240,
      minWidth: 55,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('actions.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => handleManagePermissions(record)}
          >
            {t('actions.authorize')}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            {t('actions.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
    setIsModalVisible(true);
  };

  const handleManagePermissions = (user: UserData) => {
    setSelectedUserId(user.id);
    setIsPermissionModalVisible(true);
  };

  const handleDelete = (user: UserData) => {
    modal.confirm({
      title: t('actions.confirmDeleteUser'),
      content: t('actions.confirmDeleteDesc', { username: user.username }),
      okType: 'danger',
      okText: t('common:button.delete'),
      cancelText: t('common:button.cancel'),
      onOk: async () => {
        try {
          // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
          await apiClient.delete(`/users/${user.id}`);
          message.success(t('message.deleteSuccess'));
          fetchUsers();
        } catch (error: unknown) {
          message.error(getErrorMessage(error, t('message.deleteFailed')));
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (editingUser) {
        // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
        await apiClient.put(`/users/${editingUser.id}`, {
          full_name: values.full_name,
          role: values.role,
          is_active: values.is_active,
        });
        message.success(t('message.updateSuccess'));
      } else {
        // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
        await apiClient.post('/users/', values);
        message.success(t('message.createSuccess'));
      }

      setIsModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, t('message.operationFailed')));
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchText.toLowerCase()) ||
    (user.full_name?.toLowerCase().includes(searchText.toLowerCase()))
  );

  // 移动端卡片字段配置
  const cardFields: CardField<UserData>[] = [
    { label: t('table.username'), key: 'username' },
    { label: t('table.fullName'), key: 'full_name', render: (name) => name || t('profile.noValue') },
    {
      label: t('table.role'),
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? t('common:role.admin') : t('common:role.user')}
        </Tag>
      ),
    },
    {
      label: t('common:time.createdAt'),
      key: 'created_at',
      render: (time: string) => (
        <Typography.Text type="secondary">
          {dayjs(time).format('YYYY-MM-DD HH:mm')}
        </Typography.Text>
      ),
    },
    {
      label: t('table.lastLogin'),
      key: 'last_login_at',
      render: (time: string) => {
        if (!time) return <Typography.Text type="secondary">{t('profile.neverLogin')}</Typography.Text>;
        const localTime = dayjs.utc(time).local();
        const timeStr = localTime.format('YYYY/MM/DD HH:mm:ss');
        const tz = localTime.format('Z');
        return <Typography.Text type="secondary">{`${timeStr} (UTC${tz})`}</Typography.Text>;
      },
    },
    {
      label: t('table.status'),
      key: 'is_active',
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'default'}>
          {is_active ? t('common:status.active') : t('common:status.inactive')}
        </Tag>
      ),
    },
  ];

  // 移动端卡片操作配置
  const cardActions: CardAction<UserData>[] = [
    {
      label: t('actions.edit'),
      icon: <EditOutlined />,
      onClick: (record) => handleEdit(record),
    },
    {
      label: t('actions.authorize'),
      icon: <KeyOutlined />,
      onClick: (record) => handleManagePermissions(record),
    },
    {
      label: t('actions.delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (record) => {
        Modal.confirm({
          title: t('actions.confirmDeleteUser'),
          content: t('actions.confirmDeleteDesc', { username: record.username }),
          okType: 'danger',
          okText: t('common:button.delete'),
          cancelText: t('common:button.cancel'),
          onOk: async () => {
            try {
              await apiClient.delete(`/users/${record.id}`);
              message.success(t('message.deleteSuccess'));
              fetchUsers();
            } catch (error: unknown) {
              message.error(getErrorMessage(error, t('message.deleteFailed')));
            }
          },
        });
      },
    },
  ];

  return (
    <div style={{
      padding: isMobile ? 0 : '24px',
      height: isMobile ? '100dvh' : '100vh',
      overflow: isMobile ? 'hidden' : 'auto',
      backgroundColor: isMobile ? '#f5f5f5' : '#f0f2f5',
      display: isMobile ? 'flex' : 'block',
      flexDirection: 'column',
    }}>
      {isMobile ? (
        <>
          {/* 移动端顶部栏 */}
          <MobilePageHeader title={t('management.title')} onBack={handleBack}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder={t('form.searchPlaceholder')}
                prefix={<SearchOutlined style={{ color: '#98a2b3' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="middle"
                style={{ flex: 1, borderRadius: 10, backgroundColor: '#f2f4f7', border: '1px solid transparent', height: 36 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                size="small"
                style={{ borderRadius: 8, height: 36, fontWeight: 500, boxShadow: '0 1px 2px rgba(21, 112, 239, 0.3)' }}
              >
                {t('management.addUser')}
              </Button>
            </div>
          </MobilePageHeader>
          {/* 卡片列表 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <CardListView<UserData>
              dataSource={filteredUsers}
              rowKey="id"
              fields={cardFields}
              actions={cardActions}
              loading={loading}
              pagination={{
                ...paginationProps,
                total: filteredUsers.length,
                showTotal: (total) => t('user:pagination.total', { total }),
              }}
            />
          </div>
        </>
      ) : (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          type="text"
        >
          {t('common:button.back')}
        </Button>

        {/* 标题 */}
        <Title level={3} style={{ marginBottom: -8 }}>{t('management.title')}</Title>

        {/* 操作栏 */}
        <Card>
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Input
                placeholder={t('form.searchPlaceholder')}
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                {t('management.addUser')}
              </Button>
            </Space>

            <AWSStyleTable
              tableId="user-management"
              columns={columns}
              dataSource={filteredUsers}
              rowKey="id"
              loading={loading}
              pagination={{
                ...paginationProps,
                total: filteredUsers.length,
                showTotal: (total) => t('user:pagination.total', { total }),
              }}
              scroll={{
                x: 1300,
                y: 'calc(100vh - 400px)'
              }}
              sticky={{
                offsetHeader: 0
              }}
            />
        </Card>
      </Space>
      )}

      {/* 添加/编辑用户弹窗 */}
      <Modal
        title={editingUser ? t('form.editUser') : t('form.addUser')}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        okText={t('common:button.save')}
        cancelText={t('common:button.cancel')}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ is_active: true, role: 'user' }}
          autoComplete="off"
        >
          {!editingUser && (
            <>
              <Form.Item
                label={t('profile.username')}
                name="username"
                rules={[
                  { required: true, message: t('form.validation.usernameRequired') },
                  { type: 'email', message: t('form.validation.emailInvalid') },
                ]}
                extra={t('form.activationEmailHint')}
              >
                <Input
                  placeholder={t('form.emailPlaceholder')}
                  autoComplete="off"
                  type="email"
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            label={t('profile.fullName')}
            name="full_name"
          >
            <Input placeholder={t('form.fullNamePlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('profile.role')}
            name="role"
            rules={[{ required: true, message: t('form.validation.roleRequired') }]}
          >
            <Select placeholder={t('form.selectRole')}>
              <Option value="admin">{t('common:role.admin')}</Option>
              <Option value="user">{t('common:role.user')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={t('profile.accountStatus')}
            name="is_active"
            rules={[{ required: true, message: t('form.validation.roleRequired') }]}
          >
            <Select placeholder={t('form.selectStatus')}>
              <Option value={true}>{t('common:status.active')}</Option>
              <Option value={false}>{t('common:status.inactive')}</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 云账号授权弹窗 */}
      {selectedUserId && (
        <AccountPermissionModal
          visible={isPermissionModalVisible}
          userId={selectedUserId}
          onCancel={() => {
            setIsPermissionModalVisible(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
};
