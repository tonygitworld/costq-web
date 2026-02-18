import React, { useEffect } from 'react';
import { Popover } from 'antd';
import { useTranslation } from 'react-i18next';
import { useModelStore } from '../../stores/modelStore';
import CheckmarkIcon from '../icons/CheckmarkIcon';

// 添加旋转动画样式
const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// 注入样式到页面
if (typeof document !== 'undefined' && !document.querySelector('#spin-animation')) {
  const style = document.createElement('style');
  style.id = 'spin-animation';
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

/**
 * 模型选择器组件 - Popover下拉菜单版本
 *
 * 功能特性：
 * - 顶部弹出下拉菜单
 * - 支持单选AI模型
 * - localStorage持久化用户选择
 * - 当前选中项显示对勾标记
 * - 加载状态显示loading indicator
 */
export const ModelSelector: React.FC = () => {
  const { t } = useTranslation('models');
  const {
    models,
    selectedModelId,
    loading,
    error,
    fetchModels,
    setSelectedModelId,
    getSelectedModel,
  } = useModelStore();

  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  // 组件挂载时获取模型列表
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const selectedModel = getSelectedModel();

  // 渲染触发按钮内容
  const renderTriggerContent = () => {
    // 加载状态：显示加载动画和文本
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(0, 0, 0, 0.45)',
          fontSize: '13px'
        }}>
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>加载中...</span>
        </div>
      );
    }

    // 错误状态
    if (error) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(0, 0, 0, 0.45)',
          fontSize: '13px'
        }}>
          <span>加载失败</span>
        </div>
      );
    }

    // 显示当前选中的模型名称
    if (selectedModel) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(0, 0, 0, 0.88)',
          fontSize: '13px'
        }}>
          <svg viewBox="0 0 24 24" width="14px" height="14px" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>{t(`${selectedModel.name}.name`)}</span>
        </div>
      );
    }

    // 默认状态
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'rgba(0, 0, 0, 0.25)',
        fontSize: '13px'
      }}>
        <span>{t('selectModel')}</span>
      </div>
    );
  };

  // 处理模型选择
  const handleModelClick = (modelId: string) => {
    setSelectedModelId(modelId);
    setIsPopoverOpen(false);
  };

  // 渲染模型列表内容
  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
          加载中...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#ff4d4f', fontSize: '13px' }}>
          {error}
        </div>
      );
    }

    if (models.length === 0) {
      return (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
          暂无可用模型
        </div>
      );
    }

    return (
      <div style={{ width: '280px', padding: '4px 0' }}>
        {models.map((model) => {
          const isSelected = model.model_id === selectedModelId;
          return (
            <div
              key={model.model_id}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                borderRadius: '6px',
                margin: '2px 4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onClick={() => handleModelClick(model.model_id)}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#1a1a1a',
                  marginBottom: '2px'
                }}>
                  {t(`${model.name}.name`)}
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  {t(`${model.description}.description`)}
                </div>
              </div>
              {isSelected && (
                <CheckmarkIcon style={{ width: '14px', height: '14px', color: '#52c41a' }} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Popover
      content={renderContent()}
      trigger="click"
      open={isPopoverOpen && !loading}
      onOpenChange={(visible) => {
        if (loading) return;
        setIsPopoverOpen(visible);
      }}
      placement="top"
      arrow={false}
      overlayStyle={{ padding: 0 }}
      styles={{
        container: {
          padding: '8px 0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)'
        }
      }}
    >
      {/* 触发按钮 */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '180px',
          height: '32px',
          backgroundColor: loading ? '#f5f5f5' : '#ffffff',
          border: `1px solid ${loading ? '#e0e0e0' : '#d9d9d9'}`,
          borderRadius: '6px',
          padding: '0 8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 0 rgba(0, 0, 0, 0.02)',
          flexShrink: 0,
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#4096ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(5, 145, 255, 0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#d9d9d9';
            e.currentTarget.style.boxShadow = '0 2px 0 rgba(0, 0, 0, 0.02)';
          }
        }}
        title={loading ? "加载中..." : t('selectModel')}
      >
        {renderTriggerContent()}

        {/* 下拉箭头 */}
        <span style={{
          marginLeft: '4px',
          color: 'rgba(0, 0, 0, 0.25)',
          fontSize: '12px',
          transition: 'transform 0.3s',
          transform: isPopoverOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z"></path>
          </svg>
        </span>
      </div>
    </Popover>
  );
};

export default ModelSelector;
