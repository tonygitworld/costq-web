import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, App as AntdApp } from 'antd';
import { Mail, Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { UnauthorizedError, ForbiddenError, ApiClientError } from '../../services/errors';
import { useI18n } from '../../hooks/useI18n';
import { AuthLayout } from './AuthLayout';
import { FormCard } from './FormCard';
import styles from './EnterpriseLogin.module.css';

const EnterpriseLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const login = useAuthStore((state) => state.login);
  const { t } = useI18n('auth');
  const { message, modal } = AntdApp.useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
      if (emailInput) emailInput.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(async (values: { email: string; password: string }) => {
    setHasSubmitted(true);
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success(t('login.success.login'));
      navigate('/chat');
    } catch (error: unknown) {
      // 通过 ApiClientError.code 判断错误类型
      const errorCode = error instanceof ApiClientError ? error.code : undefined;

      if (errorCode === 'TENANT_INACTIVE') {
        modal.warning({
          title: t('login.errors.tenantInactive'),
          content: error instanceof Error ? error.message : t('login.errors.tenantInactiveDesc'),
          okText: t('login.errors.understood'),
        });
        return;
      }

      if (errorCode === 'USER_DISABLED' || errorCode === 'ACCOUNT_DISABLED') {
        modal.error({
          title: t('login.errors.accountDisabled'),
          content: t('login.errors.accountDisabledDesc'),
          okText: t('login.errors.understood'),
        });
        return;
      }

      if (error instanceof ForbiddenError) {
        message.error(t('login.errors.accountDisabled'));
      } else if (error instanceof UnauthorizedError) {
        message.error(t('login.errors.invalidCredentials'));
      } else {
        message.error(error instanceof Error ? error.message : t('login.errors.loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [login, navigate, t, message, modal]);

  return (
    <AuthLayout>
      <FormCard>
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>{t('login.welcomeTitle')}</h2>
          <p className={styles.formSubtitle}>{t('login.welcomeSubtitle')}</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          className={styles.loginForm}
          validateTrigger={hasSubmitted ? "onChange" : "onSubmit"}
        >
          <Form.Item
            label={t('login.emailLabel')}
            name="email"
            rules={[
              { required: true, message: t('login.validation.emailRequired') },
              { type: 'email', message: t('login.validation.emailInvalid') },
            ]}
          >
            <Input
              prefix={<Mail size={18} className={styles.inputIcon} />}
              placeholder={t('login.emailPlaceholder')}
              size="large"
              className={styles.formInput}
              autoComplete="username email"
              type="email"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            label={t('login.passwordLabel')}
            name="password"
            rules={[
              { required: true, message: t('login.validation.passwordRequired') },
            ]}
          >
            <Input.Password
              prefix={<Lock size={18} className={styles.inputIcon} />}
              placeholder={t('login.passwordPlaceholder')}
              size="large"
              className={styles.formInput}
              autoComplete="current-password"
              disabled={loading}
            />
          </Form.Item>

          <div className={styles.forgotRow}>
            <Link to="/forgot-password" className={styles.forgotLink}>
              {t('login.forgotPassword')}
            </Link>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
            className={styles.submitButton}
          >
            {loading ? t('login.loggingIn') : t('login.submitButton')}
          </Button>
        </Form>

        <div className={styles.formFooter}>
          <span className={styles.footerText}>{t('login.noAccount')}</span>
          <Link to="/register" className={styles.registerLink}>
            {t('login.registerLink')}
          </Link>
        </div>
      </FormCard>
    </AuthLayout>
  );
};

export const EnterpriseLogin: React.FC = () => (
  <AntdApp>
    <EnterpriseLoginForm />
  </AntdApp>
);

export default EnterpriseLogin;
