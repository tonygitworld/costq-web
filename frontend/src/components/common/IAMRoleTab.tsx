// IAM Role Tab - IAM Role 方式添加 AWS 账号
import { type FC, useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Steps,
  Card,
  Typography,
  Space,
  Alert,
  Spin,
  Select,
  InputNumber,
  message,
  Tooltip,
  Tag
} from 'antd';
import {
  CloudServerOutlined,
  LinkOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useAccountStore, type IAMRoleFormData, type ExternalIdInfo } from '../../stores/accountStore';
import { useI18n } from '../../hooks/useI18n';

import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/ErrorHandler';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface IAMRoleTabProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const IAMRoleTab: FC<IAMRoleTabProps> = ({ onSuccess, onCancel }) => {
  const [form] = Form.useForm();
  const { addIAMRoleAccount, getExternalId } = useAccountStore();
  const { t } = useI18n(['account', 'common']);

  const [currentStep, setCurrentStep] = useState(0);
  const [externalIdInfo, setExternalIdInfo] = useState<ExternalIdInfo | null>(null);
  const [loadingExtId, setLoadingExtId] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 加载 External ID
  useEffect(() => {
    loadExternalId();
  }, []);

  const loadExternalId = async () => {
    setLoadingExtId(true);
    try {
      const info = await getExternalId();
      setExternalIdInfo(info);
    } catch {
      message.error(t('iamRole.loadingError'));
    } finally {
      setLoadingExtId(false);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} ${t('common:message.operationSuccess')}`);
  };

  // 提交表单
  const handleSubmit = async (values: IAMRoleFormData) => {
    logger.debug('[IAMRoleTab] 开始提交表单:', values);
    setSubmitting(true);

    try {
      logger.debug('[IAMRoleTab] 调用 addIAMRoleAccount...');
      await addIAMRoleAccount(values);
      logger.debug('[IAMRoleTab] 添加成功');
      message.success(t('aws.message.createSuccess'));
      form.resetFields();
      onSuccess?.();
    } catch (error: unknown) {
      logger.error('[IAMRoleTab] 捕获到错误:', error);

      let errorMsg = getErrorMessage(error, '添加账号失败');

      // 特殊处理重名错误
      if (errorMsg.includes('已存在') || errorMsg.includes('already exists')) {
        errorMsg = `账号别名已存在，请使用不同的名称。${errorMsg}`;
      }

      logger.debug('[IAMRoleTab] 显示错误消息:', errorMsg);
      message.error(errorMsg, 5); // 显示5秒
    } finally {
      logger.debug('[IAMRoleTab] 提交流程结束');
      setSubmitting(false);
    }
  };

  // 步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={5}>
                  <CloudServerOutlined /> {t('iamRole.step1Title')}
                </Title>
                <Paragraph type="secondary">
                  {t('iamRole.step1Desc')}
                </Paragraph>
              </div>

              {loadingExtId ? (
                <Spin tip={t('common:status.loading')} />
              ) : externalIdInfo ? (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {/* External ID */}
                  <div>
                    <Text strong>External ID:</Text>
                    <Input
                      value={externalIdInfo.external_id}
                      readOnly
                      addonAfter={
                        <CopyOutlined
                          style={{ cursor: 'pointer' }}
                          onClick={() => copyToClipboard(externalIdInfo.external_id, 'External ID')}
                        />
                      }
                    />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t('iamRole.externalIdDesc')}
                    </Text>
                  </div>

                  {/* Platform Account ID */}
                  <div>
                    <Text strong>{t('iamRole.platformAccountIdLabel')}</Text>
                    <Input
                      value={externalIdInfo.platform_account_id}
                      readOnly
                      addonAfter={
                        <CopyOutlined
                          style={{ cursor: 'pointer' }}
                          onClick={() => copyToClipboard(externalIdInfo.platform_account_id, t('iamRole.platformAccountIdLabel'))}
                        />
                      }
                    />
                  </div>

                  {/* CloudFormation Template URL */}
                  <div>
                    <Text strong>{t('iamRole.cfnTemplateUrlLabel')}</Text>
                    <Input
                      value={externalIdInfo.cloudformation_template_url}
                      readOnly
                      addonAfter={
                        <CopyOutlined
                          style={{ cursor: 'pointer' }}
                          onClick={() => copyToClipboard(externalIdInfo.cloudformation_template_url, 'CloudFormation URL')}
                        />
                      }
                    />
                  </div>

                  <Alert
                    message={t('iamRole.autoFillTitle')}
                    description={t('iamRole.autoFillDesc')}
                    type="info"
                    showIcon
                  />

                  {/* Quick Create Button */}
                  <Button
                    type="primary"
                    size="large"
                    icon={<RocketOutlined />}
                    block
                    onClick={() => {
                      window.open(externalIdInfo.quick_create_url, '_blank');
                      setCurrentStep(1);
                    }}
                  >
                    {t('iamRole.deployButton')}
                  </Button>

                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {t('iamRole.deployNote')}
                  </Text>
                </Space>
              ) : (
                <Alert title={t('iamRole.loadingError')} type="error" />
              )}
            </Space>
          </Card>
        );

      case 1:
        return (
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={5}>
                  <LinkOutlined /> {t('iamRole.step2Title')}
                </Title>
                <Paragraph type="secondary">
                  {t('iamRole.step2Instruction')}
                </Paragraph>
              </div>

              <Steps direction="vertical" size="small" current={-1}>
                <Step
                  title={t('iamRole.reviewParams')}
                  description={t('iamRole.reviewParamsDesc')}
                  icon={<CheckCircleOutlined />}
                />
                <Step
                  title={t('iamRole.checkPermission')}
                  description={t('iamRole.checkPermissionDesc')}
                  icon={<CheckCircleOutlined />}
                />
                <Step
                  title={t('iamRole.createStack')}
                  description={t('iamRole.createStackDesc')}
                  icon={<CheckCircleOutlined />}
                />
                <Step
                  title={t('iamRole.copyRoleArn')}
                  description={t('iamRole.copyRoleArnDesc')}
                  icon={<CheckCircleOutlined />}
                />
              </Steps>

              <Alert
                message={t('iamRole.tipTitle')}
                description={t('iamRole.tipDesc')}
                type="warning"
                showIcon
              />

              <Button
                type="primary"
                block
                onClick={() => setCurrentStep(2)}
              >
                {t('iamRole.deployDoneButton')}
              </Button>
            </Space>
          </Card>
        );

      case 2:
        return (
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={5}>
                  <CloudServerOutlined /> {t('iamRole.step3Title')}
                </Title>
                <Paragraph type="secondary">
                  {t('iamRole.step3Instruction')}
                </Paragraph>
              </div>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                  region: 'us-east-1',
                  session_duration: 3600
                }}
              >
                <Form.Item
                  label={t('form.accountAlias')}
                  name="alias"
                  rules={[{ required: true, message: t('form.accountAliasRequired') }]}
                >
                  <Input placeholder={t('form.accountAliasPlaceholder')} />
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      IAM Role ARN
                      <Tooltip title={t('iamRole.copyRoleArnDesc')}>
                        <Tag color="blue" style={{ marginLeft: 8 }}>{t('common:common.required')}</Tag>
                      </Tooltip>
                    </span>
                  }
                  name="role_arn"
                  rules={[
                    { required: true, message: t('aws.validation.roleArnRequired') },
                    {
                      pattern: /^arn:aws:iam::\d{12}:role\/.+/,
                      message: t('iamRole.roleArnInvalid')
                    }
                  ]}
                >
                  <Input placeholder="arn:aws:iam::123456789012:role/CostQRole" />
                </Form.Item>

                <Form.Item
                  label={t('form.defaultRegion')}
                  name="region"
                  rules={[{ required: true, message: t('form.regionRequired') }]}
                >
                  <Select>
                    <Select.Option value="us-east-1">US East (N. Virginia)</Select.Option>
                    <Select.Option value="us-west-2">US West (Oregon)</Select.Option>
                    <Select.Option value="ap-southeast-1">Asia Pacific (Singapore)</Select.Option>
                    <Select.Option value="ap-northeast-1">Asia Pacific (Tokyo)</Select.Option>
                    <Select.Option value="eu-west-1">Europe (Ireland)</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="session_duration"
                  hidden
                  initialValue={3600}
                >
                  <InputNumber />
                </Form.Item>

                <Form.Item
                  label={t('form.description')}
                  name="description"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder={t('iamRole.descPlaceholder')}
                  />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                      icon={<CheckCircleOutlined />}
                    >
                      {t('management.addAccount')}
                    </Button>
                    <Button onClick={onCancel}>
                      {t('common:button.cancel')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Space>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title={t('iamRole.stepTitle1')} description={t('iamRole.stepDesc1')} />
        <Step title={t('iamRole.stepTitle2')} description={t('iamRole.stepDesc2')} />
        <Step title={t('iamRole.stepTitle3')} description={t('iamRole.stepDesc3')} />
      </Steps>

      {renderStepContent()}
    </div>
  );
};
