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
  Alert,
  Select,
  App
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlertStore } from '../../stores/alertStore';
import { useAuthStore } from '../../stores/authStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { CreateAlertRequest, UpdateAlertRequest } from '../../types/alert';


const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const AlertForm: React.FC = () => {
  const { message } = App.useApp(); // ✅ 修复Ant Design警告：使用App上下文
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const currentUser = useAuthStore(state => state.user);
  const { t } = useI18n('alert');
  const isMobile = useIsMobile();

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
      const msg = error instanceof Error ? error.message : t('message.loadFailed');
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
        message.success(t('message.updateSuccess'));

        // 如果需要发送测试邮件
        if (sendTest) {
          try {
            await sendTestEmail(id, values.account_id); // ✅ 传递账号ID
            message.success(t('message.testEmailSent'));
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : t('message.testEmailFailed');
            message.warning(`${t('message.updateSuccess')}, ${msg}`);
          }
        }
      } else {
        // 创建告警：添加必需字段并映射字段名
        if (!currentUser) {
          message.error(t('message.userNotLoaded'));
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
        message.success(t('message.createSuccess'));

        // 如果需要测试邮件
        if (sendTest) {
          try {
            await sendTestEmail(newAlert.id, values.account_id); // ✅ 传递账号ID
            message.success(t('message.testEmailSent'));
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : t('message.testEmailFailed');
            message.warning(`${t('message.createSuccess')}, ${msg}`);
          }
        }
      }

      navigate('/settings/alerts');
    } catch (error: unknown) {
      // 表单验证错误
      if (error && typeof error === 'object' && 'errorFields' in error) {
        message.error(t('message.formValidationError'));
      } else {
        const msg = error instanceof Error ? error.message : t('message.saveFailed');
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
      <Space direction="vertical" size={isMobile ? 12 : 'large'} style={{
        width: '100%',
        padding: isMobile ? '0' : '24px',
        paddingBottom: '100px'
      }}>
        {/* 标题 */}
        {isMobile ? (
          <div style={{
            flexShrink: 0,
            background: 'linear-gradient(to bottom, #ffffff, #fafbfc)',
            boxShadow: '0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 12px' }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/settings/alerts')}
                type="text"
                size="small"
                style={{ color: '#344054', width: 32, height: 32, borderRadius: 8 }}
              />
              <span style={{ fontSize: 17, fontWeight: 700, color: '#101828', letterSpacing: '-0.01em' }}>
                📝 {isEdit ? t('edit') : t('create')}
              </span>
            </div>
          </div>
        ) : (
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/settings/alerts')}
            >
              {t('back')}
            </Button>
            <Title level={3}>
              📝 {isEdit ? t('edit') : t('create')}
            </Title>
          </Space>
        )}

      {/* 表单 */}
      <div style={isMobile ? { padding: '0 12px' } : undefined}>
      <Card title={t('card.basicInfo')} size={isMobile ? 'small' : 'default'}>
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          size={isMobile ? 'small' : 'middle'}
        >
          <Form.Item
            label={t('form.name')}
            name="display_name"
            rules={[
              { required: true, message: t('form.nameRequired') },
              { max: 50, message: t('form.nameMaxLength', { max: 50 }) }
            ]}
            style={isMobile ? { marginBottom: 12 } : undefined}
          >
            <Input
              placeholder={t('form.namePlaceholder')}
              maxLength={50}
            />
          </Form.Item>

          <Alert
            message={t('tips.nameHint')}
            type="info"
            showIcon
            style={{ marginBottom: isMobile ? 12 : 16, fontSize: isMobile ? 12 : undefined }}
          />

          {/* ✅ 新增：账号选择 */}
          <Form.Item
            label={t('form.account')}
            name="account_id"
            rules={[
              { required: true, message: t('form.accountRequired') }
            ]}
            style={isMobile ? { marginBottom: 12 } : undefined}
          >
            <Select
              placeholder={t('form.accountPlaceholder')}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={[
                // AWS 账号
                ...awsAccounts.map(account => ({
                  value: account.id,
                  label: `☁️ ${t('account.aws')} - ${account.alias || account.account_id}`,
                  account
                })),
                // GCP 账号
                ...gcpAccounts.map(account => ({
                  value: account.id,
                  label: `🔵 ${t('account.gcp')} - ${account.account_name || account.project_id}`,
                  account
                }))
              ]}
            />
          </Form.Item>

          <Alert
            message={t('tips.accountHint')}
            type="info"
            showIcon
            style={{ marginBottom: isMobile ? 12 : 16, fontSize: isMobile ? 12 : undefined }}
          />

          <Form.Item
            label={t('form.description')}
            name="description"
            rules={[
              { required: true, message: t('form.descriptionRequired') },
              { min: 10, message: t('form.descriptionMinLength', { min: 10 }) }
            ]}
            style={isMobile ? { marginBottom: 12 } : undefined}
          >
            <TextArea
              placeholder={t('form.descriptionPlaceholder')}
              rows={isMobile ? 4 : 6}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Alert
            message={t('tips.descriptionHint')}
            type="info"
            showIcon
            style={{ marginBottom: isMobile ? 8 : 16, fontSize: isMobile ? 12 : undefined }}
          />
        </Form>
      </Card>

      {/* 示例卡片 */}
      <Card title={t('card.examples')} size={isMobile ? 'small' : 'default'}>
        <div style={isMobile ? { fontSize: 13 } : undefined}>
          <Paragraph style={isMobile ? { marginBottom: 8 } : undefined}>
            <Text type="secondary">{t('examples.title')}</Text>
          </Paragraph>
          <ul style={{ paddingLeft: isMobile ? 16 : 20, margin: 0 }}>
            <li style={isMobile ? { marginBottom: 4 } : undefined}>
              <Text code style={isMobile ? { fontSize: 12 } : undefined}>{t('examples.ec2Cost')}</Text>
            </li>
            <li style={isMobile ? { marginBottom: 4 } : undefined}>
              <Text code style={isMobile ? { fontSize: 12 } : undefined}>{t('examples.riCoverage')}</Text>
            </li>
            <li style={isMobile ? { marginBottom: 4 } : undefined}>
              <Text code style={isMobile ? { fontSize: 12 } : undefined}>{t('examples.unusedEbs')}</Text>
            </li>
            <li>
              <Text code style={isMobile ? { fontSize: 12 } : undefined}>{t('examples.s3Growth')}</Text>
            </li>
          </ul>
        </div>
      </Card>

      {/* 系统说明 */}
      <Card size={isMobile ? 'small' : 'default'}>
        <Alert
          message={t('card.systemInfo')}
          description={
            <ul style={{ paddingLeft: isMobile ? 16 : 20, marginBottom: 0, fontSize: isMobile ? 12 : undefined }}>
              <li>{t('systemInfo.checkFrequency')}</li>
              <li>{t('systemInfo.executionTime')}</li>
              <li>{t('systemInfo.notificationMethod')}</li>
              <li>{t('systemInfo.aiParsing')}</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Card>
      </div>

      {/* 操作按钮 - 固定在底部 */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        padding: isMobile ? '8px 12px' : '16px 24px',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
        zIndex: 100,
        marginLeft: isMobile ? 0 : '-24px',
        marginRight: isMobile ? 0 : '-24px',
        marginBottom: isMobile ? 0 : '-24px'
      }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button size={isMobile ? 'small' : 'middle'} onClick={() => navigate('/settings/alerts')}
            style={isMobile ? { fontSize: 12, padding: '0 8px' } : undefined}
          >
            {t('cancel')}
          </Button>
          <Space size={isMobile ? 6 : 8}>
            <Button
              type="default"
              size={isMobile ? 'small' : 'middle'}
              icon={<SendOutlined />}
              onClick={() => handleSave(true)}
              loading={savingAlert}
              style={isMobile ? { fontSize: 12, padding: '0 8px' } : undefined}
            >
              {isMobile ? '测试' : t('button.saveAndTest')}
            </Button>
            <Button
              type="primary"
              size={isMobile ? 'small' : 'middle'}
              icon={<SaveOutlined />}
              onClick={() => handleSave(false)}
              loading={savingAlert}
              style={isMobile ? { fontSize: 12, padding: '0 8px' } : undefined}
            >
              {t('save')}
            </Button>
          </Space>
        </Space>
      </div>
    </Space>
    </div>
  );
};
