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
  const { t } = useI18n(['account', 'common']);

  // 验证 JSON 格式
  const validateJSON = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error('请粘贴 Service Account JSON Key'));
    }

    try {
      const parsed = JSON.parse(value);

      // 验证必需字段
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          return Promise.reject(new Error(`JSON Key 缺少必需字段: ${field}`));
        }
      }

      if (parsed.type !== 'service_account') {
        return Promise.reject(new Error('必须是 service_account 类型的密钥'));
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error('无效的 JSON 格式'));
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
      } catch (error) {
        antMessage.error('JSON 格式错误');
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

      antMessage.success('GCP 账号添加成功！');
      form.resetFields();
      onCancel();
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        antMessage.error(error.message || '添加 GCP 账号失败');
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
          <span>添加 GCP 账号</span>
        </Space>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText={t('modal.verifyAndAdd')}
      cancelText={t('common:button.cancel')}
      width={700}
      destroyOnClose
    >
      <Alert
        message="添加账号时会自动验证 Service Account 权限"
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
          label="账号名称"
          name="account_name"
          rules={[
            { required: true, message: '请输入账号名称' },
            { max: 100, message: '名称不能超过100个字符' }
          ]}
          tooltip="为账号设置一个容易识别的名称，例如：生产环境 GCP"
        >
          <Input
            prefix={<GoogleOutlined />}
            placeholder="例如：Production GCP"
            maxLength={100}
          />
        </Form.Item>

        <Form.Item
          label="Service Account JSON Key"
          required
          tooltip="从 GCP Console 下载的 Service Account JSON 密钥文件"
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
                    粘贴 JSON
                  </Space>
                ),
                children: (
                  <Form.Item
                    name="service_account_json_text"
                    rules={[
                      { required: inputMethod === 'paste', message: '请粘贴 JSON Key' },
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
                    上传文件
                  </Space>
                ),
                children: (
                  <Upload
                    accept=".json"
                    maxCount={1}
                    beforeUpload={(file) => {
                      handleFileUpload(file);
                      return false; // 阻止自动上传
                    }}
                    fileList={[]}
                  >
                    <Button icon={<UploadOutlined />}>
                      选择 JSON 文件
                    </Button>
                    <div style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
                      支持 .json 格式文件
                    </div>
                  </Upload>
                )
              }
            ]}
          />
        </Form.Item>

        <Form.Item
          label="描述（可选）"
          name="description"
          rules={[{ max: 500, message: '描述不能超过500个字符' }]}
        >
          <TextArea
            rows={2}
            placeholder="例如：生产环境 GCP 项目，用于成本分析"
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* BigQuery Billing Export 配置 */}
        <Alert
          message="BigQuery Billing Export 配置（可选）"
          description={
            <div>
              <p>如果你已在 GCP 中配置了 Billing Export 到 BigQuery，可以填写以下信息以启用成本分析功能。</p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <strong>示例：</strong>完整表路径是 <code>cy-export.cy_export.gcp_billing_export_resource_v1_XXX</code>，则分别填写：
                <br />• 项目 ID: <code>cy-export</code>
                <br />• Dataset: <code>cy_export</code>
                <br />• 表名: <code>gcp_billing_export_resource_v1_XXX</code>（只填表名部分）
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16, marginBottom: 16 }}
        />

        <Form.Item
          label="BigQuery 项目 ID"
          name="billing_export_project_id"
          tooltip="BigQuery billing export 数据所在的 GCP 项目 ID"
        >
          <Input
            placeholder="例如：cy-export"
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        <Form.Item
          label="BigQuery Dataset 名称"
          name="billing_export_dataset"
          tooltip="BigQuery 中存储 billing export 的 dataset 名称（下划线格式）"
        >
          <Input
            placeholder="例如：cy_export"
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        <Form.Item
          label="BigQuery 表名"
          name="billing_export_table"
          tooltip="只填写表名（不包含项目和 dataset），通常以 gcp_billing_export_resource_v1_ 开头"
        >
          <Input
            placeholder="例如：gcp_billing_export_resource_v1_015B75_932950_C931B5"
            prefix={<GoogleOutlined />}
          />
        </Form.Item>
      </Form>

      <Alert
        type="warning"
        showIcon
        message={t('modal.securityTip')}
        description={
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Service Account JSON Key 将加密存储在数据库中</li>
            <li>建议为该 SA 授予最小权限：<code>roles/billing.viewer</code></li>
            <li>定期轮换 Service Account Key 以提高安全性</li>
          </ul>
        }
      />
    </Modal>
  );
};
