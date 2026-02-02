import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Input, Modal, Form, message, Select, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
// useAuthStore - 保留用于未来权限控制扩展
// import { useAuthStore } from '../../stores/authStore';
import { AccountPermissionModal } from './AccountPermissionModal';
import { useI18n } from '../../hooks/useI18n';
import { usePagination } from '../../hooks/usePagination';
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
    },
    {
      title: t('table.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 120,
      render: (name) => name || t('profile.noValue'),
    },
    {
      title: t('table.role'),
      dataIndex: 'role',
      key: 'role',
      width: 100,
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
      width: 100,
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
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: t('table.lastLogin'),
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 220,
      render: (time: string) => {
        if (!time) return t('profile.neverLogin');
        // UTC时间转换为浏览器本地时区
        const localTime = dayjs.utc(time).local();
        const timeStr = localTime.format('YYYY/MM/DD HH:mm:ss');
        const timezone = localTime.format('Z'); // 时区偏移，如 +08:00
        return `${timeStr} (UTC${timezone})`;
      },
    },
    {
      title: t('table.actions'),
      key: 'action',
      width: 240,
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

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          type="text"
        >
          {t('common:button.back')}
        </Button>

        {/* 标题 */}
        <Title level={3}>{t('management.title')}</Title>

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

          {/* 用户列表 */}
          <Table
            columns={columns}
            dataSource={filteredUsers}
            rowKey="id"
            loading={loading}
            pagination={{
              ...paginationProps,
              total: filteredUsers.length,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Space>

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
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
                extra="用户将收到激活邮件，需通过邮件链接设置密码"
              >
                <Input
                  placeholder="请输入用户邮箱地址"
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
