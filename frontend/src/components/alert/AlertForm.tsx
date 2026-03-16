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
import { MobilePageHeader } from '../common/MobilePageHeader';
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

  // ========== 移动端布局 ==========
  if (isMobile) {
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
      }}>
        {/* 顶部栏 */}
        <MobilePageHeader
          title={`📝 ${isEdit ? t('edit') : t('create')}`}
          onBack={() => navigate('/settings/alerts')}
        />

        {/* 可滚动内容区 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 12px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card title={t('card.basicInfo')} size="small">
              <Form form={form} layout="vertical" autoComplete="off" size="small">
                <Form.Item
                  label={t('form.name')}
                  name="display_name"
                  rules={[
                    { required: true, message: t('form.nameRequired') },
                    { max: 50, message: t('form.nameMaxLength', { max: 50 }) }
                  ]}
                  style={{ marginBottom: 12 }}
                >
                  <Input placeholder={t('form.namePlaceholder')} maxLength={50} />
                </Form.Item>

                <Alert message={t('tips.nameHint')} type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }} />

                <Form.Item
                  label={t('form.account')}
                  name="account_id"
                  rules={[{ required: true, message: t('form.accountRequired') }]}
                  style={{ marginBottom: 12 }}
                >
                  <Select
                    placeholder={t('form.accountPlaceholder')}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                      ...awsAccounts.map(account => ({
                        value: account.id,
                        label: `☁️ ${t('account.aws')} - ${account.alias || account.account_id}`,
                        account
                      })),
                      ...gcpAccounts.map(account => ({
                        value: account.id,
                        label: `🔵 ${t('account.gcp')} - ${account.account_name || account.project_id}`,
                        account
                      }))
                    ]}
                  />
                </Form.Item>

                <Alert message={t('tips.accountHint')} type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }} />

                <Form.Item
                  label={t('form.description')}
                  name="description"
                  rules={[
                    { required: true, message: t('form.descriptionRequired') },
                    { min: 10, message: t('form.descriptionMinLength', { min: 10 }) }
                  ]}
                  style={{ marginBottom: 12 }}
                >
                  <TextArea placeholder={t('form.descriptionPlaceholder')} rows={8} maxLength={500} showCount />
                </Form.Item>

                <Alert message={t('tips.descriptionHint')} type="info" showIcon style={{ marginBottom: 0, fontSize: 12 }} />
              </Form>
            </Card>

            <Card title={t('card.examples')} size="small">
              <div style={{ fontSize: 13 }}>
                <Paragraph style={{ marginBottom: 8 }}>
                  <Text type="secondary">{t('examples.title')}</Text>
                </Paragraph>
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  <li style={{ marginBottom: 4 }}><Text code style={{ fontSize: 12 }}>{t('examples.ec2Cost')}</Text></li>
                  <li style={{ marginBottom: 4 }}><Text code style={{ fontSize: 12 }}>{t('examples.riCoverage')}</Text></li>
                  <li style={{ marginBottom: 4 }}><Text code style={{ fontSize: 12 }}>{t('examples.unusedEbs')}</Text></li>
                  <li><Text code style={{ fontSize: 12 }}>{t('examples.s3Growth')}</Text></li>
                </ul>
              </div>
            </Card>

            <Card size="small">
              <Alert
                message={t('card.systemInfo')}
                description={
                  <ul style={{ paddingLeft: 16, marginBottom: 0, fontSize: 12 }}>
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
          </Space>
        </div>

        {/* 底部按钮栏 — flex-shrink: 0，始终可见，不遮挡内容 */}
        <div style={{
          flexShrink: 0,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
          padding: '8px 12px',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button size="small" onClick={() => navigate('/settings/alerts')} style={{ fontSize: 12, padding: '0 8px' }}>
              {t('cancel')}
            </Button>
            <Space size={6}>
              <Button
                type="default"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSave(true)}
                loading={savingAlert}
                style={{ fontSize: 12, padding: '0 8px' }}
              >
                {t('button.saveAndTest')}
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={() => handleSave(false)}
                loading={savingAlert}
                style={{ fontSize: 12, padding: '0 8px' }}
              >
                {t('save')}
              </Button>
            </Space>
          </Space>
        </div>
      </div>
    );
  }

  // ========== 桌面端布局 ==========
  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: '#f0f2f5',
      position: 'relative'
    }}>
      <Space direction="vertical" size="large" style={{
        width: '100%',
        padding: '24px',
        paddingBottom: 0
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/settings/alerts')}>
            {t('back')}
          </Button>
          <Title level={3}>
            📝 {isEdit ? t('edit') : t('create')}
          </Title>
        </Space>

        <Card title={t('card.basicInfo')}>
          <Form form={form} layout="vertical" autoComplete="off">
            <Form.Item
              label={t('form.name')}
              name="display_name"
              rules={[
                { required: true, message: t('form.nameRequired') },
                { max: 50, message: t('form.nameMaxLength', { max: 50 }) }
              ]}
            >
              <Input placeholder={t('form.namePlaceholder')} maxLength={50} />
            </Form.Item>

            <Alert message={t('tips.nameHint')} type="info" showIcon style={{ marginBottom: 16 }} />

            <Form.Item
              label={t('form.account')}
              name="account_id"
              rules={[{ required: true, message: t('form.accountRequired') }]}
            >
              <Select
                placeholder={t('form.accountPlaceholder')}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={[
                  ...awsAccounts.map(account => ({
                    value: account.id,
                    label: `☁️ ${t('account.aws')} - ${account.alias || account.account_id}`,
                    account
                  })),
                  ...gcpAccounts.map(account => ({
                    value: account.id,
                    label: `🔵 ${t('account.gcp')} - ${account.account_name || account.project_id}`,
                    account
                  }))
                ]}
              />
            </Form.Item>

            <Alert message={t('tips.accountHint')} type="info" showIcon style={{ marginBottom: 16 }} />

            <Form.Item
              label={t('form.description')}
              name="description"
              rules={[
                { required: true, message: t('form.descriptionRequired') },
                { min: 10, message: t('form.descriptionMinLength', { min: 10 }) }
              ]}
            >
              <TextArea placeholder={t('form.descriptionPlaceholder')} rows={9} maxLength={500} showCount />
            </Form.Item>

            <Alert message={t('tips.descriptionHint')} type="info" showIcon style={{ marginBottom: 16 }} />
          </Form>
        </Card>

        <Card title={t('card.examples')}>
          <Paragraph><Text type="secondary">{t('examples.title')}</Text></Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li><Text code>{t('examples.ec2Cost')}</Text></li>
            <li><Text code>{t('examples.riCoverage')}</Text></li>
            <li><Text code>{t('examples.unusedEbs')}</Text></li>
            <li><Text code>{t('examples.s3Growth')}</Text></li>
          </ul>
        </Card>

        <Card>
          <Alert
            message={t('card.systemInfo')}
            description={
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
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

        {/* 操作按钮 - sticky 底部 */}
        <div style={{
          position: 'sticky',
          bottom: 0,
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
            <Button onClick={() => navigate('/settings/alerts')}>{t('cancel')}</Button>
            <Space size={8}>
              <Button type="default" icon={<SendOutlined />} onClick={() => handleSave(true)} loading={savingAlert}>
                {t('button.saveAndTest')}
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave(false)} loading={savingAlert}>
                {t('save')}
              </Button>
            </Space>
          </Space>
        </div>
      </Space>
    </div>
  );
};
