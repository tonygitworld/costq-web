import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, App } from 'antd';
import { UserOutlined, LockOutlined, CloudOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { UnauthorizedError, ForbiddenError } from '../../services/errors';
import { useI18n } from '../../hooks/useI18n';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import './auth.css';

const { Title, Text } = Typography;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(state => state.login);
  const { loadFromStorage } = useChatStore();
  const { t } = useI18n('auth');
  const { message, modal } = App.useApp();

  // ✅ 新增：错误信息状态（持久化显示）
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    description?: string;
    type: 'error' | 'warning';
  } | null>(null);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setErrorInfo(null); // ✅ 清除之前的错误信息

    try {
      await login(values.email, values.password);

      // ✅ 登录成功后，加载用户数据
      // 1. 加载聊天记录
      await loadFromStorage();
      
      // 2. 加载账号数据（确保账号选择器有数据可用）
      const { fetchAccounts: fetchAWSAccounts } = useAccountStore.getState();
      const { fetchAccounts: fetchGCPAccounts } = useGCPAccountStore.getState();
      await Promise.all([
        fetchAWSAccounts().catch(err => console.warn('登录后加载 AWS 账号失败:', err)),
        fetchGCPAccounts().catch(err => console.warn('登录后加载 GCP 账号失败:', err))
      ]);

      message.success(t('login.success.login'));
      navigate('/');
    } catch (error: any) {
      // ✅ 检查是否为租户未激活错误
      const errorCode = error?.response?.data?.detail?.error_code;

      if (errorCode === 'TENANT_INACTIVE') {
        modal.warning({
          title: '账号审核中',
          content: error?.response?.data?.detail?.message || '你的账号正在审核中，审核通过后即可登录。如有疑问请联系管理员。',
          okText: '我知道了'
        });
        return;
      }

      if (errorCode === 'USER_DISABLED' || errorCode === 'ACCOUNT_DISABLED') {
        modal.error({
          title: '账号已被禁用',
          content: '你的账号已被管理员禁用，请联系管理员。',
          okText: '我知道了'
        });
        return;
      }

      // ✅ 保留原有的 toast 提示（快速反馈）
      message.error(error instanceof Error ? error.message : t('login.errors.loginFailed'));

      // ✅ 新增：持久化的 Alert 提示（详细说明）
      if (error instanceof UnauthorizedError) {
        setErrorInfo({
          message: t('login.errors.loginFailed'),
          description: t('login.errors.invalidCredentials'),
          type: 'error'
        });
      } else if (error instanceof ForbiddenError) {
        setErrorInfo({
          message: t('login.errors.accountDisabled'),
          description: t('login.errors.accountDisabledDesc'),
          type: 'warning'
        });
      } else if (error instanceof Error) {
        setErrorInfo({
          message: t('login.errors.loginFailed'),
          description: error.message || t('login.errors.networkError'),
          type: 'error'
        });
      } else {
        setErrorInfo({
          message: t('login.errors.loginFailed'),
          description: t('login.errors.unknownError'),
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* 语言切换器 - 右上角 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '6px 12px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}>
          <LanguageSwitcher
            showIcon={false}
            showText={true}
          />
        </div>
      </div>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Card
        style={{
          width: '100%',
          maxWidth: '500px',
          margin: '0 auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          borderRadius: '16px',
          padding: '24px',
        }}
        styles={{ body: { padding: 0 } }}
      >
          {/* Logo 和标题 */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <CloudOutlined style={{ fontSize: '48px', color: '#667eea', marginBottom: '12px' }} />
            <Title level={3} style={{ margin: 0, fontSize: '24px', marginBottom: '8px', fontWeight: 600 }}>
              {t('login.title')}
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>{t('login.subtitle')}</Text>
          </div>

        {/* 登录表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          className="auth-form"
        >
          {/* ✅ 新增：错误信息 Alert（持久显示，用户可关闭） */}
          {errorInfo && (
            <Alert
              message={errorInfo.message}
              description={errorInfo.description}
              type={errorInfo.type}
              showIcon
              closable
              onClose={() => setErrorInfo(null)}
              className="auth-alert"
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('login.validation.emailRequired') },
              { type: 'email', message: t('login.validation.emailInvalid') },
            ]}
            style={{ marginBottom: '20px' }}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="email"
              size="large"
              style={{
                height: '48px',
                fontSize: '15px',
                borderRadius: '8px'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('login.validation.passwordRequired') },
            ]}
            style={{ marginBottom: '24px' }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              size="large"
              style={{
                height: '48px',
                fontSize: '15px',
                borderRadius: '8px'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '0' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: 500,
                borderRadius: '8px',
                marginBottom: '20px'
              }}
            >
              {t('login.submitButton')}
            </Button>
          </Form.Item>

          <div style={{
            textAlign: 'center',
            paddingTop: '16px',
            borderTop: '1px solid #f0f0f0',
            marginTop: '4px'
          }}>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {t('login.noAccount')}{' '}
              <Link to="/register" style={{ color: '#667eea', fontWeight: 500, fontSize: '14px' }}>
                {t('login.registerLink')}
              </Link>
            </Text>
          </div>
        </Form>
        </Card>
      </div>
    </div>
  );
};
