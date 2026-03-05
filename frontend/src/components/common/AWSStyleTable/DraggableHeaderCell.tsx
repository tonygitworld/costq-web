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
  const isResizingRef = useRef(false);

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
      isResizingRef.current = true;

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
        // 延迟清除标记，确保 mouseup 后的 click 事件被拦截
        requestAnimationFrame(() => {
          isResizingRef.current = false;
        });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onResize, width, minWidth]
  );

  // 拦截 resize 后的 click，防止触发排序
  const handleThClick = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    if (isResizingRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // 调用 Ant Design 的原始 onClick（排序）
    const antdOnClick = (restProps as any).onClick;
    antdOnClick?.(e);
  }, [restProps]);

  const resizeHandle = onResize && width ? (
    <span
      className="aws-table-resize-handle"
      onMouseDown={e => { e.stopPropagation(); handleResizeMouseDown(e); }}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    />
  ) : null;

  // 不启用拖拽时（包括 fixed 列）
  if (!dragEnabled || !columnKey) {
    const { onClick: _antdClick, ...nonClickProps } = restProps as any;
    return (
      <th style={styleProp} className={className} onClick={handleThClick} {...nonClickProps}>
        {children}
        {resizeHandle}
      </th>
    );
  }

  const style: React.CSSProperties = {
    ...styleProp,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    whiteSpace: 'nowrap',
  };

  // 从 restProps 中提取 onClick，用 handleThClick 替代
  const { onClick: _antdClick, ...nonClickRestProps } = restProps as any;

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`${className || ''} ${isDragging ? 'aws-table-dragging' : ''}`}
      {...attributes}
      {...listeners}
      {...nonClickRestProps}
      onClick={handleThClick}
    >
      {children}
      {resizeHandle}
    </th>
  );
};
