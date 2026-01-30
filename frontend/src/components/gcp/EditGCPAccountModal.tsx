// Edit GCP Account Modal - 编辑 GCP 账号对话框
import { type FC, useEffect, useState } from 'react';
import { Modal, Form, Input, Alert, message as antMessage } from 'antd';
import { GoogleOutlined, EditOutlined } from '@ant-design/icons';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useI18n } from '../../hooks/useI18n';
import type { GCPAccount } from '../../types/gcpAccount';

const { TextArea } = Input;

interface EditGCPAccountModalProps {
  visible: boolean;
  account: GCPAccount | null;
  onCancel: () => void;
  onSuccess?: () => void;
}

export const EditGCPAccountModal: FC<EditGCPAccountModalProps> = ({
  visible,
  account,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { updateAccount } = useGCPAccountStore();
  const { t } = useI18n(['gcp', 'common']);

  // 当账号数据变化时，更新表单
  useEffect(() => {
    if (account && visible) {
      form.setFieldsValue({
        account_name: account.account_name,
        description: account.description,
        billing_export_project_id: account.billing_export_project_id,
        billing_export_dataset: account.billing_export_dataset,
        billing_export_table: account.billing_export_table,
      });
    }
  }, [account, visible, form]);

  const handleSubmit = async () => {
    if (!account) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await updateAccount(account.id, {
        account_name: values.account_name,
        description: values.description,
        billing_export_project_id: values.billing_export_project_id,
        billing_export_dataset: values.billing_export_dataset,
        billing_export_table: values.billing_export_table,
      });

      antMessage.success(t('gcp:account.message.updateSuccess'));
      onCancel();
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        antMessage.error(error.message || t('gcp:account.message.updateFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  if (!account) return null;

  return (
    <Modal
      title={
        <span>
          <EditOutlined style={{ color: '#4285F4', marginRight: 8 }} />
          {t('gcp:account.editModal.title')}
        </span>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText={t('common:button.save')}
      cancelText={t('common:button.cancel')}
      width={700}
      destroyOnHidden
    >
      <Alert
        message={t('gcp:account.editModal.tip')}
        description={t('common:hint.serviceAccountReadonly')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        {/* 只读字段：GCP 项目 ID */}
        <Form.Item
          label={t('gcp:account.form.projectId')}
          tooltip={t('gcp:account.form.projectIdReadonly')}
        >
          <Input
            value={account.project_id}
            disabled
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        {/* 只读字段：Service Account */}
        <Form.Item
          label="Service Account"
          tooltip={t('gcp:account.form.projectIdReadonly')}
        >
          <Input
            value={account.service_account_email}
            disabled
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        {/* 可编辑字段：账号名称 */}
        <Form.Item
          label={t('gcp:account.form.name')}
          name="account_name"
          rules={[
            { required: true, message: t('gcp:account.form.nameRequired') },
            { max: 100, message: t('gcp:account.form.nameMaxLength') }
          ]}
        >
          <Input
            prefix={<GoogleOutlined />}
            placeholder={t('gcp:account.form.namePlaceholder')}
            maxLength={100}
          />
        </Form.Item>

        {/* 可编辑字段：描述 */}
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
    </Modal>
  );
};
