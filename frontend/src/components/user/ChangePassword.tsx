import React from 'react';
import { Card, Form, Input, Button, Space, Typography, App } from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { apiClient } from '../../services/apiClient';
import { getErrorMessage } from '../../utils/ErrorHandler';

const { Title } = Typography;

// 密码表单值类型
interface PasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const { logout } = useAuthStore();
  const { t } = useI18n(['user', 'common']);
  const { modal, message } = App.useApp();

  const handleSubmit = async (values: PasswordFormValues) => {
    setLoading(true);
    try {
      // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
      await apiClient.put('/profile/change-password', {
        old_password: values.oldPassword,
        new_password: values.newPassword,
      });

      // 提示用户重新登录
      modal.success({
        title: t('changePassword.modal.successTitle'),
        content: t('changePassword.modal.successContent'),
        okText: t('changePassword.modal.successOkText'),
        centered: true,
        onOk: () => {
          form.resetFields();
          logout();
          navigate('/login');
        },
      });
    } catch (error: unknown) {
      message.error(getErrorMessage(error, t('changePassword.message.changeFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/chat')}
          type="text"
        >
          {t('common:button.back')}
        </Button>

        {/* 标题 */}
        <Title level={3}>{t('changePassword.title')}</Title>

        {/* 修改密码表单 */}
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              label={t('changePassword.currentPassword')}
              name="oldPassword"
              rules={[
                { required: true, message: t('changePassword.validation.currentPasswordRequired') }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('changePassword.currentPasswordPlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={t('changePassword.newPassword')}
              name="newPassword"
              rules={[
                { required: true, message: t('changePassword.validation.newPasswordRequired') },
                { min: 8, message: t('changePassword.validation.newPasswordMin') },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                  message: t('changePassword.validation.newPasswordPattern')
                }
              ]}
              extra={t('changePassword.passwordHint')}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('changePassword.newPasswordPlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={t('changePassword.confirmPassword')}
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('changePassword.validation.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('changePassword.validation.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('changePassword.confirmPasswordPlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginTop: '24px' }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading} size="large">
                  {t('changePassword.submitButton')}
                </Button>
                <Button onClick={() => form.resetFields()} size="large">
                  {t('common:button.reset')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};
