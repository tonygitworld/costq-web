import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { Building2, User, Mail, Lock, MailCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { AuthLayout } from './AuthLayout';
import { FormCard } from './FormCard';
import { authApi } from '../../services/api/authApi';
import { getErrorMessage } from '../../utils/ErrorHandler';
import styles from './Register.module.css';

interface FormValidationError {
  errorFields?: unknown[];
}

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const register = useAuthStore(state => state.register);
  const { t } = useI18n('auth');

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleSendCode = async () => {
    try {
      await form.validateFields(['email']);
      const email = form.getFieldValue('email');
      setSendingCode(true);
      await authApi.sendVerificationCode(email);
      message.success(t('register.success.codeSent'));

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
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
        message.error(t('register.errors.invalidEmail'));
      } else {
        message.error(getErrorMessage(error, t('register.errors.sendCodeFailed')));
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
      if (response?.requires_activation === true) {
        setRegistrationSuccess(true);
      } else {
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
    <AuthLayout showBackButton={true} backTo="/login">
      <FormCard wide>
        {registrationSuccess ? (
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>{t('register.successTitle')}</h2>
            <p className={styles.formSubtitle}>{t('register.successSubtitle')}</p>
            <Button
              type="primary"
              onClick={() => navigate('/login')}
              size="large"
              className={styles.submitButton}
              style={{ marginTop: '24px' }}
            >
              {t('register.backToLogin')}
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>{t('register.title')}</h2>
              <p className={styles.formSubtitle}>{t('register.subtitle')}</p>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
              requiredMark={false}
              className={styles.registerForm}
            >
              <div className={styles.twoColumnRow}>
                <Form.Item
                  label={t('register.orgName')}
                  name="org_name"
                  rules={[
                    { required: true, message: t('register.validation.orgNameRequired') },
                    { min: 2, message: t('register.validation.orgNameMin') },
                    { max: 100, message: t('register.validation.orgNameMax') },
                  ]}
                >
                  <Input
                    prefix={<Building2 size={18} className={styles.inputIcon} />}
                    placeholder={t('register.orgNamePlaceholder')}
                    size="large"
                    className={styles.formInput}
                  />
                </Form.Item>

                <Form.Item
                  label={t('register.fullName')}
                  name="full_name"
                >
                  <Input
                    prefix={<User size={18} className={styles.inputIcon} />}
                    placeholder={t('register.fullNamePlaceholder')}
                    size="large"
                    className={styles.formInput}
                  />
                </Form.Item>
              </div>

              <Form.Item
                label={t('register.email')}
                name="email"
                rules={[
                  { required: true, message: t('register.validation.emailRequired') },
                  { type: 'email', message: t('register.validation.emailInvalid') },
                ]}
              >
                <Input
                  prefix={<Mail size={18} className={styles.inputIcon} />}
                  placeholder={t('register.emailPlaceholder')}
                  autoComplete="email"
                  size="large"
                  className={styles.formInput}
                />
              </Form.Item>

              <Form.Item
                label={t('register.verificationCode')}
                name="verification_code"
                rules={[
                  { required: true, message: t('register.validation.codeRequired') },
                  { len: 6, message: t('register.validation.codeLength') },
                  { pattern: /^\d{6}$/, message: t('register.validation.codePattern') },
                ]}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Input
                    prefix={<MailCheck size={18} className={styles.inputIcon} />}
                    placeholder={t('register.verificationCodePlaceholder')}
                    maxLength={6}
                    size="large"
                    className={styles.formInput}
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={handleSendCode}
                    loading={sendingCode}
                    disabled={countdown > 0}
                    size="large"
                    className={styles.sendCodeButton}
                  >
                    {countdown > 0 ? `${countdown}s` : t('register.sendCode')}
                  </Button>
                </div>
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
              >
                <Input.Password
                  prefix={<Lock size={18} className={styles.inputIcon} />}
                  placeholder={t('register.passwordPlaceholder')}
                  autoComplete="new-password"
                  size="large"
                  className={styles.formInput}
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
              >
                <Input.Password
                  prefix={<Lock size={18} className={styles.inputIcon} />}
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  size="large"
                  className={styles.formInput}
                />
              </Form.Item>
              <p className={styles.passwordHint}>{t('register.passwordHint')}</p>

              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className={styles.submitButton}
              >
                {t('register.submitButton')}
              </Button>
            </Form>

            <p className={styles.registerNote}>
              {t('register.infoDescription')}
            </p>

            <div className={styles.formFooter}>
              <span className={styles.footerText}>{t('register.hasAccount')}</span>
              <Link to="/login" className={styles.loginLink}>
                {t('register.loginLink')}
              </Link>
            </div>
          </>
        )}
      </FormCard>
    </AuthLayout>
  );
};
