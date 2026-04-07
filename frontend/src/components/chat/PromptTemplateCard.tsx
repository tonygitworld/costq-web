/**
 * PromptTemplateCard - 提示词模板卡片
 *
 * 单个模板的卡片展示，支持点击和可选的卡片内动作区
 */

import React from 'react';
import { Card, Tooltip, Tag } from 'antd';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';
import { translateTemplateTitle, translateTemplateDescription } from '../../utils/templateTranslations';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  template: PromptTemplate | UserPromptTemplate;
  onClick: (template: PromptTemplate | UserPromptTemplate) => void;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}

export const PromptTemplateCard: React.FC<Props> = ({ template, onClick, actions, style }) => {
  const { language, t } = useI18n('chat');

  const isUserTemplate = 'user_id' in template;
  const translatedTitle = translateTemplateTitle(template.title, language);
  const translatedDescription = template.description ? translateTemplateDescription(template.description, language) : undefined;
  const isVipTemplate = template.id === 'pt-001' || template.id === 'pt-016';

  const cloudProviderColors: Record<string, string> = {
    aws: '#ff9900',
    gcp: '#4285f4',
    both: '#722ed1'
  };

  return (
    <Tooltip title={translatedDescription} placement="top">
      <Card
        hoverable
        onClick={() => onClick(template)}
        style={{
          width: 180,
          minHeight: actions ? 108 : 70,
          height: actions ? 'auto' : 70,
          borderRadius: 8,
          background: isVipTemplate
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%)',
          border: isVipTemplate
            ? '2px solid transparent'
            : '1px solid #e8e8e8',
          backgroundImage: isVipTemplate
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%), linear-gradient(90deg, #FFD700, #FFC400, #FFD700)'
            : undefined,
          backgroundOrigin: isVipTemplate ? 'border-box' : undefined,
          backgroundClip: isVipTemplate ? 'padding-box, border-box' : undefined,
          boxShadow: isVipTemplate
            ? '0 8px 32px rgba(255, 215, 0, 0.2)'
            : undefined,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          position: 'relative',
          ...style
        }}
        styles={{
          body: {
            padding: actions ? '10px 8px 8px' : 8,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: actions ? 'space-between' : 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: actions ? 8 : 6,
            height: '100%'
          }
        }}
        className={isVipTemplate ? 'template-card template-card-vip' : 'template-card'}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: '100%'
        }}>
          <div>
            {isUserTemplate ? (
              <Tag
                color="#722ed1"
                style={{ fontSize: 10, padding: '1px 6px', margin: 0, fontWeight: 400 }}
              >
                {t('template.myTemplate')}
              </Tag>
            ) : (
              template.cloud_provider && (
                <Tag
                  color={cloudProviderColors[template.cloud_provider]}
                  style={{ fontSize: 10, padding: '1px 6px', margin: 0, fontWeight: 400 }}
                >
                  {template.cloud_provider.toUpperCase()}
                </Tag>
              )
            )}
          </div>

          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: isVipTemplate ? '#FFD700' : '#262626',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: actions ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4',
            textShadow: isVipTemplate ? '0 0 10px rgba(255, 215, 0, 0.5)' : undefined
          }}>
            {translatedTitle}
          </div>
        </div>

        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%'
            }}
          >
            {actions}
          </div>
        )}
      </Card>

      <style>{`
        .template-card {
          margin-top: 4px;
          margin-bottom: 4px;
        }

        .template-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15) !important;
          border-color: #1890ff !important;
        }

        .template-card:active {
          transform: scale(0.98);
        }

        .template-card-vip {
          margin-top: 6px;
          margin-bottom: 6px;
        }

        .template-card-vip:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 20px 60px rgba(255, 215, 0, 0.4) !important;
        }

        .template-card-vip::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(90deg, #FFD700, #FFC400, #FFA500, #FFC400, #FFD700);
          background-size: 200% 100%;
          border-radius: 8px;
          z-index: -1;
          animation: shimmer 3s linear infinite;
          opacity: 0.8;
        }

        @keyframes shimmer {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        .template-card-vip {
          overflow: visible;
        }
      `}</style>
    </Tooltip>
  );
};
