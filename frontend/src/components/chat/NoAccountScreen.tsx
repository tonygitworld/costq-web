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
  const { t } = useI18n('chat');

  return (
    <div className="no-account-screen">
      <div className="no-account-content">
        {/* 标题 */}
        <h1 className="no-account-title">{t('noAccount.title')}</h1>

        {/* 副标题 */}
        <p className="no-account-subtitle">{t('noAccount.subtitle')}</p>

        {/* 描述 */}
        <p className="no-account-description">{t('noAccount.description')}</p>

        {/* 操作按钮 */}
        <div className="no-account-actions">
          <button
            className="no-account-btn no-account-btn-primary"
            onClick={onConfigure}
          >
            <PlusOutlined style={{ marginRight: 8 }} />
            {t('noAccount.configureButton')}
          </button>
        </div>
      </div>
    </div>
  );
};
