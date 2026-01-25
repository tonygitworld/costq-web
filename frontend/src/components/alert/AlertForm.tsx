/**
 * Alert Form - 告警创建/编辑表单
 */

import React, { useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  message,
  Alert,
  Select
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import type { CreateAlertRequest, UpdateAlertRequest } from '../../types/alert';


const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const AlertForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const currentUser = useAuthStore(state => state.user);

  const {
    currentAlert,
    savingAlert,  // ✅ 使用 savingAlert 而不是 loading
    fetchAlertById,
    createAlert,
    updateAlert,
    sendTestEmail
  } = useAlertStore();

  // AWS 和 GCP 账号
  const { accounts: awsAccounts, fetchAccounts: fetchAWSAccounts } = useAccountStore();
  const { accounts: gcpAccounts, fetchAccounts: fetchGCPAccounts } = useGCPAccountStore();

  const isEdit = !!id && id !== 'new';

  // 加载账号列表
  useEffect(() => {
    fetchAWSAccounts();
    fetchGCPAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载告警数据（编辑模式）
  useEffect(() => {
    if (isEdit) {
      loadAlert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAlert = async () => {
    if (!id) return;
    try {
      await fetchAlertById(id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载告警失败';
      message.error(msg);
      navigate('/settings/alerts');
    }
  };

  // 填充表单数据
  useEffect(() => {
    if (currentAlert && isEdit) {
      form.setFieldsValue({
        display_name: currentAlert.display_name,
        description: currentAlert.description,
        account_id: currentAlert.account_id // ✅ 填充账号ID
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAlert, isEdit]);

  // 保存
  const handleSave = async (sendTest: boolean = false) => {
    try {
      const values = await form.validateFields();

      // ✅ 判断账号类型
      let accountType = 'aws'; // 默认 AWS
      const selectedAccountId = values.account_id;

      if (selectedAccountId) {
        // 检查是 AWS 还是 GCP
        const isGCP = gcpAccounts.some(acc => acc.id === selectedAccountId);
        accountType = isGCP ? 'gcp' : 'aws';
      }

      if (isEdit && id) {
        // 更新告警：将 description 映射为 query_description
        const updateData: UpdateAlertRequest = {
          query_description: values.description,
          display_name: values.display_name,
          account_id: values.account_id,  // ✅ 添加账号ID
          account_type: accountType        // ✅ 添加账号类型
        };
        await updateAlert(id, updateData);
        message.success('更新成功');

        // 如果需要发送测试邮件
        if (sendTest) {
          try {
            await sendTestEmail(id, values.account_id); // ✅ 传递账号ID
            message.success('测试邮件已发送');
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '发送失败';
            message.warning(`告警更新成功，但测试邮件发送失败: ${msg}`);
          }
        }
      } else {
        // 创建告警：添加必需字段并映射字段名
        if (!currentUser) {
          message.error('用户信息未加载');
          return;
        }

        const createData: CreateAlertRequest = {
          query_description: values.description,
          display_name: values.display_name,
          user_id: currentUser.id,
          org_id: currentUser.org_id,
          check_frequency: 'daily',
          account_id: values.account_id,  // ✅ 添加账号ID
          account_type: accountType        // ✅ 添加账号类型
        };

        const newAlert = await createAlert(createData);
        message.success('创建成功');

        // 如果需要测试邮件
        if (sendTest) {
          try {
            await sendTestEmail(newAlert.id, values.account_id); // ✅ 传递账号ID
            message.success('测试邮件已发送');
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '发送失败';
            message.warning(`告警创建成功，但测试邮件发送失败: ${msg}`);
          }
        }
      }

      navigate('/settings/alerts');
    } catch (error: unknown) {
      // 表单验证错误
      if (error && typeof error === 'object' && 'errorFields' in error) {
        message.error('请检查表单填写');
      } else {
        const msg = error instanceof Error ? error.message : '保存失败';
        message.error(msg);
      }
    }
  };

  return (
    <div style={{
      height: '100vh',
      overflow: 'auto',
      background: '#f0f2f5',
      position: 'relative'
    }}>
      <Space direction="vertical" size="large" style={{
        width: '100%',
        padding: '24px',
        paddingBottom: '100px'  // ✅ 为底部按钮留出空间
      }}>
        {/* 标题 */}
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/settings/alerts')}
          >
            返回
          </Button>
          <Title level={3}>
            📝 {isEdit ? '编辑告警' : '新建告警'}
          </Title>
        </Space>

      {/* 表单 */}
      <Card title="基本信息">
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="告警名称"
            name="display_name"
            rules={[
              { required: true, message: '请输入告警名称' },
              { max: 50, message: '名称不能超过50个字符' }
            ]}
          >
            <Input
              placeholder="SP利用率监控"
              maxLength={50}
            />
          </Form.Item>

          <Alert
            message="💡 给告警起一个简短易懂的名称"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* ✅ 新增：账号选择 */}
          <Form.Item
            label="选择账号"
            name="account_id"
            rules={[
              { required: true, message: '请选择要监控的账号' }
            ]}
          >
            <Select
              placeholder="选择 AWS 或 GCP 账号"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={[
                // AWS 账号
                ...awsAccounts.map(account => ({
                  value: account.id,
                  label: `☁️ AWS - ${account.alias || account.account_id}`,
                  account
                })),
                // GCP 账号
                ...gcpAccounts.map(account => ({
                  value: account.id,
                  label: `🔵 GCP - ${account.account_name || account.project_id}`,
                  account
                }))
              ]}
            />
          </Form.Item>

          <Alert
            message="💡 选择要监控的云账号，Agent 将使用该账号的凭证查询数据"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            label="告警描述 (自然语言)"
            name="description"
            rules={[
              { required: true, message: '请输入告警描述' },
              { min: 10, message: '描述至少10个字符' }
            ]}
          >
            <TextArea
              placeholder="当 Savings Plans 利用率低于 95% 时，发送邮件至 ops@example.com 和 admin@example.com"
              rows={6}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Alert
            message="💡 用自然语言描述告警条件和收件人，AI 会自动理解"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Form>
      </Card>

      {/* 示例卡片 */}
      <Card title="📝 示例">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>
            <Text type="secondary">以下是一些告警描述的示例，供您参考：</Text>
          </Paragraph>
          <ul style={{ paddingLeft: 20 }}>
            <li>
              <Text code>当日 EC2 成本超过 $1000 时，发送邮件至 finance@example.com</Text>
            </li>
            <li>
              <Text code>当 RI 覆盖率低于 80% 时，通知 ops@example.com 和 admin@example.com</Text>
            </li>
            <li>
              <Text code>检查未使用的 EBS 卷，如果超过 10 个则告警至 devops@example.com</Text>
            </li>
            <li>
              <Text code>每天检查 S3 存储成本，如果增长超过 20% 则发送邮件至 cost-team@example.com</Text>
            </li>
          </ul>
        </Space>
      </Card>

      {/* 系统说明 */}
      <Card>
        <Alert
          message="ℹ️ 系统说明"
          description={
            <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
              <li>检查频率：每天自动执行一次</li>
              <li>执行时间：每天 09:00 (UTC+8)</li>
              <li>通知方式：仅在触发条件时发送邮件</li>
              <li>AI 解析：系统会自动从描述中提取收件人邮箱</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Card>

      {/* 操作按钮 - 固定在底部 */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        padding: '16px 24px',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
        zIndex: 100,
        marginLeft: '-24px',
        marginRight: '-24px',
        marginBottom: '-24px'
      }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button onClick={() => navigate('/settings/alerts')}>
            取消
          </Button>
          <Space>
            <Button
              type="default"
              icon={<SendOutlined />}
              onClick={() => handleSave(true)}
              loading={savingAlert}  // ✅ 使用 savingAlert
            >
              保存并测试
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => handleSave(false)}
              loading={savingAlert}  // ✅ 使用 savingAlert
            >
              保存
            </Button>
          </Space>
        </Space>
      </div>
    </Space>
    </div>
  );
};
