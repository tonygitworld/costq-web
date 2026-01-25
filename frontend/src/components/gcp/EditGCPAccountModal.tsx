// Edit GCP Account Modal - 编辑 GCP 账号对话框
import { type FC, useEffect, useState } from 'react';
import { Modal, Form, Input, Alert, message as antMessage } from 'antd';
import { GoogleOutlined, EditOutlined } from '@ant-design/icons';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
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

      antMessage.success('GCP 账号更新成功！');
      onCancel();
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        antMessage.error(error.message || '更新 GCP 账号失败');
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
          编辑 GCP 账号
        </span>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      width={700}
      destroyOnClose
    >
      <Alert
        message="提示"
        description="Service Account 信息不可修改。如需更换 Service Account，请删除后重新添加。"
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
          label="GCP 项目 ID"
          tooltip="此字段不可修改"
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
          tooltip="此字段不可修改"
        >
          <Input
            value={account.service_account_email}
            disabled
            prefix={<GoogleOutlined />}
          />
        </Form.Item>

        {/* 可编辑字段：账号名称 */}
        <Form.Item
          label="账号名称"
          name="account_name"
          rules={[
            { required: true, message: '请输入账号名称' },
            { max: 100, message: '名称不能超过100个字符' }
          ]}
        >
          <Input
            prefix={<GoogleOutlined />}
            placeholder="例如：Production GCP"
            maxLength={100}
          />
        </Form.Item>

        {/* 可编辑字段：描述 */}
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
              <p>修改 BigQuery 配置以更新成本分析数据源。</p>
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
    </Modal>
  );
};
