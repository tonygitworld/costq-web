// Add Account Modal - 添加 AWS 账号对话框
import { type FC, useState } from 'react';
import { Modal, Form, Input, Select, message, Space, Alert, Tabs } from 'antd';
import { CloudOutlined, LockOutlined, GlobalOutlined, KeyOutlined, CloudServerOutlined } from '@ant-design/icons';
import { useAccountStore, type AccountFormData } from '../../stores/accountStore';
import { IAMRoleTab } from './IAMRoleTab';
import { useI18n } from '../../hooks/useI18n';

const { Option } = Select;
const { TextArea } = Input;

interface AddAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

// AWS 区域列表
const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
];

export const AddAccountModal: FC<AddAccountModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('aksk');
  const { addAccount } = useAccountStore();
  const { t } = useI18n(['account', 'common']);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // 调用 API 添加账号
      await addAccount(values as AccountFormData);

      message.success(t('aws.message.createSuccess'));
      form.resetFields();
      onCancel();
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || t('modal.addFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <CloudOutlined style={{ color: '#1890ff' }} />
          <span>{t('modal.addAccount')}</span>
        </Space>
      }
      open={visible}
      onOk={activeTab === 'aksk' ? handleSubmit : undefined}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText={activeTab === 'aksk' ? t('modal.verifyAndAdd') : undefined}
      cancelText={t('common:button.cancel')}
      width={800}
      destroyOnClose
      footer={activeTab === 'iam_role' ? null : undefined}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'aksk',
            label: (
              <span>
                <KeyOutlined />
                {' '}{t('form.akskMethod')}
              </span>
            ),
            children: (
              <>
                <Alert
                  message={t('modal.securityDesc')}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label={t('form.accountAlias')}
          name="alias"
          rules={[
            { required: true, message: t('form.accountAliasRequired') },
          ]}
        >
          <Input
            prefix={<CloudOutlined />}
            placeholder={t('form.accountAliasPlaceholder')}
            maxLength={100}
          />
        </Form.Item>

        <Form.Item
          label="Access Key ID"
          name="access_key_id"
          rules={[
            { required: true, message: '请输入 Access Key ID' },
            { min: 16, message: 'Access Key ID 至少16个字符' },
            { max: 128, message: 'Access Key ID 不能超过128个字符' },
            { pattern: /^[A-Z0-9]+$/, message: 'Access Key ID 只能包含大写字母和数字' }
          ]}
          tooltip="AWS IAM 用户的 Access Key ID，通常以 AKIA 开头"
        >
          <Input
            placeholder="AKIAIOSFODNN7EXAMPLE"
            maxLength={128}
          />
        </Form.Item>

        <Form.Item
          label="Secret Access Key"
          name="secret_access_key"
          rules={[
            { required: true, message: '请输入 Secret Access Key' },
            { min: 16, message: 'Secret Access Key 至少16个字符' }
          ]}
          tooltip="AWS IAM 用户的 Secret Access Key，创建后只显示一次，请妥善保管"
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          label={t('form.defaultRegion')}
          name="region"
          initialValue="us-east-1"
          rules={[{ required: true, message: t('form.regionRequired') }]}
          tooltip="该账号的默认 AWS 区域"
        >
          <Select
            placeholder={t('form.selectRegion')}
            showSearch
            optionFilterProp="label"
            suffixIcon={<GlobalOutlined />}
          >
            {AWS_REGIONS.map(region => (
              <Option key={region.value} value={region.value} label={region.label}>
                {region.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label={t('form.description')}
          name="description"
        >
          <TextArea
            placeholder={t('form.descriptionPlaceholder')}
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>

      <Alert
        message={
          <div>
            <strong>{t('modal.securityTip')}：</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>{t('form.securityTipList.item1')}</li>
              <li>{t('form.securityTipList.item2')}</li>
              <li>{t('form.securityTipList.item3')}</li>
            </ul>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
              </>
            ),
          },
          {
            key: 'iam_role',
            label: (
              <span>
                <CloudServerOutlined />
                {' '}{t('form.iamRoleMethod')}
              </span>
            ),
            children: (
              <IAMRoleTab
                onSuccess={() => {
                  onSuccess?.();
                  handleCancel();
                }}
                onCancel={handleCancel}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
};
