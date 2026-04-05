/* PinnedTemplates - pinned template chips with drag-to-reorder */
import { type FC, useEffect, useRef, useState, useCallback } from 'react';
import { PushpinOutlined, UserOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import {
  DndContext, MouseSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy, rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
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

/* ── ExpandToggle (inline) ─────────────────────────────────── */
const ExpandToggle: FC<{ expanded: boolean; onClick: () => void }> = ({ expanded, onClick }) => (
  <div
    role="button"
    aria-label={expanded ? 'Collapse' : 'Expand'}
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: 22,
      border: `1px solid ${S.border}`, background: S.bg,
      cursor: 'pointer', flexShrink: 0,
      transition: 'border-color .15s, background .15s, box-shadow .15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = S.hBorder;
      e.currentTarget.style.background = S.hBg;
      e.currentTarget.style.boxShadow = S.hShadow;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = S.border;
      e.currentTarget.style.background = S.bg;
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    {expanded
      ? <UpOutlined style={{ fontSize: 12, color: S.icon }} />
      : <DownOutlined style={{ fontSize: 12, color: S.icon }} />}
  </div>
);

/* ── SortableChip ──────────────────────────────────────────── */
const SortableChip: FC<{
  template: AnyTemplate;
  position: 'above' | 'below';
  onSend: (t: AnyTemplate) => void;
  onUnpin: (id: string) => void;
}> = ({ template, position, onSend, onUnpin }) => {
  const { language } = useI18n();
  const label = isUsr(template) ? template.title : translateTemplateTitle(template.title, language);
  const below = position === 'below';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id });
  return (
    <div ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, cursor: isDragging ? 'grabbing' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: below ? '8px 16px' : '6px 12px', borderRadius: below ? 22 : 20,
        fontSize: below ? 13.5 : 12.5, fontWeight: 500,
        border: '1px solid ' + S.border, background: S.bg, color: S.text,
        outline: 'none', whiteSpace: 'nowrap', maxWidth: below ? 240 : 180,
        flexShrink: 0, userSelect: 'none',
      }}
      {...attributes} {...listeners}
      onClick={() => { if (!isDragging) onSend(template); }}
      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = S.hBorder; e.currentTarget.style.background = S.hBg; e.currentTarget.style.boxShadow = S.hShadow; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.bg; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {isUsr(template)
        ? <UserOutlined style={{ fontSize: below ? 13 : 12, color: S.icon, flexShrink: 0 }} />
        : <PushpinOutlined style={{ fontSize: below ? 13 : 12, color: S.icon, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{label}</span>
      <span role="button" aria-label="Unpin"
        onClick={e => { e.stopPropagation(); onUnpin(template.id); }}
        onPointerDown={e => e.stopPropagation()}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: '50%', fontSize: 10,
          color: S.close, flexShrink: 0, opacity: 0.2,
          transition: 'opacity .15s,background .15s,color .15s', cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,.06)'; e.currentTarget.style.color = S.hClose; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.close; e.currentTarget.style.opacity = '0.2'; }}
      >
        {'\u2715'}
      </span>
    </div>
  );
};
/* ── Main Component ────────────────────────────────────────── */
export const PinnedTemplates: FC<Props> = ({ position }) => {
  const {
    systemTemplates, userTemplates, pinnedTemplateIds,
    unpinTemplate, reorderPinnedTemplates,
    loadSystemTemplates, loadUserTemplates,
  } = usePromptTemplateStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeL, setFadeL] = useState(false);
  const [fadeR, setFadeR] = useState(false);

  /* Task 1.1: expand/collapse core state */
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  /* Task 2.5: bottom fade for expanded scroll */
  const [fadeBottom, setFadeBottom] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) reorderPinnedTemplates(String(active.id), String(over.id));
  }, [reorderPinnedTemplates]);

  /* Task 1.2: extended check with overflow detection */
  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (expanded) {
      // When expanded (wrap layout), skip overflow detection - wrap means no horizontal overflow
      // Only check vertical scroll for bottom fade
      return;
    }
    // Only detect overflow in collapsed (single-row) mode
    const isOverflow = el.scrollWidth > el.clientWidth + 2;
    setOverflows(isOverflow);
    setFadeL(el.scrollLeft > 2);
    setFadeR(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, [expanded]);

  /* Task 1.3: auto-reset when position switches to above */
  useEffect(() => {
    if (position === 'above') setExpanded(false);
  }, [position]);

  /* Task 1.4: toggle handler with transitioning debounce */
  const handleToggle = useCallback(() => {
    if (transitioning) return;
    setTransitioning(true);
    setExpanded(prev => !prev);
    setTimeout(() => setTransitioning(false), 300);
  }, [transitioning]);

  useEffect(() => {
    if (!systemTemplates.length) loadSystemTemplates();
    if (!userTemplates.length) loadUserTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    check();
    const t = setTimeout(check, 150);
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      ro.disconnect();
    };
  }, [check, pinnedTemplateIds]);

  /* early return */
  if (!pinnedTemplateIds.length) return null;

  const all: AnyTemplate[] = [...systemTemplates, ...userTemplates];
  const list = pinnedTemplateIds.map(id => all.find(x => x.id === id)).filter(Boolean) as AnyTemplate[];
  if (!list.length) return null;

  const send = (t: AnyTemplate) =>
    window.dispatchEvent(new CustomEvent('quick-question', { detail: t.prompt_text }));

  const below = position === 'below';
  const outerPad = below ? '16px 0 8px' : '0 0 10px';
  const gap = below ? 10 : 8;

  /* Task 2.3: toggle visibility */
  const showToggle = position === 'below' && (overflows || expanded);

  /* DnD: always horizontal in collapsed row; expanded overlay has no DnD */

  /* Task 2.1: container style based on expanded state */
  /* Collapsed row style - always the same height regardless of expanded state */
  const rowStyle: React.CSSProperties = {
    display: 'flex', gap,
    overflowX: 'auto', overflowY: 'hidden',
    justifyContent: below ? 'safe center' : 'flex-start',
    padding: '2px 16px', alignItems: 'center',
    scrollbarWidth: 'none', scrollBehavior: 'smooth',
  };
  /* Expanded overlay style - absolute positioned, does NOT affect parent height */
  const expandedStyle: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
    display: 'flex', flexWrap: 'wrap', gap,
    padding: '12px 16px',
    maxHeight: '30vh', overflowY: 'auto', overflowX: 'hidden',
    background: '#fff', borderRadius: 16,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
    alignItems: 'flex-start', alignContent: 'flex-start',
    scrollbarWidth: 'none',
    justifyContent: 'center',
  };

  const mask = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', [side]: 0, top: 0, bottom: 0, width: 32,
    background: side === 'left'
      ? 'linear-gradient(to right,#fff 25%,transparent)'
      : 'linear-gradient(to left,#fff 25%,transparent)',
    zIndex: 2, pointerEvents: 'none',
  });

  /* Task 2.5: vertical scroll handler for bottom fade */
  const handleVerticalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setFadeBottom(el.scrollTop < el.scrollHeight - el.clientHeight - 2);
  };

  return (
    <div style={{ position: 'relative', padding: outerPad }}>
      {/* Fade edges - only in collapsed mode */}
      {!expanded && fadeL && <div style={mask('left')} />}
      {!expanded && fadeR && <div style={mask('right')} />}

      {/* Always-visible collapsed row - fixed height, never changes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
          <SortableContext items={list.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            <div ref={scrollRef} className="pinned-templates-scroll" style={rowStyle}>
              {list.map(tpl => (
                <SortableChip key={tpl.id} template={tpl} position={position}
                  onSend={send} onUnpin={unpinTemplate} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* ExpandToggle button */}
        {showToggle && (
          <div style={{ flexShrink: 0, position: 'relative', zIndex: 5 }}>
            <ExpandToggle expanded={expanded} onClick={handleToggle} />
          </div>
        )}
      </div>

      {/* Expanded overlay - absolute, does NOT affect parent height */}
      {expanded && (
        <div style={expandedStyle} onScroll={handleVerticalScroll}>
          {list.map(tpl => (
            <SortableChip key={tpl.id} template={tpl} position={position}
              onSend={send} onUnpin={unpinTemplate} />
          ))}
          {fadeBottom && (
            <div style={{
              position: 'sticky', bottom: 0, left: 0, right: 0, height: 24,
              background: 'linear-gradient(to top, #fff 30%, transparent)',
              pointerEvents: 'none', flexBasis: '100%',
            }} />
          )}
        </div>
      )}
    </div>
  );
};
