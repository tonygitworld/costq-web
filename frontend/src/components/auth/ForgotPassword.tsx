import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, App as AntdApp } from 'antd';
import { Mail, Lock, CheckCircle2, MailCheck } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { AuthLayout } from './AuthLayout';
import { FormCard } from './FormCard';
import { authApi } from '../../services/api/authApi';
import { getErrorMessage } from '../../utils/ErrorHandler';
import styles from './ForgotPassword.module.css';

const ForgotPasswordForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [email, setEmail] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { message } = AntdApp.useApp();
  const { t } = useI18n('auth');

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const startCountdown = () => {
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
  };

  const handleSendCode = async () => {
    try {
      await form.validateFields(['email']);
      const emailValue = form.getFieldValue('email');
      setSendingCode(true);
      await authApi.forgotPassword(emailValue);
      setEmail(emailValue);
      message.success(t('forgotPassword.success.codeSent'));
      startCountdown();
      setStep(2);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getErrorMessage(error, t('forgotPassword.errors.sendFailed')));
    } finally {
      setSendingCode(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setSendingCode(true);
      await authApi.forgotPassword(email);
      message.success(t('forgotPassword.success.codeResent'));
      startCountdown();
    } catch (error: any) {
      message.error(getErrorMessage(error, t('forgotPassword.errors.sendFailed')));
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      await form.validateFields(['verification_code']);
      setStep(3);
    } catch {
      // form validation error
    }
  };

  const handleResetPassword = async () => {
    try {
      await form.validateFields(['new_password', 'confirm_password']);
      const code = form.getFieldValue('verification_code');
      const newPassword = form.getFieldValue('new_password');
      setLoading(true);
      await authApi.resetPassword(email, code, newPassword);
      message.success(t('forgotPassword.success.resetSuccess'));
      setStep(4);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getErrorMessage(error, t('forgotPassword.errors.resetFailed')));
    } finally {
      setLoading(false);
    }
  };

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name[0]}${name[1]}***@${domain}`;
  };

  const renderSuccess = () => (
    <div style={{ textAlign: 'center' }}>
      <div className={styles.successIcon}>
        <CheckCircle2 size={36} color="#ffffff" />
      </div>
      <h2 className={styles.formTitle} style={{ textAlign: 'center' }}>{t('forgotPassword.step4Title')}</h2>
      <p className={styles.formSubtitle} style={{ textAlign: 'center', marginBottom: '32px' }}>
        {t('forgotPassword.step4Subtitle')}
      </p>
      <Button
        type="primary"
        size="large"
        block
        className={styles.submitButton}
        onClick={() => navigate('/login')}
      >
        {t('forgotPassword.backToLogin')}
      </Button>
    </div>
  );

  const renderEmailStep = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>{t('forgotPassword.step1Title')}</h2>
        <p className={styles.formSubtitle}>{t('forgotPassword.step1Subtitle')}</p>
      </div>
      <Form form={form} layout="vertical" requiredMark={false} className={styles.loginForm}>
        <Form.Item
          label={t('forgotPassword.emailLabel')}
          name="email"
          rules={[
            { required: true, message: t('forgotPassword.validation.emailRequired') },
            { type: 'email', message: t('forgotPassword.validation.emailInvalid') },
          ]}
        >
          <Input
            prefix={<Mail size={18} className={styles.inputIcon} />}
            placeholder={t('login.emailPlaceholder')}
            size="large"
            className={styles.formInput}
            autoComplete="email"
            type="email"
            autoFocus
          />
        </Form.Item>
        <Button
          type="primary" size="large" block loading={sendingCode}
          className={styles.submitButton} onClick={handleSendCode}
        >
          {sendingCode ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
        </Button>
      </Form>
      <div className={styles.infoBox}>
        <p className={styles.infoBoxText}>{t('forgotPassword.infoStep1')}</p>
      </div>
    </>
  );

  const renderCodeStep = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>{t('forgotPassword.step2Title')}</h2>
        <p className={styles.formSubtitle}>
          {t('forgotPassword.step2Subtitle')} <strong>{maskEmail(email)}</strong>
        </p>
      </div>
      <Form form={form} layout="vertical" requiredMark={false} className={styles.loginForm}>
        <Form.Item
          label={t('forgotPassword.codeLabel')}
          name="verification_code"
          rules={[
            { required: true, message: t('forgotPassword.validation.codeRequired') },
            { pattern: /^\d{6}$/, message: t('forgotPassword.validation.codePattern') },
          ]}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Input
              prefix={<MailCheck size={18} className={styles.inputIcon} />}
              placeholder={t('forgotPassword.codePlaceholder')}
              maxLength={6} size="large"
              className={styles.formInput}
              style={{ flex: 1 }} autoFocus
            />
            <Button
              onClick={handleResendCode} loading={sendingCode}
              disabled={countdown > 0} size="large"
              className={styles.resendButton}
            >
              {countdown > 0 ? `${countdown}s` : t('forgotPassword.resend')}
            </Button>
          </div>
        </Form.Item>
        <Button
          type="primary" size="large" block
          className={styles.submitButton} onClick={handleVerifyCode}
        >
          {t('forgotPassword.nextStep')}
        </Button>
      </Form>
      <div className={styles.infoBox}>
        <p className={styles.infoBoxText}>{t('forgotPassword.infoStep2')}</p>
      </div>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>{t('forgotPassword.step3Title')}</h2>
        <p className={styles.formSubtitle}>{t('forgotPassword.step3Subtitle')}</p>
      </div>
      <Form form={form} layout="vertical" requiredMark={false} className={styles.loginForm}>
        <Form.Item
          label={t('forgotPassword.newPasswordLabel')}
          name="new_password"
          rules={[
            { required: true, message: t('forgotPassword.validation.passwordRequired') },
            () => ({
              validator(_, value) {
                if (!value) return Promise.resolve();
                const ok = value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
                return ok ? Promise.resolve() : Promise.reject(new Error(t('forgotPassword.validation.passwordWeak')));
              },
            }),
          ]}
          extra={<span style={{ fontSize: 12, color: '#94a3b8' }}>{t('forgotPassword.newPasswordHint')}</span>}
        >
          <Input.Password
            prefix={<Lock size={18} className={styles.inputIcon} />}
            placeholder={t('forgotPassword.newPasswordPlaceholder')}
            size="large" className={styles.formInput}
            autoComplete="new-password" autoFocus
          />
        </Form.Item>
        <Form.Item
          label={t('forgotPassword.confirmPasswordLabel')}
          name="confirm_password"
          dependencies={['new_password']}
          rules={[
            { required: true, message: t('forgotPassword.validation.confirmRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                return Promise.reject(new Error(t('forgotPassword.validation.passwordMismatch')));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<Lock size={18} className={styles.inputIcon} />}
            placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
            size="large" className={styles.formInput}
            autoComplete="new-password"
          />
        </Form.Item>
        <Button
          type="primary" size="large" block loading={loading}
          className={styles.submitButton} onClick={handleResetPassword}
        >
          {loading ? t('forgotPassword.resetting') : t('forgotPassword.resetPassword')}
        </Button>
      </Form>
    </>
  );

  return (
    <AuthLayout showBackButton={true} backTo="/login">
      <FormCard>
        {step === 1 && renderEmailStep()}
        {step === 2 && renderCodeStep()}
        {step === 3 && renderPasswordStep()}
        {step === 4 && renderSuccess()}
      </FormCard>
    </AuthLayout>
  );
};

export const ForgotPassword: React.FC = () => (
  <AntdApp>
    <ForgotPasswordForm />
  </AntdApp>
);

export default ForgotPassword;
