import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, message, Alert } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { UserOutlined, LockOutlined, TeamOutlined, IdcardOutlined, MailOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { authApi } from '../../services/api/authApi';
import { getErrorMessage } from '../../utils/ErrorHandler';
import styles from './EnterpriseLogin.module.css';

// 表单验证错误类型
interface FormValidationError {
  errorFields?: unknown[];
}

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
    <div className={styles.pageWrapper}>
      {/* 语言切换器 */}
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
                <div className={styles.cardIcon}>💰</div>
                <div className={styles.cardText}>
                  <div className={styles.cardLabel}>成本节省</div>
                  <div className={styles.cardValue}>40%</div>
                </div>
              </div>
              <div className={styles.floatingCard} style={{ animationDelay: '0.3s' }}>
                <div className={styles.cardIcon}>📊</div>
                <div className={styles.cardText}>
                  <div className={styles.cardLabel}>实时监控</div>
                  <div className={styles.cardValue}>24/7</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧表单区 */}
        <div className={`${styles.formPanel} ${styles.registerPanel}`}>
          <div className={`${styles.formContainer} ${styles.registerContainer}`}>
            {registrationSuccess ? (
              <>
                {/* 返回按钮 */}
                <button
                  onClick={() => navigate('/login')}
                  className={styles.backButton}
                  aria-label="返回登录"
                >
                  <ArrowLeft size={18} strokeWidth={2} />
                  <span>返回登录</span>
                </button>

                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>注册申请已提交</h2>
                  <p className={styles.formSubtitle}>您的账号正在审核中，通过后将邮件通知您。</p>
                  <Button
                    type="primary"
                    onClick={() => navigate('/login')}
                    size="large"
                    className={styles.submitButton}
                    style={{ marginTop: '24px' }}
                  >
                    返回登录
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* 返回按钮 */}
                <button
                  onClick={() => navigate('/login')}
                  className={styles.backButton}
                  aria-label="返回登录"
                >
                  <ArrowLeft size={18} strokeWidth={2} />
                  <span>返回登录</span>
                </button>

                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>{t('register.title')}</h2>
                  <p className={styles.formSubtitle}>{t('register.subtitle')}</p>
                </div>

                <Alert
                  message={t('register.infoTitle')}
                  description={t('register.infoDescription')}
                  type="info"
                  showIcon
                  className={styles.infoAlert}
                  style={{ marginBottom: '20px' }}
                />

                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  autoComplete="off"
                  requiredMark={false}
                  className={`${styles.loginForm} ${styles.registerForm}`}
                >
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
                  prefix={<TeamOutlined className={styles.inputIcon} />}
                  placeholder={t('register.orgNamePlaceholder')}
                  size="large"
                  className={styles.formInput}
                />
              </Form.Item>

              <Form.Item
                label={t('register.email')}
                name="email"
                rules={[
                  { required: true, message: t('register.validation.emailRequired') },
                  { type: 'email', message: t('register.validation.emailInvalid') },
                ]}
              >
                <Input
                  prefix={<UserOutlined className={styles.inputIcon} />}
                  placeholder={t('register.emailPlaceholder')}
                  autoComplete="email"
                  size="large"
                  className={styles.formInput}
                />
              </Form.Item>

              <Form.Item
                label="邮箱验证码"
                name="verification_code"
                rules={[
                  { required: true, message: '请输入邮箱验证码' },
                  { len: 6, message: '验证码为6位数字' },
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
                  />
                  <Button
                    type="primary"
                    onClick={handleSendCode}
                    loading={sendingCode}
                    disabled={countdown > 0}
                    size="large"
                    className={styles.submitButton}
                    style={{ minWidth: '120px', marginTop: 0, height: 48 }}
                  >
                    {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
                  </Button>
                </div>
              </Form.Item>

              <Form.Item
                label={t('register.fullName')}
                name="full_name"
              >
                <Input
                  prefix={<IdcardOutlined className={styles.inputIcon} />}
                  placeholder={t('register.fullNamePlaceholder')}
                  size="large"
                  className={styles.formInput}
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
                extra={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>{t('register.passwordHint')}</span>}
              >
                <Input.Password
                  prefix={<LockOutlined className={styles.inputIcon} />}
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
                  prefix={<LockOutlined className={styles.inputIcon} />}
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  size="large"
                  className={styles.formInput}
                />
              </Form.Item>

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

            <div className={styles.formFooter}>
              <span className={styles.footerText}>{t('register.hasAccount')}</span>
              <Link to="/login" className={styles.registerLink}>
                {t('register.loginLink')}
              </Link>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
