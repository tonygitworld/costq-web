import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Alert, Result } from 'antd';
import { UserOutlined, LockOutlined, CloudOutlined, TeamOutlined, IdcardOutlined, MailOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { authApi } from '../../services/api/authApi';
import { getErrorMessage } from '../../utils/ErrorHandler';
import './auth.css';

// 表单验证错误类型
interface FormValidationError {
  errorFields?: unknown[];
}

const { Title, Text } = Typography;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false); // ✅ 注册成功状态
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const register = useAuthStore(state => state.register);
  const { t } = useI18n('auth');

  // 组件卸载时清理timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // 发送验证码
  const handleSendCode = async () => {
    try {
      // 验证邮箱字段
      await form.validateFields(['email']);
      const email = form.getFieldValue('email');

      setSendingCode(true);
      await authApi.sendVerificationCode(email);

      message.success('验证码已发送到您的邮箱');

      // 清理旧的timer（防止多次点击创建多个timer）
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // 开始倒计时（60秒）
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // 倒计时结束，清理timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: unknown) {
      const formError = error as FormValidationError;
      if (formError.errorFields) {
        // 表单验证错误
        message.error('请输入有效的邮箱地址');
      } else {
        message.error(getErrorMessage(error, '发送验证码失败'));
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (values: {
    org_name: string;
    email: string;
    password: string;
    full_name?: string;
    verification_code: string;
  }) => {
    setLoading(true);
    try {
      const response = await register(
        values.org_name,
        values.email,
        values.password,
        values.full_name || undefined,
        values.verification_code
      );

      // ✅ 检查是否需要激活（租户审核）
      if (response?.requires_activation === true) {
        // 租户未激活：切换到成功状态页面
        setRegistrationSuccess(true);
      } else {
        // 租户已激活：直接跳转到控制台
        message.success(t('register.success.register'));
        navigate('/');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('register.errors.registerFailed'));
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
          {registrationSuccess ? (
            <Result
              status="success"
              title={
                <div style={{ fontSize: '28px', fontWeight: 600, color: '#1f1f1f', marginBottom: '12px' }}>
                  注册申请已提交
                </div>
              }
              subTitle={
                <div style={{ textAlign: 'center', fontSize: '16px', lineHeight: '1.8', color: '#666' }}>
                  <p style={{ marginBottom: '4px' }}>您的账号正在审核中。</p>
                  <p style={{ marginBottom: '4px' }}>审核通过后，我们将发送邮件通知您。</p>
                  <p style={{ marginBottom: 0 }}>请耐心等待。</p>
                </div>
              }
              extra={[
                <Button
                  type="primary"
                  key="login"
                  onClick={() => navigate('/login')}
                  style={{
                    height: '48px',
                    padding: '0 48px',
                    fontSize: '18px',
                    fontWeight: 500,
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    marginTop: '24px',
                    boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
                  }}
                >
                  返回登录
                </Button>,
              ]}
            />
          ) : (
            <>
              {/* Logo 和标题 */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <CloudOutlined style={{ fontSize: '48px', color: '#667eea', marginBottom: '12px' }} />
            <Title level={3} style={{ margin: 0, fontSize: '24px', marginBottom: '8px', fontWeight: 600 }}>
              {t('register.title')}
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>{t('register.subtitle')}</Text>
          </div>

          {/* 提示信息 */}
          <Alert
            message={t('register.infoTitle')}
            description={t('register.infoDescription')}
            type="info"
            showIcon
            className="auth-alert"
            style={{ marginBottom: '20px' }}
          />

        {/* 注册表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          className="auth-form"
        >
          <Form.Item
            label={t('register.orgName')}
            name="org_name"
            rules={[
              { required: true, message: t('register.validation.orgNameRequired') },
              { min: 2, message: t('register.validation.orgNameMin') },
              { max: 100, message: t('register.validation.orgNameMax') },
            ]}
            style={{ marginBottom: '18px' }}
          >
            <Input
              prefix={<TeamOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('register.orgNamePlaceholder')}
              size="large"
              style={{
                height: '48px',
                fontSize: '15px',
                borderRadius: '8px'
              }}
            />
          </Form.Item>

          <Form.Item
            label={t('register.email')}
            name="email"
            rules={[
              { required: true, message: t('register.validation.emailRequired') },
              { type: 'email', message: t('register.validation.emailInvalid') },
            ]}
            style={{ marginBottom: '18px' }}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('register.emailPlaceholder')}
              autoComplete="email"
              size="large"
              style={{
                height: '48px',
                fontSize: '15px',
                borderRadius: '8px'
              }}
            />
          </Form.Item>


          {/* ✅ 新增：验证码输入框 */}
          <Form.Item
            label="邮箱验证码"
            name="verification_code"
            rules={[
              { required: true, message: '请输入邮箱验证码' },
              { len: 6, message: '验证码为6位数字' },
              { pattern: /^\d{6}$/, message: '验证码必须是6位数字' },
            ]}
            style={{ marginBottom: '18px' }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Input
                prefix={<MailOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="请输入6位验证码"
                maxLength={6}
                size="large"
                style={{
                  height: '48px',
                  fontSize: '15px',
                  borderRadius: '8px',
                  flex: 1,
                }}
              />
              <Button
                type="primary"
                onClick={handleSendCode}
                loading={sendingCode}
                disabled={countdown > 0}
                size="large"
                style={{
                  height: '48px',
                  minWidth: '120px',
                  borderRadius: '8px',
                }}
              >
                {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
              </Button>
            </div>
          </Form.Item>
          <Form.Item
            label={t('register.fullName')}
            name="full_name"
            style={{ marginBottom: '18px' }}
          >
            <Input
              prefix={<IdcardOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('register.fullNamePlaceholder')}
              size="large"
              style={{
                height: '48px',
                fontSize: '15px',
                borderRadius: '8px'
              }}
            />
          </Form.Item>

          <Form.Item
            label={t('register.password')}
            name="password"
            rules={[
              { required: true, message: t('register.validation.passwordRequired') },
              { min: 8, message: t('register.validation.passwordMin') },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                message: t('register.validation.passwordPattern'),
              },
            ]}
            style={{ marginBottom: '18px' }}
            extra={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>{t('register.passwordHint')}</span>}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('register.passwordPlaceholder')}
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
            label={t('register.confirmPassword')}
            name="confirm_password"
            dependencies={['password']}
            rules={[
              { required: true, message: t('register.validation.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('register.validation.passwordMismatch')));
                },
              }),
            ]}
            style={{ marginBottom: '20px' }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
              placeholder={t('register.confirmPasswordPlaceholder')}
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
              {t('register.submitButton')}
            </Button>
          </Form.Item>

          <div style={{
            textAlign: 'center',
            paddingTop: '16px',
            borderTop: '1px solid #f0f0f0',
            marginTop: '4px'
          }}>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {t('register.hasAccount')}{' '}
              <Link to="/login" style={{ color: '#667eea', fontWeight: 500, fontSize: '14px' }}>
                {t('register.loginLink')}
              </Link>
            </Text>
          </div>
        </Form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
