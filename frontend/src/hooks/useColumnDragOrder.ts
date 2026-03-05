import { useState, useCallback, useMemo } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ColumnsType } from 'antd/es/table';

function getColKey(col: any): string {
  return col.key || col.dataIndex || '';
}

function loadOrder(tableId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`table-col-order-${tableId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveOrder(tableId: string, order: string[]) {
  localStorage.setItem(`table-col-order-${tableId}`, JSON.stringify(order));
}

export function useColumnDragOrder<T>(
  columns: ColumnsType<T>,
  tableId: string,
  enabled = true
) {
  // 分离 fixed 列和可拖拽列
  const { fixedCols, draggableCols } = useMemo(() => {
    const fixed: ColumnsType<T> = [];
    const draggable: ColumnsType<T> = [];
    columns.forEach(col => {
      if ((col as any).fixed) {
        fixed.push(col);
      } else {
        draggable.push(col);
      }
    });
    return { fixedCols: fixed, draggableCols: draggable };
  }, [columns]);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = loadOrder(tableId);
    if (saved) return saved;
    return draggableCols.map(c => getColKey(c));
  });

  const orderedColumns = useMemo(() => {
    if (!enabled) return columns;

    // 按 columnOrder 排序可拖拽列
    const colMap = new Map(draggableCols.map(c => [getColKey(c), c]));
    const sorted: ColumnsType<T> = [];

    // 先按保存的顺序排
    for (const key of columnOrder) {
      const col = colMap.get(key);
      if (col) {
        sorted.push(col);
        colMap.delete(key);
      }
    }
    // 新增的列追加到末尾
    colMap.forEach(col => sorted.push(col));

    // fixed 列放回原位
    return [...sorted, ...fixedCols];
  }, [columns, columnOrder, draggableCols, fixedCols, enabled]);

  // 可拖拽列的 key 列表（给 SortableContext 用）
  const draggableKeys = useMemo(
    () => orderedColumns.filter(c => !(c as any).fixed).map(c => getColKey(c)),
    [orderedColumns]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = draggableKeys.indexOf(String(active.id));
      const newIndex = draggableKeys.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(draggableKeys, oldIndex, newIndex);
      setColumnOrder(newOrder);
      saveOrder(tableId, newOrder);
    },
    [draggableKeys, tableId]
  );

  return { orderedColumns, draggableKeys, handleDragEnd };
}
