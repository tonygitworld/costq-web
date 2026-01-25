// Status Card Component - 轻量级状态提示（Perplexity 风格）
import React, { useEffect, useState } from 'react';
import { LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import './StatusCard.css';

export interface StatusCardProps {
  statusType: 'initializing' | 'processing' | 'ready' | 'error';
  message: string;
  estimatedSeconds?: number;
  details?: string[];
  onComplete?: () => void;
}

const StatusCard: React.FC<StatusCardProps> = ({
  statusType,
  message,
  // estimatedSeconds, // 暂时未使用，避免 TS 报错
  details = [],
  onComplete
}) => {
  const [visible, setVisible] = useState(true);

  // 就绪状态自动消失
  useEffect(() => {
    if (statusType === 'ready' && onComplete) {
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [statusType, onComplete]);

  if (!visible) return null;

  const getStatusIcon = () => {
    switch (statusType) {
      case 'initializing':
      case 'processing':
        return <LoadingOutlined spin className="status-icon-loading" />;
      case 'ready':
        return <CheckCircleOutlined className="status-icon-success" />;
      case 'error':
        return <ExclamationCircleOutlined className="status-icon-error" />;
    }
  };

  // 统一文案处理：消除蓝橙差异，统一为中性表达
  const getDisplayMessage = () => {
    if (statusType === 'initializing') return message; // "正在接入 AWS 账号..."
    if (statusType === 'processing') return "正在分析数据...";
    return message;
  };

  return (
    <div className="status-line-container">
      <div className="status-line-main">
        <div className="status-icon-wrapper">
          {getStatusIcon()}
        </div>

        <span className="status-text">
          {getDisplayMessage()}
        </span>

        {/* 移除时间显示，保持界面简洁 */}
      </div>

      {/* 详情部分 - 默认折叠，可扩展 */}
      {details && details.length > 0 && (
        <div className="status-details-wrapper">
           {/* 这里可以做成点击展开，目前保持简洁，暂不显示或仅显示第一条 */}
        </div>
      )}
    </div>
  );
};

export default StatusCard;
