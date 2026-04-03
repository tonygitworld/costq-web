/**
 * PinnedTemplates — 固定在对话框附近的模板快捷标签
 *
 * position="above": 已有对话时，显示在输入框上方（紧凑横排）
 * position="below": 新对话时，显示在输入框下方（居中 chips）
 *
 * 超出一行时隐藏多余的，显示 +N 徽标
 */
import { type FC, useEffect, useRef, useState, useCallback } from 'react';
import { Tooltip } from 'antd';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useI18n } from '../../hooks/useI18n';
import { translateTemplateTitle } from '../../utils/templateTranslations';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';

type AnyTemplate = PromptTemplate | UserPromptTemplate;

interface PinnedTemplatesProps {
  position: 'above' | 'below';
}

const THEME = {
  system: { dot: '#da7756', hoverBorder: '#da7756', hoverBg: '#fffaf8', hoverShadow: 'rgba(218,119,86,0.12)' },
  user:   { dot: '#8b5cf6', hoverBorder: '#8b5cf6', hoverBg: '#faf5ff', hoverShadow: 'rgba(139,92,246,0.12)' },
} as const;

export const PinnedTemplates: FC<PinnedTemplatesProps> = ({ position }) => {
  const { language } = useI18n();
  const {
    systemTemplates, userTemplates,
    pinnedTemplateIds, unpinTemplate,
    loadSystemTemplates, loadUserTemplates,
  } = usePromptTemplateStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(Infinity);

  useEffect(() => {
    if (systemTemplates.length === 0) loadSystemTemplates();
    if (userTemplates.length === 0) loadUserTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算一行能放多少个
  const calcVisible = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) return;

    const containerRight = container.getBoundingClientRect().right;
    const gap = 8;
    const badgeWidth = 40; // +N 徽标预留宽度
    let count = 0;

    for (const child of children) {
      if (child.dataset.badge) continue; // 跳过 +N 元素
      const childRight = child.getBoundingClientRect().right;
      if (childRight + gap + badgeWidth > containerRight) break;
      count++;
    }

    setVisibleCount(Math.max(count, 1));
  }, []);

  useEffect(() => {
    calcVisible();
    window.addEventListener('resize', calcVisible);
    return () => window.removeEventListener('resize', calcVisible);
  }, [calcVisible, pinnedTemplateIds]);

  if (pinnedTemplateIds.length === 0) return null;

  const allTemplates: AnyTemplate[] = [...systemTemplates, ...userTemplates];
  const pinnedTemplates = pinnedTemplateIds
    .map(id => allTemplates.find(t => t.id === id))
    .filter(Boolean) as AnyTemplate[];

  if (pinnedTemplates.length === 0) return null;

  const isUserTpl = (tpl: AnyTemplate): tpl is UserPromptTemplate => 'user_id' in tpl;
  const getTitle = (tpl: AnyTemplate) =>
    isUserTpl(tpl) ? tpl.title : translateTemplateTitle(tpl.title, language);

  const handleClick = (tpl: AnyTemplate) => {
    window.dispatchEvent(new CustomEvent('quick-question', { detail: tpl.prompt_text }));
  };

  const isBelow = position === 'below';
  const visible = pinnedTemplates.slice(0, visibleCount);
  const hiddenCount = pinnedTemplates.length - visible.length;
  const hiddenNames = pinnedTemplates.slice(visibleCount).map(t => getTitle(t));

  const chipStyle = (tpl: AnyTemplate): React.CSSProperties => {
    const theme = isUserTpl(tpl) ? THEME.user : THEME.system;
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: isBelow ? '7px 14px' : '5px 12px',
      borderRadius: isBelow ? 18 : 14,
      fontSize: isBelow ? 13 : 12,
      fontWeight: 500,
      cursor: 'pointer',
      border: '1px solid #e8e8e8',
      background: '#fff',
      color: '#4a4a4a',
      transition: 'all 0.2s ease',
      outline: 'none',
      whiteSpace: 'nowrap',
      maxWidth: isBelow ? 240 : 200,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      // store theme for hover
      '--hover-border': theme.hoverBorder,
      '--hover-bg': theme.hoverBg,
      '--hover-shadow': theme.hoverShadow,
    } as React.CSSProperties;
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'nowrap',
        overflow: 'hidden',
        justifyContent: isBelow ? 'center' : 'flex-start',
        padding: isBelow ? '12px 16px 4px' : '0 16px 8px',
      }}
    >
      {visible.map(tpl => {
        const theme = isUserTpl(tpl) ? THEME.user : THEME.system;
        return (
          <div
            key={tpl.id}
            onClick={() => handleClick(tpl)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleClick(tpl)}
            style={chipStyle(tpl)}
            onMouseEnter={e => {
              const el = e.currentTarget;
              el.style.borderColor = theme.hoverBorder;
              el.style.background = theme.hoverBg;
              el.style.boxShadow = `0 2px 8px ${theme.hoverShadow}`;
              el.style.transform = 'translateY(-1px)';
              const close = el.querySelector('[data-close]') as HTMLElement;
              if (close) close.style.opacity = '1';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget;
              el.style.borderColor = '#e8e8e8';
              el.style.background = '#fff';
              el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              el.style.transform = 'translateY(0)';
              const close = el.querySelector('[data-close]') as HTMLElement;
              if (close) close.style.opacity = '0';
            }}
            title={tpl.prompt_text}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.dot, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>
              {getTitle(tpl)}
            </span>
            <span
              data-close
              onClick={e => { e.stopPropagation(); unpinTemplate(tpl.id); }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 16, height: 16, borderRadius: '50%', fontSize: 9, color: '#bbb',
                flexShrink: 0, opacity: 0, transition: 'opacity 0.15s, background 0.15s',
                cursor: 'pointer', marginLeft: -1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#666'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#bbb'; }}
            >
              ✕
            </span>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <Tooltip
          title={hiddenNames.join('、')}
          placement="top"
        >
          <div
            data-badge
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 10px',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 600,
              color: '#8c8c8c',
              background: '#f5f5f5',
              border: '1px solid #e8e8e8',
              cursor: 'default',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            +{hiddenCount}
          </div>
        </Tooltip>
      )}
    </div>
  );
};
