/**
 * AWS API 确认对话框组件
 *
 * 用于显示 AWS API 操作的确认请求，包括：
 * - 工具名称和参数
 * - 风险等级（低/中/高）
 * - 倒计时（5分钟）
 * - 批准/拒绝按钮
 *
 * 使用 Ant Design 组件实现
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Alert,
  Typography,
  Progress,
  Tag,
  Card,
  Space,
  Divider
} from 'antd';
import {
  WarningOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface AWSAPIConfirmationDialogProps {
  open: boolean;
  confirmationId: string;
  toolName: string;
  arguments: Record<string, any>;
  title: string;
  description: string;
  warning: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeoutSeconds: number;
  onApprove: (confirmationId: string) => void;
  onReject: (confirmationId: string) => void;
}

/**
 * 获取风险等级配置
 */
const getRiskConfig = (riskLevel: 'low' | 'medium' | 'high') => {
  switch (riskLevel) {
    case 'high':
      return {
        color: '#ff4d4f',
        icon: <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
        label: '高风险',
        emoji: '🚨',
        tagColor: 'error' as const
      };
    case 'medium':
      return {
        color: '#faad14',
        icon: <WarningOutlined style={{ fontSize: 24, color: '#faad14' }} />,
        label: '中等风险',
        emoji: '⚠️',
        tagColor: 'warning' as const
      };
    case 'low':
      return {
        color: '#1677ff',
        icon: <InfoCircleOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
        label: '低风险',
        emoji: 'ℹ️',
        tagColor: 'default' as const
      };
  }
};

/**
 * 格式化倒计时显示
 */
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 格式化 JSON 参数显示
 */
const formatArguments = (args: Record<string, any>): string => {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
};

export const AWSAPIConfirmationDialog: React.FC<AWSAPIConfirmationDialogProps> = ({
  open,
  confirmationId,
  toolName,
  arguments: args,
  title,
  description,
  warning,
  riskLevel,
  timeoutSeconds,
  onApprove,
  onReject
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutSeconds);
  const [isProcessing, setIsProcessing] = useState(false);

  const riskConfig = getRiskConfig(riskLevel);

  // 倒计时逻辑
  useEffect(() => {
    if (!open) {
      setRemainingSeconds(timeoutSeconds);
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // 超时自动拒绝
          handleReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, timeoutSeconds]);

  const handleApprove = () => {
    setIsProcessing(true);
    onApprove(confirmationId);
  };

  const handleReject = () => {
    setIsProcessing(true);
    onReject(confirmationId);
  };

  // 计算进度条百分比
  const progress = (remainingSeconds / timeoutSeconds) * 100;

  return (
    <Modal
      open={open}
      onCancel={handleReject}
      width={600}
      footer={null}
      closable={false}
      maskClosable={false}
      styles={{
        content: {
          borderTop: `4px solid ${riskConfig.color}`
        }
      }}
    >
      {/* 标题栏 */}
      <div style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {riskConfig.icon}
            <Title level={5} style={{ margin: 0 }}>
              {title}
            </Title>
          </Space>
          <Tag color={riskConfig.tagColor}>{riskConfig.label}</Tag>
        </Space>
      </div>

      <Divider style={{ margin: '0 0 16px 0' }} />

      {/* 警告提示 */}
      <Alert
        message={
          <Text strong>
            {riskConfig.emoji} {warning}
          </Text>
        }
        description={description}
        type={riskLevel === 'high' ? 'error' : riskLevel === 'medium' ? 'warning' : 'info'}
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 工具信息 */}
      <Card
        size="small"
        style={{ marginBottom: 16, backgroundColor: '#fafafa' }}
      >
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          工具名称
        </Text>
        <div style={{
          backgroundColor: '#fff',
          padding: '8px 12px',
          borderRadius: 4,
          marginBottom: 16,
          fontFamily: 'monospace',
          fontSize: 13
        }}>
          {toolName}
        </div>

        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          操作参数
        </Text>
        <Card
          size="small"
          style={{
            backgroundColor: '#fff',
            maxHeight: 200,
            overflow: 'auto'
          }}
        >
          <pre style={{
            margin: 0,
            fontSize: '12px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {formatArguments(args)}
          </pre>
        </Card>
      </Card>

      {/* 倒计时进度条 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            剩余时间
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: remainingSeconds < 30 ? '#ff4d4f' : undefined
            }}
          >
            {formatTime(remainingSeconds)}
          </Text>
        </div>
        <Progress
          percent={progress}
          strokeColor={remainingSeconds < 30 ? '#ff4d4f' : '#1677ff'}
          showInfo={false}
          strokeLinecap="round"
          strokeWidth={8}
          size="small"
        />
      </div>

      <Text
        type="secondary"
        style={{
          fontSize: 12,
          display: 'block',
          textAlign: 'center',
          marginBottom: 16
        }}
      >
        {remainingSeconds < 30 ? '⏰ 即将超时！' : '请在超时前确认操作'}
      </Text>

      <Divider style={{ margin: '0 0 16px 0' }} />

      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button
          onClick={handleReject}
          disabled={isProcessing}
          icon={<CloseOutlined />}
        >
          拒绝
        </Button>
        <Button
          onClick={handleApprove}
          disabled={isProcessing}
          type="primary"
          danger={riskLevel === 'high'}
          icon={<CheckCircleOutlined />}
          autoFocus={riskLevel !== 'high'}
        >
          {riskLevel === 'high' ? '确认执行（高风险）' : '批准'}
        </Button>
      </div>
    </Modal>
  );
};

export default AWSAPIConfirmationDialog;
