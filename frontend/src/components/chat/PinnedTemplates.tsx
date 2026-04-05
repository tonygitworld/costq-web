/* PinnedTemplates - pinned template chips with drag-to-reorder */
import { type FC, useEffect, useRef, useState, useCallback } from 'react';
import { PushpinOutlined, UserOutlined } from '@ant-design/icons';
import { DndContext, MouseSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useI18n } from '../../hooks/useI18n';
import { translateTemplateTitle } from '../../utils/templateTranslations';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';

type AnyTemplate = PromptTemplate | UserPromptTemplate;
interface Props { position: 'above' | 'below'; }

const S = {
  bg: '#fff', border: '#e8e4e0', hBorder: '#da7756', hBg: '#fdf8f6',
  hShadow: '0 2px 8px rgba(218,119,86,0.10)', text: '#4a4040',
  icon: '#c4836a', close: '#ccc', hClose: '#da7756',
} as const;

const isUsr = (t: AnyTemplate): t is UserPromptTemplate => 'user_id' in t;

const SortableChip: FC<{ template: AnyTemplate; position: 'above' | 'below'; onSend: (t: AnyTemplate) => void; onUnpin: (id: string) => void }> = ({ template, position, onSend, onUnpin }) => {
  const { language } = useI18n();
  const label = isUsr(template) ? template.title : translateTemplateTitle(template.title, language);
  const below = position === 'below';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, cursor: isDragging ? 'grabbing' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, padding: below ? '8px 16px' : '6px 12px', borderRadius: below ? 22 : 20, fontSize: below ? 13.5 : 12.5, fontWeight: 500, border: '1px solid ' + S.border, background: S.bg, color: S.text, outline: 'none', whiteSpace: 'nowrap', maxWidth: below ? 240 : 180, flexShrink: 0, userSelect: 'none' }}
      {...attributes} {...listeners}
      onClick={() => { if (!isDragging) onSend(template); }}
      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = S.hBorder; e.currentTarget.style.background = S.hBg; e.currentTarget.style.boxShadow = S.hShadow; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.bg; e.currentTarget.style.boxShadow = 'none'; }}>
      {isUsr(template) ? <UserOutlined style={{ fontSize: below ? 13 : 12, color: S.icon, flexShrink: 0 }} /> : <PushpinOutlined style={{ fontSize: below ? 13 : 12, color: S.icon, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{label}</span>
      <span role="button" aria-label="Unpin" onClick={e => { e.stopPropagation(); onUnpin(template.id); }} onPointerDown={e => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', fontSize: 10, color: S.close, flexShrink: 0, opacity: 0.2, transition: 'opacity .15s,background .15s,color .15s', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,.06)'; e.currentTarget.style.color = S.hClose; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.close; e.currentTarget.style.opacity = '0.2'; }}>
        {'\u2715'}
      </span>
    </div>
  );
};

export const PinnedTemplates: FC<Props> = ({ position }) => {
  const { systemTemplates, userTemplates, pinnedTemplateIds, unpinTemplate, reorderPinnedTemplates, loadSystemTemplates, loadUserTemplates } = usePromptTemplateStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeL, setFadeL] = useState(false);
  const [fadeR, setFadeR] = useState(false);

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) reorderPinnedTemplates(String(active.id), String(over.id));
  }, [reorderPinnedTemplates]);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFadeL(el.scrollLeft > 2);
    setFadeR(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => { if (!systemTemplates.length) loadSystemTemplates(); if (!userTemplates.length) loadUserTemplates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    check();
    const t = setTimeout(check, 150);
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { clearTimeout(t); el.removeEventListener('scroll', check); window.removeEventListener('resize', check); ro.disconnect(); };
  }, [check, pinnedTemplateIds]);

  if (!pinnedTemplateIds.length) return null;
  const all: AnyTemplate[] = [...systemTemplates, ...userTemplates];
  const list = pinnedTemplateIds.map(id => all.find(x => x.id === id)).filter(Boolean) as AnyTemplate[];
  if (!list.length) return null;

  const send = (t: AnyTemplate) => window.dispatchEvent(new CustomEvent('quick-question', { detail: t.prompt_text }));
  const below = position === 'below';
  const outerPad = below ? '16px 0 8px' : '0 0 10px';
  const gap = below ? 10 : 8;

  const mask = (side: 'left' | 'right'): React.CSSProperties => ({ position: 'absolute', [side]: 0, top: 0, bottom: 0, width: 32, background: side === 'left' ? 'linear-gradient(to right,#fff 25%,transparent)' : 'linear-gradient(to left,#fff 25%,transparent)', zIndex: 2, pointerEvents: 'none' });

  return (
    <div style={{ position: 'relative', padding: outerPad }}>
      {fadeL && <div style={mask('left')} />}
      {fadeR && <div style={mask('right')} />}
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
        <SortableContext items={list.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          <div ref={scrollRef} className="pinned-templates-scroll" style={{ display: 'flex', gap, overflowX: 'auto', overflowY: 'hidden', justifyContent: below ? 'safe center' : 'flex-start', padding: '2px 16px', alignItems: 'center', scrollbarWidth: 'none', scrollBehavior: 'smooth' }}>
            {list.map(tpl => <SortableChip key={tpl.id} template={tpl} position={position} onSend={send} onUnpin={unpinTemplate} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};