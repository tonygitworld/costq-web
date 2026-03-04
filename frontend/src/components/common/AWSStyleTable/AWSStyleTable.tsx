import { useMemo } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import {
  DndContext,
  closestCenter,
  PointerSensor,
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
import './AWSStyleTable.css';

export interface AWSStyleTableProps<T = any> extends TableProps<T> {
  /** 表格唯一标识，用于 localStorage 持久化 */
  tableId: string;
  /** 是否启用列宽拖拽调整，默认 true */
  columnResizeEnabled?: boolean;
  /** 是否启用列顺序拖拽，默认 true */
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
  // 1. 列顺序拖拽
  const { orderedColumns, draggableKeys, handleDragEnd } = useColumnDragOrder(
    rawColumns,
    tableId,
    columnDragEnabled
  );

  // 2. 列宽拖拽
  const { resizedColumns, totalWidth } = useColumnResize(orderedColumns, tableId, columnResizeEnabled);

  // 动态 scroll.x：取列宽总和与用户传入的 scroll.x 的较大值
  // 这样拉宽某列时表格总宽度跟着变大，不会挤压其他列
  const dynamicScroll = useMemo(() => {
    const scrollX = typeof userScroll?.x === 'number' ? userScroll.x : 0;
    return {
      ...userScroll,
      x: Math.max(totalWidth, scrollX) || undefined,
    };
  }, [userScroll, totalWidth]);

  // 3. 传感器配置 — 始终调用，保证 hooks 顺序一致
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // 4. 自定义 header cell — 把 columnKey 和 resize 信息注入
  const finalColumns = useMemo(() => {
    return resizedColumns.map(col => {
      const key = (col as any).key || (col as any).dataIndex;
      const isFixed = !!(col as any).fixed;
      const originalOnHeaderCell = (col as any).onHeaderCell;

      return {
        ...col,
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
  const components = useMemo(
    () => ({
      header: {
        cell: DraggableHeaderCell,
      },
    }),
    []
  );

  // 始终渲染 DndContext，通过 draggableKeys 为空数组来禁用拖拽
  // 这样保证 hooks 调用顺序在所有渲染路径中一致
  return (
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
  );
}
