import React from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useI18n } from '../../hooks/useI18n';
import './NoAccountScreen.css';

interface NoAccountScreenProps {
  onConfigure?: () => void;
}

export const NoAccountScreen: React.FC<NoAccountScreenProps> = ({
  onConfigure
}) => {
  const { isZhCN } = useI18n();

  const title = isZhCN() ? '欢迎使用 CostQ' : 'Welcome to CostQ';
  const subtitle = isZhCN()
    ? '开始之前，请先配置您的云账号'
    : 'Before starting, please configure your cloud accounts';
  const buttonText = isZhCN() ? '配置云账号' : 'Configure Cloud Account';
  const description = isZhCN()
    ? '配置云账号后，您可以使用 CostQ 进行成本分析、优化建议和账单管理'
    : 'After configuring cloud accounts, you can use CostQ for cost analysis, optimization recommendations, and billing management';

  return (
    <div className="no-account-screen">
      <div className="no-account-content">
        {/* 标题 */}
        <h1 className="no-account-title">{title}</h1>

        {/* 副标题 */}
        <p className="no-account-subtitle">{subtitle}</p>

        {/* 描述 */}
        <p className="no-account-description">{description}</p>

        {/* 操作按钮 */}
        <div className="no-account-actions">
          <button
            className="no-account-btn no-account-btn-primary"
            onClick={onConfigure}
          >
            <PlusOutlined style={{ marginRight: 8 }} />
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
