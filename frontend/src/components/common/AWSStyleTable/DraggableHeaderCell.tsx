import { type FC, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnKey?: string;
  dragEnabled?: boolean;
  onResize?: (e: React.SyntheticEvent, data: { size: { width: number } }) => void;
  width?: number;
  minWidth?: number;
}

export const DraggableHeaderCell: FC<DraggableHeaderCellProps> = ({
  columnKey,
  dragEnabled = true,
  onResize,
  width,
  minWidth = 50,
  children,
  style: styleProp,
  className,
  ...restProps
}) => {
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnKey || 'unknown',
    disabled: !dragEnabled,
  });

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onResize || !width) return;
      e.preventDefault();
      e.stopPropagation();

      resizeRef.current = { startX: e.clientX, startWidth: width };

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeRef.current) return;
        const diff = moveEvent.clientX - resizeRef.current.startX;
        const newWidth = Math.max(resizeRef.current.startWidth + diff, minWidth);
        onResize(moveEvent as any, { size: { width: newWidth } });
      };

      const onMouseUp = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onResize, width, minWidth]
  );

  const stopPointerPropagation = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const resizeHandle = onResize && width ? (
    <span
      className="aws-table-resize-handle"
      onMouseDown={handleResizeMouseDown}
      onPointerDown={stopPointerPropagation}
      onClick={e => e.stopPropagation()}
    />
  ) : null;

  // 不启用拖拽时（包括 fixed 列），保留 Ant Design 原始 style 不覆盖
  if (!dragEnabled || !columnKey) {
    return (
      <th style={styleProp} className={className} {...restProps}>
        {children}
        {resizeHandle}
      </th>
    );
  }

  // 拖拽启用的列：合并 transform/transition，但不覆盖 Ant Design 的 position
  const style: React.CSSProperties = {
    ...styleProp,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    whiteSpace: 'nowrap',
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`${className || ''} ${isDragging ? 'aws-table-dragging' : ''}`}
      {...attributes}
      {...restProps}
    >
      <div
        className="aws-table-header-drag-zone"
        {...listeners}
        style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
      >
        {children}
      </div>
      {resizeHandle}
    </th>
  );
};
