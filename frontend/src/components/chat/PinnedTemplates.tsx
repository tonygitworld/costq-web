/* PinnedTemplates - pinned template quick-action chips */
import { type FC, useEffect, useRef, useState, useCallback } from 'react';
import { PushpinOutlined, UserOutlined } from '@ant-design/icons';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useI18n } from '../../hooks/useI18n';
import { translateTemplateTitle } from '../../utils/templateTranslations';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';

type AnyTemplate = PromptTemplate | UserPromptTemplate;
interface Props { position: 'above' | 'below'; }

const TH = {
  sys: { bg: '#fffbf7', border: '#f5dece', hBorder: '#f97316', hBg: '#fff3ea', hShadow: '0 2px 8px rgba(249,115,22,0.10)', icon: '#e86a3a', aBg: '#ffead9', text: '#78350f' },
  usr: { bg: '#faf8ff', border: '#e4d5fc', hBorder: '#8b5cf6', hBg: '#f3edff', hShadow: '0 2px 8px rgba(139,92,246,0.10)', icon: '#7c3aed', aBg: '#ebe0ff', text: '#3b0764' },
} as const;

export const PinnedTemplates: FC<Props> = ({ position }) => {
  const { language } = useI18n();
  const { systemTemplates, userTemplates, pinnedTemplateIds, unpinTemplate, loadSystemTemplates, loadUserTemplates } = usePromptTemplateStore();
  const ref = useRef<HTMLDivElement>(null);
  const [fadeL, setFadeL] = useState(false);
  const [fadeR, setFadeR] = useState(false);

  useEffect(() => {
    if (!systemTemplates.length) loadSystemTemplates();
    if (!userTemplates.length) loadUserTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFadeL(el.scrollLeft > 2);
    setFadeR(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    const t = setTimeout(check, 80);
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { clearTimeout(t); el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [check, pinnedTemplateIds]);

  if (!pinnedTemplateIds.length) return null;
  const all: AnyTemplate[] = [...systemTemplates, ...userTemplates];
  const list = pinnedTemplateIds.map(id => all.find(x => x.id === id)).filter(Boolean) as AnyTemplate[];
  if (!list.length) return null;

  const isUsr = (t: AnyTemplate): t is UserPromptTemplate => 'user_id' in t;
  const label = (t: AnyTemplate) => isUsr(t) ? t.title : translateTemplateTitle(t.title, language);
  const send = (t: AnyTemplate) => window.dispatchEvent(new CustomEvent('quick-question', { detail: t.prompt_text }));
  const below = position === 'below';

  // below: welcome page, slightly larger chips with more breathing room
  // above: in-chat, compact chips
  const pad = below ? '8px 16px' : '6px 13px';
  const fs = below ? 13.5 : 12.5;
  const rad = below ? 22 : 20;
  const gap = below ? 10 : 8;
  const mw = below ? 240 : 180;
  const iconSz = below ? 13 : 12;
  const outerPad = below ? '16px 0 8px' : '0 0 12px';

  const mask = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', [side]: 0, top: 0, bottom: 0, width: 32,
    background: side === 'left' ? 'linear-gradient(to right,#fff 25%,transparent)' : 'linear-gradient(to left,#fff 25%,transparent)',
    zIndex: 2, pointerEvents: 'none',
  });

  return (
    <div style={{ position: 'relative', padding: outerPad }}>
      {fadeL && <div style={mask('left')} />}
      {fadeR && <div style={mask('right')} />}
      <div ref={ref} className="pinned-templates-scroll"
        style={{ display: 'flex', gap, overflowX: 'auto', overflowY: 'hidden', justifyContent: below ? 'safe center' : 'flex-start', padding: '2px 16px', alignItems: 'center', scrollbarWidth: 'none', scrollBehavior: 'smooth' }}>
        {list.map(tpl => {
          const c = isUsr(tpl) ? TH.usr : TH.sys;
          return (
            <div key={tpl.id} onClick={() => send(tpl)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && send(tpl)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: pad, borderRadius: rad, fontSize: fs, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + c.border, background: c.bg, color: c.text, transition: 'all .18s ease-out', outline: 'none', whiteSpace: 'nowrap', maxWidth: mw, flexShrink: 0, userSelect: 'none' }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = c.hBorder; el.style.background = c.hBg; el.style.boxShadow = c.hShadow; el.style.transform = 'translateY(-1px)'; const x = el.querySelector('[data-close]') as HTMLElement; if (x) x.style.opacity = '0.8'; }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = c.border; el.style.background = c.bg; el.style.boxShadow = 'none'; el.style.transform = 'none'; const x = el.querySelector('[data-close]') as HTMLElement; if (x) x.style.opacity = '0.25'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(.97)'; e.currentTarget.style.background = c.aBg; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = c.hBg; }}>
              {isUsr(tpl)
                ? <UserOutlined style={{ fontSize: iconSz, color: c.icon, flexShrink: 0 }} />
                : <PushpinOutlined style={{ fontSize: iconSz, color: c.icon, flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{label(tpl)}</span>
              <span data-close role="button" aria-label="Unpin"
                onClick={e => { e.stopPropagation(); unpinTemplate(tpl.id); }}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', fontSize: 10, color: c.icon, flexShrink: 0, opacity: 0.25, transition: 'opacity .15s,background .15s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,.06)'; e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.25'; }}>
                {'\u2715'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};