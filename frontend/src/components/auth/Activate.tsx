import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Alert, Spin } from 'antd';
import { LockOutlined, CloudOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { authApi } from '../../services/api/authApi';
import './auth.css';

const { Title, Text, Paragraph } = Typography;

export const Activate: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [activated, setActivated] = useState(false);

  // 页面加载时验证token（可选：如果后端不提供预验证，可以跳过这一步）
  useEffect(() => {
    if (!token) {
      message.error('激活链接无效');
      setValidating(false);
      return;
    }

    // 简单验证token格式
    if (token.length < 10) {
      message.error('激活链接格式不正确');
      setValidating(false);
      return;
    }

    // 假设token有效，显示表单
    setTokenValid(true);
    setValidating(false);
  }, [token]);

  const handleSubmit = async (values: { password: string; confirm_password: string }) => {
    if (!token) {
      message.error('激活Token无效');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.activate(token, values.password);

      setEmail(result.email);
      setActivated(true);
      message.success('账号激活成功！');

      // 3秒后跳转到登录页
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      message.error(error.message || '激活失败，请重试');
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
            <Paragraph style={{ marginTop: 16 }}>正在验证激活链接...</Paragraph>
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
              <Title level={4}>激活链接无效</Title>
              <Paragraph type="secondary">
                激活链接可能已过期或格式不正确。请联系管理员重新发送激活邮件。
              </Paragraph>
              <Button type="primary" onClick={() => navigate('/login')}>
                返回登录
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
              <Title level={3}>激活成功！</Title>
              <Paragraph>
                您的账号已成功激活。
              </Paragraph>
              {email && (
                <Paragraph type="secondary">
                  邮箱: {email}
                </Paragraph>
              )}
              <Paragraph type="secondary">
                正在跳转到登录页面...
              </Paragraph>
              <Button type="primary" onClick={() => navigate('/login')}>
                立即登录
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
              激活您的账号
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              请设置您的登录密码
            </Text>
          </div>

          {/* 提示信息 */}
          <Alert
            message="密码要求"
            description="密码长度至少8位，必须包含大小写字母和数字"
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
              label="设置密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码长度至少为8位' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                  message: '密码必须包含大小写字母和数字',
                },
              ]}
              style={{ marginBottom: '18px' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="请输入密码"
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
              label="确认密码"
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
              style={{ marginBottom: '20px' }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="请再次输入密码"
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
                激活账号
              </Button>
            </Form.Item>

            <div style={{
              textAlign: 'center',
              paddingTop: '16px',
              borderTop: '1px solid #f0f0f0',
              marginTop: '4px'
            }}>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                已有账号？{' '}
                <Link to="/login" style={{ color: '#667eea', fontWeight: 500, fontSize: '14px' }}>
                  立即登录
                </Link>
              </Text>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};
