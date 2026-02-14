import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, App as AntdApp } from 'antd';
import { Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { MailOutlined } from '@ant-design/icons';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { authApi } from '../../services/api/authApi';
import { getErrorMessage } from '../../utils/ErrorHandler';
import styles from './EnterpriseLogin.module.css';

const ForgotPasswordForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1=邮箱 2=验证码 3=新密码 4=完成
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [email, setEmail] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { message } = AntdApp.useApp();

  // 清理timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // 启动倒计时
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

  // 步骤1：发送验证码
  const handleSendCode = async () => {
    try {
      await form.validateFields(['email']);
      const emailValue = form.getFieldValue('email');

      setSendingCode(true);
      await authApi.forgotPassword(emailValue);

      setEmail(emailValue);
      message.success('验证码已发送，请查收邮箱');
      startCountdown();
      setStep(2);
    } catch (error: any) {
      if (error?.errorFields) {
        return; // 表单验证错误
      }
      message.error(getErrorMessage(error, '发送失败，请稍后重试'));
    } finally {
      setSendingCode(false);
    }
  };

  // 步骤2：重新发送验证码
  const handleResendCode = async () => {
    try {
      setSendingCode(true);
      await authApi.forgotPassword(email);
      message.success('验证码已重新发送');
      startCountdown();
    } catch (error: any) {
      message.error(getErrorMessage(error, '发送失败，请稍后重试'));
    } finally {
      setSendingCode(false);
    }
  };

  // 步骤2：验证验证码 → 进入步骤3
  const handleVerifyCode = async () => {
    try {
      await form.validateFields(['verification_code']);
      setStep(3);
    } catch {
      // 表单验证错误
    }
  };

  // 步骤3：提交新密码
  const handleResetPassword = async () => {
    try {
      await form.validateFields(['new_password', 'confirm_password']);
      const code = form.getFieldValue('verification_code');
      const newPassword = form.getFieldValue('new_password');

      setLoading(true);
      await authApi.resetPassword(email, code, newPassword);

      message.success('密码重置成功');
      setStep(4);
    } catch (error: any) {
      if (error?.errorFields) {
        return; // 表单验证错误
      }
      message.error(getErrorMessage(error, '密码重置失败'));
    } finally {
      setLoading(false);
    }
  };

  // 隐藏邮箱中间部分
  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name[0]}${name[1]}***@${domain}`;
  };

  // ===== 渲染各步骤 =====

  // 步骤4：完成
  const renderSuccess = () => (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
      }}>
        <CheckCircle2 size={36} color="#ffffff" />
      </div>

      <h2 className={styles.formTitle} style={{ textAlign: 'center' }}>密码重置成功</h2>
      <p className={styles.formSubtitle} style={{ textAlign: 'center', marginBottom: '32px' }}>
        您的密码已更新，请使用新密码登录
      </p>

      <Button
        type="primary"
        size="large"
        block
        className={styles.submitButton}
        onClick={() => navigate('/login')}
      >
        返回登录
      </Button>
    </div>
  );

  // 步骤1：输入邮箱
  const renderEmailStep = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>重置密码</h2>
        <p className={styles.formSubtitle}>输入您的注册邮箱，我们将发送验证码</p>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className={styles.loginForm}
      >
        <Form.Item
          label="邮箱地址"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<Mail size={18} className={styles.inputIcon} />}
            placeholder="name@company.com"
            size="large"
            className={styles.formInput}
            autoComplete="email"
            type="email"
            autoFocus
          />
        </Form.Item>

        <Button
          type="primary"
          size="large"
          block
          loading={sendingCode}
          className={styles.submitButton}
          onClick={handleSendCode}
        >
          {sendingCode ? '发送中...' : '发送验证码'}
        </Button>
      </Form>
    </>
  );

  // 步骤2：输入验证码
  const renderCodeStep = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>输入验证码</h2>
        <p className={styles.formSubtitle}>
          验证码已发送至 <strong>{maskEmail(email)}</strong>
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className={styles.loginForm}
      >
        <Form.Item
          label="验证码"
          name="verification_code"
          rules={[
            { required: true, message: '请输入验证码' },
            { pattern: /^\d{6}$/, message: '验证码必须是6位数字' },
          ]}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Input
              prefix={<MailOutlined className={styles.inputIcon} />}
              placeholder="请输入6位验证码"
              maxLength={6}
              size="large"
              className={styles.formInput}
              style={{ flex: 1 }}
              autoFocus
            />
            <Button
              onClick={handleResendCode}
              loading={sendingCode}
              disabled={countdown > 0}
              size="large"
              style={{ minWidth: '120px', height: 48 }}
            >
              {countdown > 0 ? `${countdown}s` : '重新发送'}
            </Button>
          </div>
        </Form.Item>

        <Button
          type="primary"
          size="large"
          block
          className={styles.submitButton}
          onClick={handleVerifyCode}
        >
          下一步
        </Button>
      </Form>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '3px solid #3b82f6'
      }}>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
          验证码 5 分钟内有效。如未收到邮件，请检查垃圾邮件文件夹。
        </p>
      </div>
    </>
  );

  // 步骤3：设置新密码
  const renderPasswordStep = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>设置新密码</h2>
        <p className={styles.formSubtitle}>请输入您的新密码</p>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className={styles.loginForm}
      >
        <Form.Item
          label="新密码"
          name="new_password"
          rules={[
            { required: true, message: '请输入新密码' },
            () => ({
              validator(_, value) {
                if (!value) return Promise.resolve();
                const isLongEnough = value.length >= 8;
                const hasUpper = /[A-Z]/.test(value);
                const hasLower = /[a-z]/.test(value);
                const hasDigit = /\d/.test(value);
                if (isLongEnough && hasUpper && hasLower && hasDigit) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('密码需至少8位且包含大小写字母和数字'));
              },
            }),
          ]}
          extra={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>至少8位，包含大小写字母和数字</span>}
        >
          <Input.Password
            prefix={<Lock size={18} className={styles.inputIcon} />}
            placeholder="输入新密码"
            size="large"
            className={styles.formInput}
            autoComplete="new-password"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          label="确认新密码"
          name="confirm_password"
          dependencies={['new_password']}
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<Lock size={18} className={styles.inputIcon} />}
            placeholder="再次输入新密码"
            size="large"
            className={styles.formInput}
            autoComplete="new-password"
          />
        </Form.Item>

        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          className={styles.submitButton}
          onClick={handleResetPassword}
        >
          {loading ? '重置中...' : '重置密码'}
        </Button>
      </Form>
    </>
  );

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher type="dropdown" showIcon={false} showText={false} />
      </div>

      <div className={styles.mainContainer}>
        {/* 左侧视觉区 */}
        <div className={styles.visualPanel}>
          <div className={styles.visualContent}>
            <div className={styles.brandLogo}>
              <span style={{
                fontSize: '42px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#ffffff'
              }}>
                Cost<span style={{ color: '#60a5fa' }}>Q</span>
              </span>
            </div>

            <div className={styles.brandMessage}>
              <h1 className={styles.brandTitle}>
                云成本管理
                <br />
                智能化平台
              </h1>
              <p className={styles.brandDescription}>
                专业的云成本管理解决方案
              </p>
            </div>

            <div className={styles.visualDecoration}>
              <div className={styles.floatingCard}>
                <div className={styles.cardIcon}>🔐</div>
                <div className={styles.cardText}>
                  <div className={styles.cardLabel}>安全加密</div>
                  <div className={styles.cardValue}>256位</div>
                </div>
              </div>
              <div className={styles.floatingCard} style={{ animationDelay: '0.3s' }}>
                <div className={styles.cardIcon}>⚡</div>
                <div className={styles.cardText}>
                  <div className={styles.cardLabel}>快速重置</div>
                  <div className={styles.cardValue}>&lt;1分钟</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧表单区 */}
        <div className={styles.formPanel}>
          <div className={styles.formContainer}>
            {/* 返回登录 */}
            {step !== 4 && (
              <Link to="/login" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '24px',
                textDecoration: 'none',
              }}>
                <ArrowLeft size={16} />
                返回登录
              </Link>
            )}

            {/* 步骤指示器 */}
            {step !== 4 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '32px',
              }}>
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      background: s <= step ? '#3b82f6' : '#e2e8f0',
                      transition: 'background 0.3s ease',
                    }}
                  />
                ))}
              </div>
            )}

            {/* 各步骤内容 */}
            {step === 1 && renderEmailStep()}
            {step === 2 && renderCodeStep()}
            {step === 3 && renderPasswordStep()}
            {step === 4 && renderSuccess()}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ForgotPassword: React.FC = () => (
  <AntdApp>
    <ForgotPasswordForm />
  </AntdApp>
);

export default ForgotPassword;
