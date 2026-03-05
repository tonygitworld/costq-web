import { useMemo, useState, useRef, useEffect } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { useColumnResize } from '../../../hooks/useColumnResize';
import { useColumnDragOrder } from '../../../hooks/useColumnDragOrder';
import { DraggableHeaderCell } from './DraggableHeaderCell';
import { SortIcon } from './SortIcon';
import './AWSStyleTable.css';

export interface AWSStyleTableProps<T = any> extends TableProps<T> {
  tableId: string;
  columnResizeEnabled?: boolean;
  columnDragEnabled?: boolean;
}

export function AWSStyleTable<T extends Record<string, any>>({
  tableId,
  columnResizeEnabled = true,
  columnDragEnabled = true,
  columns: rawColumns = [],
  className,
  scroll: userScroll,
  ...restProps
}: AWSStyleTableProps<T>) {
  // 0. 测量容器宽度（用于 table-layout:fixed 时填满容器）
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 1. 列顺序拖拽
  const { orderedColumns, draggableKeys, handleDragEnd } = useColumnDragOrder(
    rawColumns, tableId, columnDragEnabled
  );

  // 2. 列宽拖拽（传入容器宽度，用于自动填满）
  const { resizedColumns, totalWidth } = useColumnResize(
    orderedColumns, tableId, columnResizeEnabled, containerWidth
  );

  // scroll.x = totalWidth（已确保 >= containerWidth，不会有右侧空白）
  // rc-table 内部设置 table width = scroll.x，table-layout:fixed 下
  // 只要 scroll.x === 所有 col width 之和，列宽就不会被比例重分配
  const dynamicScroll = useMemo(() => {
    return {
      ...userScroll,
      x: totalWidth || undefined,
    };
  }, [userScroll, totalWidth]);

  // 3. 传感器配置
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // 4. 注入 columnKey / resize / sortIcon
  const finalColumns = useMemo(() => {
    return resizedColumns.map(col => {
      const key = (col as any).key || (col as any).dataIndex;
      const isFixed = !!(col as any).fixed;
      const originalOnHeaderCell = (col as any).onHeaderCell;
      const hasSorter = !!(col as any).sorter;

      return {
        ...col,
        ...(hasSorter ? {
          ...(!((col as any).sortIcon) ? {
            sortIcon: ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => (
              <SortIcon sortOrder={sortOrder} />
            ),
          } : {}),
          ...(!((col as any).sortDirections) ? {
            sortDirections: ['ascend', 'descend', 'ascend'] as const,
          } : {}),
        } : {}),
        onHeaderCell: (column: any) => {
          const resizeProps = originalOnHeaderCell ? originalOnHeaderCell(column) : {};
          return {
            ...resizeProps,
            columnKey: isFixed ? undefined : key,
            dragEnabled: columnDragEnabled && !isFixed,
            minWidth: (col as any).minWidth,
          };
        },
      };
    });
  }, [resizedColumns, columnDragEnabled]);

  // 5. 自定义 components
  const components = useMemo(() => ({
    header: { cell: DraggableHeaderCell },
  }), []);

  return (
    <div ref={containerRef} className="aws-style-table-container">
      <DndContext
        sensors={columnDragEnabled ? sensors : undefined}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columnDragEnabled ? draggableKeys : []}
          strategy={horizontalListSortingStrategy}
        >
          <Table
            {...restProps}
            columns={finalColumns as any}
            components={components}
            scroll={dynamicScroll}
            className={`aws-style-table ${className || ''}`}
          />
        </SortableContext>
      </DndContext>
    </div>
  );
}
