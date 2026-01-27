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
                <Spin tip="加载中..." />
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
                      这是您组织的唯一标识符，用于安全验证
                    </Text>
                  </div>

                  {/* Platform Account ID */}
                  <div>
                    <Text strong>CostQ 平台账号 ID:</Text>
                    <Input
                      value={externalIdInfo.platform_account_id}
                      readOnly
                      addonAfter={
                        <CopyOutlined
                          style={{ cursor: 'pointer' }}
                          onClick={() => copyToClipboard(externalIdInfo.platform_account_id, '平台账号 ID')}
                        />
                      }
                    />
                  </div>

                  {/* CloudFormation Template URL */}
                  <div>
                    <Text strong>CloudFormation 模板 URL:</Text>
                    <Input
                      value={externalIdInfo.cloudformation_template_url}
                      readOnly
                      addonAfter={
                        <CopyOutlined
                          style={{ cursor: 'pointer' }}
                          onClick={() => copyToClipboard(externalIdInfo.cloudformation_template_url, '模板 URL')}
                        />
                      }
                    />
                  </div>

                  <Alert
                    message="自动填充"
                    description="External ID 和平台账号 ID 已自动填充到 CloudFormation 参数中，您只需点击下方按钮即可部署"
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
                    点击后将在新标签页打开 AWS 控制台，参数已自动填充
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
                  在打开的 AWS CloudFormation 控制台中完成部署
                </Paragraph>
              </div>

              <Steps direction="vertical" size="small" current={-1}>
                <Step
                  title="审查参数"
                  description="确认 External ID 和平台账号 ID 已自动填充"
                  icon={<CheckCircleOutlined />}
                />
                <Step
                  title="勾选权限确认"
                  description='勾选 "我确认 AWS CloudFormation 可能创建 IAM 资源" 复选框'
                  icon={<CheckCircleOutlined />}
                />
                <Step
                  title="创建 Stack"
                  description="点击 Create Stack 按钮并等待完成（约 1-2 分钟）"
                  icon={<CheckCircleOutlined />}
                />
                <Step
                  title="复制 Role ARN"
                  description="在 Outputs 标签页中找到并复制 RoleArn 的值"
                  icon={<CheckCircleOutlined />}
                />
              </Steps>

              <Alert
                message="提示"
                description="CloudFormation Stack 创建完成后，请前往 Outputs 标签页复制 RoleArn"
                type="warning"
                showIcon
              />

              <Button
                type="primary"
                block
                onClick={() => setCurrentStep(2)}
              >
                我已完成部署，继续下一步
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
                  填写 Role ARN 和账号信息
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
                  label="账号别名"
                  name="alias"
                  rules={[{ required: true, message: '请输入账号别名' }]}
                >
                  <Input placeholder="例如: Production Account" />
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      IAM Role ARN
                      <Tooltip title="从 CloudFormation Outputs 中复制的 RoleArn 值">
                        <Tag color="blue" style={{ marginLeft: 8 }}>必填</Tag>
                      </Tooltip>
                    </span>
                  }
                  name="role_arn"
                  rules={[
                    { required: true, message: '请输入 IAM Role ARN' },
                    {
                      pattern: /^arn:aws:iam::\d{12}:role\/.+/,
                      message: '请输入有效的 IAM Role ARN 格式'
                    }
                  ]}
                >
                  <Input placeholder="arn:aws:iam::123456789012:role/CostQRole" />
                </Form.Item>

                <Form.Item
                  label="默认区域"
                  name="region"
                  rules={[{ required: true, message: '请选择默认区域' }]}
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
                  label="描述"
                  name="description"
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="账号描述（可选）"
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
                      添加账号
                    </Button>
                    <Button onClick={onCancel}>
                      取消
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
