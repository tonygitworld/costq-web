import { useState, useCallback, useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';

const DEFAULT_MIN_WIDTH = 50;

function loadWidths(tableId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`table-col-widths-${tableId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWidths(tableId: string, widths: Record<string, number>) {
  localStorage.setItem(`table-col-widths-${tableId}`, JSON.stringify(widths));
}

export function useColumnResize<T>(
  columns: ColumnsType<T>,
  tableId: string,
  enabled = true
) {
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(tableId));

  // 构建每列的最小宽度映射
  const minWidthMap = useMemo(() => {
    const map: Record<string, number> = {};
    columns.forEach(col => {
      const key = (col as any).key || (col as any).dataIndex;
      if (key && (col as any).minWidth) {
        map[key] = (col as any).minWidth;
      }
    });
    return map;
  }, [columns]);

  const handleResize = useCallback(
    (key: string) => (_: React.SyntheticEvent, { size }: { size: { width: number } }) => {
      const min = minWidthMap[key] || DEFAULT_MIN_WIDTH;
      const w = Math.max(size.width, min);
      setWidths(prev => {
        const next = { ...prev, [key]: w };
        saveWidths(tableId, next);
        return next;
      });
    },
    [tableId, minWidthMap]
  );

  const resizedColumns = useMemo(() => {
    if (!enabled) return columns;
    return columns.map(col => {
      const key = (col as any).key || (col as any).dataIndex;
      if (!key) return col;
      const savedWidth = widths[key];
      const originalWidth = (col as any).width;
      // 没有设 width 的列给一个默认值，确保 resize handle 能渲染
      const effectiveWidth = savedWidth || (typeof originalWidth === 'number' ? originalWidth : 150);
      return {
        ...col,
        width: effectiveWidth,
        onHeaderCell: (column: any) => ({
          width: effectiveWidth,
          onResize: handleResize(key),
        }),
      };
    });
  }, [columns, widths, enabled, handleResize]);

  // 计算所有列的实际总宽度，用于动态设置 scroll.x
  const totalWidth = useMemo(() => {
    return resizedColumns.reduce((sum, col) => {
      const w = (col as any).width;
      return sum + (typeof w === 'number' ? w : 0);
    }, 0);
  }, [resizedColumns]);

  return { resizedColumns, totalWidth };
}
