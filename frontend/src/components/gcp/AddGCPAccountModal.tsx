// Add GCP Account Modal - 添加 GCP 账号对话框
import { type FC, useState } from 'react';
import { Modal, Form, Input, Upload, Alert, Space, Tabs, Button, message as antMessage } from 'antd';
import { GoogleOutlined, UploadOutlined, CodeOutlined } from '@ant-design/icons';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useI18n } from '../../hooks/useI18n';
import type { GCPAccountFormData } from '../../types/gcpAccount';

const { TextArea } = Input;

interface AddGCPAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

export const AddGCPAccountModal: FC<AddGCPAccountModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload'>('paste');
  const { addAccount } = useGCPAccountStore();
  const { t } = useI18n(['gcp', 'common']);

  // 验证 JSON 格式
  const validateJSON = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error(t('gcp:account.form.serviceAccountKeyRequired')));
    }

    try {
      const parsed = JSON.parse(value);

      // 验证必需字段
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          return Promise.reject(new Error(t('gcp:account.form.serviceAccountKeyInvalid')));
        }
      }

      if (parsed.type !== 'service_account') {
        return Promise.reject(new Error(t('gcp:account.form.serviceAccountKeyTypeError')));
      }

      return Promise.resolve();
    } catch {
      return Promise.reject(new Error(t('gcp:account.form.serviceAccountKeyFormatError')));
    }
  };

  // 处理文件上传
  const handleFileUpload = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const json = JSON.parse(text);

          // 将 JSON 设置到表单
          form.setFieldsValue({ service_account_json_text: JSON.stringify(json, null, 2) });
          antMessage.success(t('modal.uploadSuccess'));
          resolve();
        } catch (error) {
          antMessage.error(t('gcp.validation.invalidJson'));
          reject(error);
        }
      };

      reader.onerror = () => {
        antMessage.error(t('modal.uploadFailed'));
        reject(new Error(t('modal.uploadFailed')));
      };

      reader.readAsText(file);
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // 解析 JSON
      let serviceAccountJson;
      try {
        serviceAccountJson = JSON.parse(values.service_account_json_text);
      } catch {
        antMessage.error(t('gcp:account.form.serviceAccountKeyFormatError'));
        setSubmitting(false);
        return;
      }

      const formData: GCPAccountFormData = {
        account_name: values.account_name,
        service_account_json: serviceAccountJson,
        description: values.description,
        billing_export_project_id: values.billing_export_project_id,
        billing_export_dataset: values.billing_export_dataset,
        billing_export_table: values.billing_export_table,
      };

      // 调用 API 添加账号
      await addAccount(formData);

      antMessage.success(t('gcp:account.message.addSuccess'));
      form.resetFields();
      onCancel();
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        antMessage.error(error.message || t('gcp:account.message.addFailed'));
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
          <GoogleOutlined style={{ color: '#4285F4' }} />
          <span>{t('gcp:account.addModal.title')}</span>
        </Space>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText={t('common:button.confirm')}
      cancelText={t('common:button.cancel')}
      width={700}
      destroyOnClose
    >
      <Alert
        message={t('gcp:account.addModal.tip')}
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
          label={t('gcp:account.form.name')}
          name="account_name"
          rules={[
            { required: true, message: t('gcp:account.form.nameRequired') },
            { max: 100, message: t('gcp:account.form.nameMaxLength') }
          ]}
          tooltip={t('gcp:account.form.nameTooltip')}
        >
          <Input
            prefix={<GoogleOutlined />}
            placeholder={t('gcp:account.form.namePlaceholder')}
            maxLength={100}
          />
        </Form.Item>

        <Form.Item
          label={t('gcp:account.form.serviceAccountKey')}
          required
          tooltip={t('gcp:account.form.serviceAccountKeyTooltip')}
        >
          <Tabs
            activeKey={inputMethod}
            onChange={(key) => setInputMethod(key as 'paste' | 'upload')}
            items={[
              {
                key: 'paste',
                label: (
                  <Space>
                    <CodeOutlined />
                    {t('common:button.paste')} JSON
                  </Space>
                ),
                children: (
                  <Form.Item
                    name="service_account_json_text"
                    rules={[
                      { required: inputMethod === 'paste', message: t('gcp:account.form.serviceAccountKeyRequired') },
                      { validator: inputMethod === 'paste' ? validateJSON : undefined }
                    ]}
                    noStyle
                  >
                    <TextArea
                      rows={12}
                      placeholder={`{
  "type": "service_account",
  "project_id": "my-project-123",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "sa@my-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}`}
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </Form.Item>
                )
              },
              {
                key: 'upload',
                label: (
                  <Space>
                    <UploadOutlined />
                    {t('common:button.upload')}
                  </Space>
                ),
                children: (
                  <Upload
                    accept=".json"
                    maxCount={1}
                    beforeUpload={(file) => {
                      handleFileUpload(file);
                      return false;
                    }}
                    fileList={[]}
                  >
                    <Button icon={<UploadOutlined />}>
                      {t('common:button.selectFile')}
                    </Button>
                    <div style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
                      {t('common:hint.supportJsonFile')}
                    </div>
                  </Upload>
                )
              }
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('gcp:account.form.description')}
          name="description"
          rules={[{ max: 500, message: t('gcp:account.form.descriptionMaxLength') }]}
        >
          <TextArea
            rows={2}
            placeholder={t('gcp:account.form.descriptionPlaceholder')}
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* BigQuery Billing Export 配置 */}
        <Alert
          message={t('gcp:account.form.billingExportDataset')}
          description={
            <div>
              <p>{t('common:hint.billingExportTip')}</p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <strong>{t('common:label.example')}:</strong> <code>cy-export.cy_export.gcp_billing_export_resource_v1_XXX</code>
                <br />• {t('gcp:account.form.projectId')}: <code>cy-export</code>
                <br />• Dataset: <code>cy_export</code>
                <br />• {t('gcp:account.form.tableName')}: <code>gcp_billing_export_resource_v1_XXX</code>
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16, marginBottom: 16 }}
        />

        <Form.Item
          label={t('gcp:account.form.projectId')}
          name="billing_export_project_id"
        >
          <Input
            placeholder={t('gcp:account.form.datasetIdPlaceholder')}
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        <Form.Item
          label={t('gcp:account.form.datasetId')}
          name="billing_export_dataset"
        >
          <Input
            placeholder={t('gcp:account.form.billingExportDatasetPlaceholder')}
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        <Form.Item
          label={t('gcp:account.form.tableName')}
          name="billing_export_table"
          tooltip={t('gcp:account.form.tableNameTooltip')}
        >
          <Input
            placeholder={t('gcp:account.form.tableNamePlaceholder')}
            prefix={<GoogleOutlined />}
          />
        </Form.Item>
      </Form>

      <Alert
        type="warning"
        showIcon
        message={t('common:security.tip')}
        description={
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>{t('common:security.encryptedStorage')}</li>
            <li>{t('common:security.minimalPermission')}: <code>roles/billing.viewer</code></li>
            <li>{t('common:security.rotateKey')}</li>
          </ul>
        }
      />
    </Modal>
  );
};
