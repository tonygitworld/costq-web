import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, App as AntdApp } from 'antd';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../hooks/useI18n';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import styles from './EnterpriseLogin.module.css';

const EnterpriseLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const login = useAuthStore((state) => state.login);
  const { t } = useI18n('auth');
  const { message } = AntdApp.useApp();

  // 自动聚焦
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
      message.success(t('login.success.login') || '登录成功');
      navigate('/chat');
    } catch (error: any) {
      message.error('登录失败，请检查您的凭据');
    } finally {
      setLoading(false);
    }
  }, [login, navigate, t, message]);

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
            {/* Logo */}
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

            {/* 主标语 */}
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

            {/* 视觉装饰 */}
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
        <div className={styles.formPanel}>
          {/* 返回按钮 - 放在白色区域左上角 */}
          <button
            onClick={() => navigate('/')}
            className={styles.backButton}
            aria-label="返回产品介绍"
            style={{ position: 'absolute', top: '24px', left: '40px' }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
            <span>返回</span>
          </button>

          <div className={styles.formContainer}>
            {/* 表单标题 */}
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>欢迎回来</h2>
              <p className={styles.formSubtitle}>登录到您的 CostQ 账户</p>
            </div>

            {/* 登录表单 */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
              className={styles.loginForm}
              validateTrigger={hasSubmitted ? "onChange" : "onSubmit"}
            >
              {/* 邮箱 */}
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
                  autoComplete="username email"
                  type="email"
                  disabled={loading}
                />
              </Form.Item>

              {/* 密码 */}
              <Form.Item
                label="密码"
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                ]}
              >
                <Input.Password
                  prefix={<Lock size={18} className={styles.inputIcon} />}
                  placeholder="输入您的密码"
                  size="large"
                  className={styles.formInput}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </Form.Item>

              {/* 忘记密码 */}
              <div className={styles.formOptions}>
                <Link to="/forgot-password" className={styles.forgotLink}>
                  忘记密码？
                </Link>
              </div>

              {/* 登录按钮 */}
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className={styles.submitButton}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form>

            {/* 注册引导 */}
            <div className={styles.formFooter}>
              <span className={styles.footerText}>还没有账户？</span>
              <Link to="/register" className={styles.registerLink}>
                立即注册
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EnterpriseLogin: React.FC = () => (
  <AntdApp>
    <EnterpriseLoginForm />
  </AntdApp>
);

export default EnterpriseLogin;
