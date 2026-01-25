/**
 * PromptTemplatesSection - 提示词模板区域
 *
 * 折叠卡片容器，显示常用模板
 */

import React, { useEffect, useState } from 'react';
import { Collapse, Space, Typography, Button, Alert, Spin } from 'antd';
import { BulbOutlined, AppstoreOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { PromptTemplateGrid } from './PromptTemplateGrid';
import { AllTemplatesModal } from './AllTemplatesModal';
import { CustomTemplateManager } from './CustomTemplateManager';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useI18n } from '../../hooks/useI18n';

const { Text } = Typography;

export const PromptTemplatesSection: React.FC = () => {
  const {
    systemTemplates,
    userTemplates,
    loadSystemTemplates,
    loadUserTemplates,
    systemLoading,
    error,
    clearError
  } = usePromptTemplateStore();
  const { t } = useI18n('chat');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showCustomManager, setShowCustomManager] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // ✅ 优化：顺序加载而非并行加载，减少并发请求压力
    const loadTemplates = async () => {
      try {
        // 先加载系统模板
        await loadSystemTemplates('cost');
        // 系统模板加载完成后再加载用户模板
        await loadUserTemplates();
      } catch (err) {
        console.error('加载模板失败:', err);
        // 错误已经在 store 中处理，这里不需要额外处理
      }
    };

    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]); // 当 retryCount 变化时重新加载

  // 重试加载
  const handleRetry = () => {
    clearError();
    setRetryCount(prev => prev + 1);
  };

  // 获取收藏的用户模板（最多2个）
  const favoriteUserTemplates = userTemplates
    .filter(t => t.is_favorite)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 2);

  // 组合模板：系统模板（前6个）+ 收藏的用户模板（最多2个）
  const topSystemTemplates = systemTemplates.slice(0, 6);
  const topTemplates = [...topSystemTemplates, ...favoriteUserTemplates];

  // 如果正在加载系统模板，显示加载状态
  if (systemLoading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#fafafa',
        borderBottom: '1px solid #e8e8e8'
      }}>
        <Space direction="vertical" size="small">
          <Spin size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>加载模板中...</Text>
        </Space>
      </div>
    );
  }

  // 如果加载失败且没有模板，显示错误提示
  if (error && topTemplates.length === 0) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#fff7e6',
        borderBottom: '1px solid #ffd591'
      }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Alert
            message="模板加载失败"
            description={error}
            type="warning"
            showIcon
            closable
            action={
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRetry}
              >
                重试
              </Button>
            }
          />
        </Space>
      </div>
    );
  }

  // 如果没有模板，返回 null（静默失败）
  if (topTemplates.length === 0) {
    return null;
  }

  return (
    <>
      <Collapse
        defaultActiveKey={[]}
        ghost
        expandIconPlacement="end"
        style={{
          backgroundColor: '#fafafa',
          borderTop: '1px solid #e8e8e8',
          borderBottom: '1px solid #e8e8e8',
          marginBottom: 0
        }}
        items={[
          {
            key: '1',
            label: (
              <Space size={9}>
                <BulbOutlined style={{ color: '#faad14', fontSize: 15 }} />
                <Text strong style={{ fontSize: 13 }}>{t('template.title')}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('template.description')}
                </Text>
              </Space>
            ),
            children: (
              <div style={{ padding: '9px 0' }}>
                <PromptTemplateGrid templates={topTemplates} />

                {/* 底部按钮 */}
                <div style={{
                  marginTop: 12,
                  paddingTop: 9,
                  borderTop: '1px solid #e8e8e8',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 9
                }}>
                  <Button
                    icon={<AppstoreOutlined />}
                    onClick={() => setShowAllTemplates(true)}
                    size="small"
                  >
                    {t('template.viewAll')} ({systemTemplates.length})
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => setShowCustomManager(true)}
                    size="small"
                  >
                    {t('template.customTemplates')}
                  </Button>
                </div>
              </div>
            )
          }
        ]}
      />

      {/* 查看全部模板弹窗 */}
      <AllTemplatesModal
        visible={showAllTemplates}
        onClose={() => setShowAllTemplates(false)}
      />

      {/* 我的模板管理弹窗 */}
      <CustomTemplateManager
        visible={showCustomManager}
        onClose={() => setShowCustomManager(false)}
      />
    </>
  );
};
