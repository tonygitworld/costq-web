import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, App as AntdApp } from 'antd';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import styles from './EnterpriseLogin.module.css';

const ForgotPasswordForm: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { message } = AntdApp.useApp();

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true);
    try {
      // TODO: 调用后端API发送重置密码邮件
      // await api.post('/auth/forgot-password', { email: values.email });

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500));

      setEmailSent(true);
      message.success('重置密码邮件已发送');
    } catch (error: any) {
      message.error(error?.message || '发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
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
            </div>
          </div>

          {/* 右侧成功提示 */}
          <div className={styles.formPanel}>
            <div className={styles.formContainer}>
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

                <h2 className={styles.formTitle}>邮件已发送</h2>
                <p className={styles.formSubtitle} style={{ marginBottom: '32px' }}>
                  我们已向 <strong>{form.getFieldValue('email')}</strong> 发送了重置密码的邮件。
                  <br />
                  请检查您的收件箱并点击邮件中的链接。
                </p>

                <div style={{ marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '10px', textAlign: 'left' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.8' }}>
                    <strong style={{ color: '#1e293b' }}>📧 收不到邮件？</strong>
                    <br />
                    • 检查垃圾邮件文件夹
                    <br />
                    • 确认邮箱地址拼写正确
                    <br />
                    • 等待几分钟后重试
                  </p>
                </div>

                <Link to="/login">
                  <Button type="primary" size="large" block className={styles.submitButton}>
                    返回登录
                  </Button>
                </Link>

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <Button
                    type="link"
                    onClick={() => setEmailSent(false)}
                    style={{ color: '#64748b', fontSize: '14px' }}
                  >
                    重新发送邮件
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  <div className={styles.cardLabel}>安全保护</div>
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
            {/* 返回按钮 */}
            <Link to="/login" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '24px',
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}>
              <ArrowLeft size={16} />
              返回登录
            </Link>

            {/* 表单标题 */}
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>重置密码</h2>
              <p className={styles.formSubtitle}>
                输入您的邮箱地址，我们将发送重置密码的链接
              </p>
            </div>

            {/* 表单 */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
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
                  disabled={loading}
                  autoFocus
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className={styles.submitButton}
                style={{ marginTop: '8px' }}
              >
                {loading ? '发送中...' : '发送重置链接'}
              </Button>
            </Form>

            {/* 提示信息 */}
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              borderLeft: '3px solid #3b82f6'
            }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
                💡 重置链接将在 24 小时内有效。如果您没有收到邮件，请检查垃圾邮件文件夹。
              </p>
            </div>
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
