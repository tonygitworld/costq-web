import React from 'react';
import { Card, Form, Input, Button, Space, Typography, App } from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { apiClient } from '../../services/apiClient';
import { getErrorMessage } from '../../utils/ErrorHandler';
import { MobilePageHeader } from '../common/MobilePageHeader';

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

  // ========== 移动端布局 ==========
  if (isMobile) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
      }}>
        {/* 顶部栏 */}
        <MobilePageHeader title={t('changePassword.title')} onBack={handleBack} />

        {/* 可滚动内容 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', paddingBottom: 'max(100px, calc(env(safe-area-inset-bottom) + 80px))' }}>
          <Card style={{ borderRadius: 12, border: '1px solid #eaecf0', boxShadow: '0 1px 3px rgba(16,24,40,0.06)' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
            >
              <Form.Item
                label={t('changePassword.currentPassword')}
                name="oldPassword"
                rules={[{ required: true, message: t('changePassword.validation.currentPasswordRequired') }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('changePassword.currentPasswordPlaceholder')}
                />
              </Form.Item>

              <Form.Item
                label={t('changePassword.newPassword')}
                name="newPassword"
                rules={[
                  { required: true, message: t('changePassword.validation.newPasswordRequired') },
                  { min: 8, message: t('changePassword.validation.newPasswordMin') },
                  { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: t('changePassword.validation.newPasswordPattern') }
                ]}
                extra={t('changePassword.passwordHint')}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('changePassword.newPasswordPlaceholder')}
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
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                      return Promise.reject(new Error(t('changePassword.validation.passwordMismatch')));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('changePassword.confirmPasswordPlaceholder')}
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 8, marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    {t('changePassword.submitButton')}
                  </Button>
                  <Button onClick={() => form.resetFields()}>
                    {t('common:button.reset')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    );
  }

  // ========== 桌面端布局 ==========
  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} type="text">
          {t('common:button.back')}
        </Button>
        <Title level={3}>{t('changePassword.title')}</Title>
        <Card>
          <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
            <Form.Item
              label={t('changePassword.currentPassword')}
              name="oldPassword"
              rules={[{ required: true, message: t('changePassword.validation.currentPasswordRequired') }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('changePassword.currentPasswordPlaceholder')} size="large" />
            </Form.Item>
            <Form.Item
              label={t('changePassword.newPassword')}
              name="newPassword"
              rules={[
                { required: true, message: t('changePassword.validation.newPasswordRequired') },
                { min: 8, message: t('changePassword.validation.newPasswordMin') },
                { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: t('changePassword.validation.newPasswordPattern') }
              ]}
              extra={t('changePassword.passwordHint')}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('changePassword.newPasswordPlaceholder')} size="large" />
            </Form.Item>
            <Form.Item
              label={t('changePassword.confirmPassword')}
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('changePassword.validation.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                    return Promise.reject(new Error(t('changePassword.validation.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('changePassword.confirmPasswordPlaceholder')} size="large" />
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
