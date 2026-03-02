import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Alert, Spin } from 'antd';
import { LockOutlined, CloudOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { authApi } from '../../services/api/authApi';
import { getErrorMessage } from '../../utils/ErrorHandler';
import { useI18n } from '../../hooks/useI18n';
import './auth.css';

const { Title, Text, Paragraph } = Typography;

export const Activate: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n('auth');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [activated, setActivated] = useState(false);

  // 页面加载时验证token（可选：如果后端不提供预验证，可以跳过这一步）
  useEffect(() => {
    if (!token) {
      message.error(t('activate.invalidLink'));
      setValidating(false);
      return;
    }

    // 简单验证token格式
    if (token.length < 10) {
      message.error(t('activate.error.invalidLinkFormat'));
      setValidating(false);
      return;
    }

    // 假设token有效，显示表单
    setTokenValid(true);
    setValidating(false);
  }, [token, t]);

  const handleSubmit = async (values: { password: string; confirm_password: string }) => {
    if (!token) {
      message.error(t('activate.error.invalidToken'));
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.activate(token, values.password);

      setEmail(result.email);
      setActivated(true);
      message.success(t('activate.success.activated'));

      // 3秒后跳转到登录页
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, t('activate.error.activationFailed')));
    } finally {
      setLoading(false);
    }
  };

  // 验证中
  if (validating) {
    return (
      <div className="auth-page-wrapper">
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Card style={{ width: 400, textAlign: 'center' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>{t('activate.verifying')}</Paragraph>
          </Card>
        </div>
      </div>
    );
  }

  // Token无效
  if (!tokenValid) {
    return (
      <div className="auth-page-wrapper">
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Card style={{ width: 400 }}>
            <div style={{ textAlign: 'center' }}>
              <CloudOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
              <Title level={4}>{t('activate.invalidLink')}</Title>
              <Paragraph type="secondary">
                {t('activate.invalidLinkDesc')}
              </Paragraph>
              <Button type="primary" onClick={() => navigate('/login')}>
                {t('activate.backToLogin')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 激活成功
  if (activated) {
    return (
      <div className="auth-page-wrapper">
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Card style={{ width: 400 }}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a', marginBottom: '16px' }} />
              <Title level={3}>{t('activate.successTitle')}</Title>
              <Paragraph>
                {t('activate.successDesc')}
              </Paragraph>
              {email && (
                <Paragraph type="secondary">
                  {t('activate.emailLabel')}: {email}
                </Paragraph>
              )}
              <Paragraph type="secondary">
                {t('activate.redirecting')}
              </Paragraph>
              <Button type="primary" onClick={() => navigate('/login')}>
                {t('activate.loginNow')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 显示密码设置表单
  return (
    <div className="auth-page-wrapper">
      {/* 语言切换器 */}
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
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <CloudOutlined style={{ fontSize: '48px', color: '#667eea', marginBottom: '12px' }} />
            <Title level={3} style={{ margin: 0, fontSize: '24px', marginBottom: '8px', fontWeight: 600 }}>
              {t('activate.title')}
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {t('activate.subtitle')}
            </Text>
          </div>

          {/* 提示信息 */}
          <Alert
            message={t('activate.passwordRequirements')}
            description={t('activate.passwordRequirementsDesc')}
            type="info"
            showIcon
            className="auth-alert"
            style={{ marginBottom: '20px' }}
          />

          {/* 密码设置表单 */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            className="auth-form"
          >
            <Form.Item
              label={t('activate.setPassword')}
              name="password"
              rules={[
                { required: true, message: t('activate.validation.passwordRequired') },
                { min: 8, message: t('activate.validation.passwordMin') },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                  message: t('activate.validation.passwordPattern'),
                },
              ]}
              style={{ marginBottom: '18px' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder={t('activate.passwordPlaceholder')}
                autoComplete="new-password"
                size="large"
                style={{
                  height: '48px',
                  fontSize: '15px',
                  borderRadius: '8px'
                }}
              />
            </Form.Item>

            <Form.Item
              label={t('activate.confirmPassword')}
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: t('activate.validation.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('activate.validation.passwordMismatch')));
                  },
                }),
              ]}
              style={{ marginBottom: '20px' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder={t('activate.confirmPasswordPlaceholder')}
                autoComplete="new-password"
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
                {t('activate.activateButton')}
              </Button>
            </Form.Item>

            <div style={{
              textAlign: 'center',
              paddingTop: '16px',
              borderTop: '1px solid #f0f0f0',
              marginTop: '4px'
            }}>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                {t('activate.hasAccount')}{' '}
                <Link to="/login" style={{ color: '#667eea', fontWeight: 500, fontSize: '14px' }}>
                  {t('activate.loginLink')}
                </Link>
              </Text>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};
